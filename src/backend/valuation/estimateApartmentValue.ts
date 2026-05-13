import { normalizeAddress } from "./normalizeAddress";
import { fetchPublicTransactions } from "./publicTransactionApi";
import { extractRegion } from "./extractRegion";
import { findLegalDongCode } from "./legalDongCode";
import { searchAddressByKakao } from "./addressSearchApi";
import type { ValuationInput, ValuationResult } from "./types";

function average(numbers: number[]) {
  if (!numbers.length) return 0;
  return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
}

function weightedAverage(values: number[], weights: number[]) {
  if (!values.length || values.length !== weights.length) return 0;
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (!totalWeight) return average(values);
  return Math.round(values.reduce((s, v, i) => s + v * weights[i], 0) / totalWeight);
}

function removeOutliersByIqr(values: number[]) {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  return sorted.filter((v) => v >= q1 - iqr * 1.5 && v <= q3 + iqr * 1.5);
}

function parseKoreanMoneyTextToWon(value?: string) {
  if (!value) return 0;
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

function estimatePriorityRepaymentAmount(params: { tenantDepositAmount?: number }) {
  const deposit = params.tenantDepositAmount ?? 0;
  return deposit ? Math.min(deposit, 55_000_000) : 0;
}

function getSeniorMortgageAmount(input: ValuationInput) {
  const mortgages = input.rightsRisk?.mortgages ?? [];
  if (mortgages.length > 0) return mortgages.reduce((s, m) => s + m.amount, 0);
  return parseKoreanMoneyTextToWon(input.rightsRisk?.mortgageAmountText);
}

function formatWon(value: number) {
  return `${value.toLocaleString()}원`;
}

export async function estimateApartmentValue(input: ValuationInput): Promise<ValuationResult> {
  const normalized = normalizeAddress(input);
  const warnings: string[] = [];

  // ─── 법정동코드 조회 (카카오 → 행정안전부) ────────────────────────────────
  const region = extractRegion(normalized.normalizedAddress);
  const legalDongCode = await findLegalDongCode(region, normalized.normalizedAddress);

  console.log("valuation_debug", {
    addressRaw: normalized.normalizedAddress,
    buildingName: normalized.buildingName,
    legalDongCode,
    region,
  });

  // ─── 좌표 (카카오에서 이미 조회했으면 재사용) ─────────────────────────────
  // kaptCode 관련 API 비활성화 (단지목록 API 빈 데이터)
  const apartmentMeta = undefined;

  if (!normalized.normalizedAddress) warnings.push("주소 정보가 부족합니다.");
  if (!normalized.area) warnings.push("전용면적 정보가 부족합니다.");
  if (!legalDongCode) warnings.push("법정동코드를 찾을 수 없어 실거래가 조회가 제한됩니다.");

  // ─── 실거래 조회 ──────────────────────────────────────────────────────────
  const transactions = await fetchPublicTransactions({
    buildingName: normalized.buildingName,
    exclusiveAreaM2: normalized.area,
    region,
    legalDongCode,
    targetFloor: input.floor,
    targetCoordinate: undefined,
    targetBuildYear: undefined,
    targetHouseholdCount: undefined,
    targetSubwayWalkMinutes: undefined,
    targetKaptCode: undefined,
  });

  if (transactions.some((tx) => tx.selectionReason?.includes("±5㎡"))) {
    warnings.push("동일단지·유사층 거래가 부족하여 전용면적 비교 범위를 ±5㎡까지 자동 확장했습니다.");
  }
  if (transactions.length === 0) {
    warnings.push("조건에 맞는 실거래 비교군을 찾지 못했습니다.");
  } else if (transactions.length < 3) {
    warnings.push("비교 가능한 실거래 데이터가 3건 미만입니다. 결과 신뢰도가 낮을 수 있습니다.");
  }

  // ─── 이상치 제거 및 가격 계산 ────────────────────────────────────────────
  const originalPrices = transactions.map((t) => t.dealAmount * 10000);
  const filteredPriceSet = removeOutliersByIqr(originalPrices);
  const excludedTransactions = transactions.filter((tx) => !filteredPriceSet.includes(tx.dealAmount * 10000));

  if (excludedTransactions.length > 0) {
    warnings.push(`${excludedTransactions.length}건의 이상 거래가가 IQR 기준으로 자동 제외되었습니다.`);
    excludedTransactions.forEach((tx) => {
      warnings.push(`${tx.dealYear}.${String(tx.dealMonth).padStart(2,"0")}.${String(tx.dealDay).padStart(2,"0")} 거래 (${formatWon(tx.dealAmount * 10000)}) 이상치 제외`);
    });
  }

  const filteredTransactions = transactions.filter((tx) => filteredPriceSet.includes(tx.dealAmount * 10000));
  const filteredPrices = filteredTransactions.map((t) => t.dealAmount * 10000);
  const weights = filteredTransactions.map((t) => t.similarityScore ?? 50);

  const weightedAveragePrice = filteredPrices.length ? weightedAverage(filteredPrices, weights) : undefined;
  const conservativePrice = filteredPrices.length ? Math.min(...filteredPrices) : undefined;
  const upperReferencePrice = filteredPrices.length ? Math.max(...filteredPrices) : undefined;

  // ─── 권리 반영 ────────────────────────────────────────────────────────────
  const mortgages = input.rightsRisk?.mortgages ?? [];
  const seniorMortgageAmount = getSeniorMortgageAmount(input);
  const tenantDepositAmount = input.tenantDepositAmount ?? 0;
  const tenantMonthlyRent = input.tenantMonthlyRent ?? 0;
  const priorityRepaymentAmount = estimatePriorityRepaymentAmount({ tenantDepositAmount });
  const seniorDebtAmount = seniorMortgageAmount + tenantDepositAmount;
  const riskAdjustedPrice = weightedAveragePrice !== undefined ? Math.max(weightedAveragePrice - seniorDebtAmount, 0) : undefined;

  if (seniorMortgageAmount > 0) warnings.push(`선순위 근저당 채권최고액 합계 ${formatWon(seniorMortgageAmount)}이 권리반영 기준가에 반영되었습니다.`);
  if (tenantDepositAmount > 0) warnings.push(`임차보증금 ${formatWon(tenantDepositAmount)}이 권리반영 기준가에 반영되었습니다.`);
  if (priorityRepaymentAmount > 0) warnings.push(`최우선변제금 추정액 ${formatWon(priorityRepaymentAmount)}은 참고 금액이며 임차보증금 전체가 차감에 반영됩니다.`);

  // ─── 신뢰도 계산 ──────────────────────────────────────────────────────────
  const averageSimilarity = weights.length ? average(weights) : 0;
  const sameApartmentCount = filteredTransactions.filter((tx) => tx.isSameApartment).length;
  const recentCount = filteredTransactions.filter((tx) => (tx.monthsAgo ?? 999) <= 6).length;
  const excludedRatio = transactions.length > 0 ? excludedTransactions.length / transactions.length : 0;

  let confidenceScore = 0;
  confidenceScore += Math.min(filteredTransactions.length, 5) * 12;
  confidenceScore += averageSimilarity * 0.35;
  confidenceScore += sameApartmentCount > 0 ? 15 : 0;
  confidenceScore += recentCount >= 3 ? 10 : recentCount * 3;
  if (excludedRatio >= 0.4) confidenceScore -= 15;
  else if (excludedRatio >= 0.2) confidenceScore -= 8;
  if (!filteredTransactions.some((tx) => tx.isSameApartment)) confidenceScore -= 10;
  if (filteredTransactions.some((tx) => tx.selectionReason?.includes("±5㎡"))) confidenceScore -= 8;
  if (input.rightsRisk?.riskLevel === "CAUTION") confidenceScore -= 5;
  if (input.rightsRisk?.riskLevel === "DANGER") confidenceScore -= 15;
  if (seniorDebtAmount > 0) confidenceScore -= 8;
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  let overallConfidence: "A" | "B" | "C" = "C";
  if (confidenceScore >= 80) overallConfidence = "A";
  else if (confidenceScore >= 60) overallConfidence = "B";
  if (input.rightsRisk?.riskLevel === "DANGER" && overallConfidence === "A") overallConfidence = "B";

  // ─── 종합 의견 ────────────────────────────────────────────────────────────
  let finalComment =
    overallConfidence === "A" ? "비교 가능한 실거래 데이터가 충분하고 유사도가 높아 신뢰도가 높은 편입니다." :
    overallConfidence === "B" ? "비교 가능한 실거래 데이터는 확보되었으나 일부 보정 요소가 있어 추가 검토가 권장됩니다." :
    "비교 가능한 실거래 데이터가 부족하거나 유사도가 낮아 보수적인 검토가 필요합니다.";

  if (seniorDebtAmount > 0) finalComment += " 선순위 권리 금액을 반영한 권리반영 기준가를 함께 확인하세요.";
  if (input.rightsRisk?.riskLevel === "DANGER") finalComment += " 고위험 권리관계가 감지되어 별도 권리분석 확인이 필요합니다.";
  else if (input.rightsRisk?.riskLevel === "CAUTION") finalComment += " 권리관계상 주의 요소가 있어 관련 서류 확인이 필요합니다.";

  if (input.rightsRisk?.riskLevel === "DANGER") warnings.push("압류/가압류/신탁 등 고위험 권리관계가 감지되었습니다.");
  else if (input.rightsRisk?.riskLevel === "CAUTION") warnings.push("근저당 또는 임차권/전세권 관련 권리관계 검토가 필요합니다.");

  return {
    success: true,
    normalizedAddress: normalized.normalizedAddress,
    buildingName: normalized.buildingName,
    comparableCount: transactions.length,
    lowestPrice: filteredPrices.length ? Math.min(...filteredPrices) : undefined,
    highestPrice: filteredPrices.length ? Math.max(...filteredPrices) : undefined,
    averagePrice: weightedAveragePrice,
    conservativePrice,
    upperReferencePrice,
    riskAdjustedPrice,
    seniorDebtAmount,
    seniorMortgageAmount,
    mortgages,
    tenantDepositAmount,
    tenantMonthlyRent,
    priorityRepaymentAmount,
    recentTransactions: transactions,
    valuationBasis: [
      "동일 법정동 실거래 비교",
      "동일단지 우선 비교 (단지명 매칭)",
      "유사 면적 비교",
      "층수 유사도 반영",
      "거래 시점 최신성 반영",
      "직거래 제외",
    ],
    overallConfidence,
    finalComment,
    warnings: [...new Set(warnings)],
  };
}
