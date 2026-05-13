import { normalizeAddress } from "./normalizeAddress";
import { fetchPublicTransactions } from "./publicTransactionApi";
import { extractRegion } from "./extractRegion";
import { findLegalDongCode } from "./legalDongCode";
import { geocodeAddress } from "./geocodeApi";
import { fetchApartmentMetaInfoByLegalDong } from "./apartmentBasisInfoApi";
import type { ValuationInput, ValuationResult } from "./types";

function average(numbers: number[]) {
  if (!numbers.length) return 0;

  return Math.round(
    numbers.reduce((acc, cur) => acc + cur, 0) / numbers.length
  );
}

function weightedAverage(values: number[], weights: number[]) {
  if (!values.length || values.length !== weights.length) return 0;

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (!totalWeight) return average(values);

  const weightedSum = values.reduce((sum, value, index) => {
    return sum + value * weights[index];
  }, 0);

  return Math.round(weightedSum / totalWeight);
}

function removeOutliersByIqr(values: number[]) {
  if (values.length < 4) return values;

  const sorted = [...values].sort((a, b) => a - b);

  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;

  const lowerBound = q1 - iqr * 1.5;
  const upperBound = q3 + iqr * 1.5;

  return sorted.filter((value) => value >= lowerBound && value <= upperBound);
}

function parseKoreanMoneyTextToWon(value?: string) {
  if (!value) return 0;

  const numeric = Number(value.replace(/[^0-9]/g, ""));
  return numeric || 0;
}

function estimatePriorityRepaymentAmount(params: {
  tenantDepositAmount?: number;
  tenantMonthlyRent?: number;
}) {
  const deposit = params.tenantDepositAmount ?? 0;

  if (!deposit) return 0;

  return Math.min(deposit, 55_000_000);
}

function getSeniorMortgageAmount(input: ValuationInput) {
  const mortgages = input.rightsRisk?.mortgages ?? [];

  if (mortgages.length > 0) {
    return mortgages.reduce((sum, mortgage) => sum + mortgage.amount, 0);
  }

  return parseKoreanMoneyTextToWon(input.rightsRisk?.mortgageAmountText);
}

function formatWon(value: number) {
  return `${value.toLocaleString()}원`;
}

export async function estimateApartmentValue(
  input: ValuationInput
): Promise<ValuationResult> {
  const normalized = normalizeAddress(input);
  const region = extractRegion(normalized.normalizedAddress);
  console.log("valuation_region_debug", {
  addressRaw: normalized.normalizedAddress,
  region,
  });
  const legalDongCode = await findLegalDongCode(region);
  const warnings: string[] = [];
  const apartmentMeta = await fetchApartmentMetaInfoByLegalDong({
    legalDongCode,
    buildingName: normalized.buildingName
  });

  console.log("apartment_meta_lookup_result", {
    legalDongCode,
    buildingName: normalized.buildingName,
    kaptCode: apartmentMeta?.basis?.kaptCode,
    kaptName: apartmentMeta?.basis?.kaptName,
    householdCount: apartmentMeta?.basis?.householdCount
  });
  
if (!apartmentMeta?.basis?.kaptCode) {
  warnings.push(
    "공동주택 단지코드(kaptCode)를 찾지 못해 세대수·사용승인일 기반 보정이 제한됩니다."
  );
}
  const targetCoordinate = undefined;

  if (!normalized.normalizedAddress) {
    warnings.push("주소 정보가 부족합니다.");
  }

  if (!normalized.area) {
    warnings.push("전용면적 정보가 부족합니다.");
  }

 /* if (!targetCoordinate) {
  warnings.push(
    "주소 좌표 변환에 실패하여 거리 기반 비교가 제한됩니다."
  );
} */
  
  if (!legalDongCode) {
    warnings.push(
      "법정동코드를 찾을 수 없어 실거래가 조회 정확도가 낮습니다. 주소 또는 법정동코드 매핑을 확인하세요."
    );
  }

const transactions = await fetchPublicTransactions({
  buildingName: normalized.buildingName,
  exclusiveAreaM2: normalized.area,
  region,
  legalDongCode,
  targetFloor: input.floor,
  targetCoordinate,
  targetBuildYear: apartmentMeta?.basis?.buildYear,
  targetHouseholdCount: apartmentMeta?.basis?.householdCount,
  targetSubwayWalkMinutes: apartmentMeta?.detail?.subwayWalkingMinutes,
  targetKaptCode: apartmentMeta?.basis?.kaptCode
});
  
  const usedExpandedAreaRange = transactions.some((tx) =>
    tx.selectionReason?.includes("±5㎡")
  );

  if (usedExpandedAreaRange) {
    warnings.push(
      "동일단지·유사층 거래가 부족하여 전용면적 비교 범위를 ±5㎡까지 자동 확장했습니다."
    );
  }

  if (transactions.length === 0) {
    warnings.push(
      "조건에 맞는 실거래 비교군을 찾지 못했습니다. 단지명, 전용면적, 법정동코드 매핑을 확인하세요."
    );
  } else if (transactions.length < 3) {
    warnings.push(
      "비교 가능한 실거래 데이터가 3건 미만입니다. 결과 신뢰도가 낮을 수 있습니다."
    );
  }

  const originalPrices = transactions.map((t) => t.dealAmount * 10000);
  const filteredPriceSet = removeOutliersByIqr(originalPrices);

  const excludedTransactions = transactions.filter(
    (tx) => !filteredPriceSet.includes(tx.dealAmount * 10000)
  );

  const excludedReasons: string[] = [];

  excludedTransactions.forEach((tx) => {
    excludedReasons.push(
      `${tx.dealYear}.${String(tx.dealMonth).padStart(2, "0")}.${String(
        tx.dealDay
      ).padStart(2, "0")} 거래 (${formatWon(
        tx.dealAmount * 10000
      )}) 이상치 제외`
    );
  });

  const filteredTransactions = transactions.filter((tx) =>
    filteredPriceSet.includes(tx.dealAmount * 10000)
  );

  if (excludedTransactions.length > 0) {
    warnings.push(
      `${excludedTransactions.length}건의 이상 거래가가 IQR 기준으로 자동 제외되었습니다.`
    );

    excludedReasons.forEach((reason) => warnings.push(reason));
  }

  const filteredPrices = filteredTransactions.map(
    (t) => t.dealAmount * 10000
  );

  const weights = filteredTransactions.map((t) => t.similarityScore ?? 50);

  const weightedAveragePrice = filteredPrices.length
    ? weightedAverage(filteredPrices, weights)
    : undefined;

  const conservativePrice = filteredPrices.length
    ? Math.min(...filteredPrices)
    : undefined;

  const upperReferencePrice = filteredPrices.length
    ? Math.max(...filteredPrices)
    : undefined;

  const mortgages = input.rightsRisk?.mortgages ?? [];
  const seniorMortgageAmount = getSeniorMortgageAmount(input);

  const tenantDepositAmount = input.tenantDepositAmount ?? 0;
  const tenantMonthlyRent = input.tenantMonthlyRent ?? 0;

  const priorityRepaymentAmount = estimatePriorityRepaymentAmount({
    tenantDepositAmount,
    tenantMonthlyRent
  });

  const seniorDebtAmount = seniorMortgageAmount + tenantDepositAmount;

  const riskAdjustedPrice =
    weightedAveragePrice !== undefined
      ? Math.max(weightedAveragePrice - seniorDebtAmount, 0)
      : undefined;

  if (seniorMortgageAmount > 0) {
    warnings.push(
      `선순위 근저당 채권최고액 합계 ${formatWon(
        seniorMortgageAmount
      )}이 권리반영 기준가에 반영되었습니다.`
    );
  }

  if (tenantDepositAmount > 0) {
    warnings.push(
      `임차보증금 ${formatWon(
        tenantDepositAmount
      )}이 권리반영 기준가에 반영되었습니다.`
    );
  }

  if (priorityRepaymentAmount > 0) {
    warnings.push(
      `최우선변제금 추정액 ${formatWon(
        priorityRepaymentAmount
      )}은 임차보증금 중 우선변제 가능성이 있는 참고 금액입니다. 권리 차감액에는 임차보증금 전체가 반영되며, 최우선변제금은 중복 차감하지 않습니다.`
    );
  }

  const averageSimilarity = weights.length > 0 ? average(weights) : 0;

  const sameApartmentCount = filteredTransactions.filter(
    (tx) => tx.isSameApartment
  ).length;

  const recentTransactionCount = filteredTransactions.filter(
    (tx) => (tx.monthsAgo ?? 999) <= 6
  ).length;

  const excludedRatio =
    transactions.length > 0
      ? excludedTransactions.length / transactions.length
      : 0;

  let confidenceScore = 0;

  confidenceScore += Math.min(filteredTransactions.length, 5) * 12;
  confidenceScore += averageSimilarity * 0.35;
  confidenceScore += sameApartmentCount > 0 ? 15 : 0;
  confidenceScore +=
    recentTransactionCount >= 3 ? 10 : recentTransactionCount * 3;

  if (excludedRatio >= 0.4) {
    confidenceScore -= 15;
  } else if (excludedRatio >= 0.2) {
    confidenceScore -= 8;
  }

  const hasSameApartmentTransaction = filteredTransactions.some(
    (tx) => tx.isSameApartment
  );

  if (!hasSameApartmentTransaction) {
    confidenceScore -= 10;
  }

  const expandedAreaFallbackUsed = filteredTransactions.some((tx) =>
    tx.selectionReason?.includes("±5㎡")
  );

  if (expandedAreaFallbackUsed) {
    confidenceScore -= 8;
  }

  if (input.rightsRisk?.riskLevel === "CAUTION") {
    confidenceScore -= 5;
  }

  if (input.rightsRisk?.riskLevel === "DANGER") {
    confidenceScore -= 15;
  }

  if (seniorDebtAmount > 0) {
    confidenceScore -= 8;
  }

  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  let overallConfidence: "A" | "B" | "C" = "C";

  if (confidenceScore >= 80) {
    overallConfidence = "A";
  } else if (confidenceScore >= 60) {
    overallConfidence = "B";
  }

  if (input.rightsRisk?.riskLevel === "DANGER" && overallConfidence === "A") {
    overallConfidence = "B";
  }

  let finalComment = "";

  if (overallConfidence === "A") {
    finalComment =
      "비교 가능한 실거래 데이터가 충분하고 유사도가 높아 내부 참고가 신뢰도가 높은 편입니다.";
  } else if (overallConfidence === "B") {
    finalComment =
      "비교 가능한 실거래 데이터는 확보되었으나 일부 보정 요소가 있어 추가 검토가 권장됩니다.";
  } else {
    finalComment =
      "비교 가능한 실거래 데이터가 부족하거나 유사도가 낮아 보수적인 검토가 필요합니다.";
  }

  if (seniorDebtAmount > 0) {
    finalComment +=
      " 선순위 근저당 또는 임차 관련 금액을 반영한 권리반영 기준가를 함께 확인해야 합니다.";
  }

  if (input.rightsRisk?.riskLevel === "DANGER") {
    finalComment +=
      " 또한 고위험 권리관계가 감지되어 가격 검토와 별도로 권리분석 확인이 필요합니다.";
  } else if (input.rightsRisk?.riskLevel === "CAUTION") {
    finalComment +=
      " 권리관계상 주의 요소가 있어 관련 서류 확인이 필요합니다.";
  }

  if (input.rightsRisk?.riskLevel === "DANGER") {
    warnings.push("압류/가압류/신탁 등 고위험 권리관계가 감지되었습니다.");
  }

  if (input.rightsRisk?.riskLevel === "CAUTION") {
    warnings.push("근저당 또는 임차권/전세권 관련 권리관계 검토가 필요합니다.");
  }

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
      "동일단지 우선 비교",
      "유사 면적 비교",
      "층수 유사도 반영",
      ...(targetCoordinate ? ["거리 기반 비교 반영"] : []),
      ...(apartmentMeta?.basis?.kaptCode
        ? ["공동주택 단지코드 기반 동일단지 검증"]
        : []),
      ...(apartmentMeta?.basis?.buildYear
        ? ["사용승인연도 유사도 반영"]
        : []),
      ...(apartmentMeta?.basis?.householdCount
        ? ["세대수 규모 유사도 반영"]
        : []),
      ...(apartmentMeta?.detail?.subwayWalkingMinutes
        ? ["역세권 접근성 유사도 반영"]
        : [])
    ],

    overallConfidence,
    finalComment,
    warnings: [...new Set(warnings)]
  };
}
