import { normalizeAddress } from "./normalizeAddress";
import { fetchPublicTransactions } from "./publicTransactionApi";
import { extractRegion } from "./extractRegion";
import { findLegalDongCode } from "./legalDongCode";

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

export async function estimateApartmentValue(
  input: ValuationInput
): Promise<ValuationResult> {
  const normalized = normalizeAddress(input);
  const region = extractRegion(normalized.normalizedAddress);
  const legalDongCode = findLegalDongCode(region);
  const warnings: string[] = [];

  if (!normalized.normalizedAddress) {
    warnings.push("주소 정보가 부족합니다.");
  }

  if (!normalized.area) {
    warnings.push("전용면적 정보가 부족합니다.");
  }

  if (!legalDongCode) {
    warnings.push(
      "법정동코드를 찾을 수 없습니다. 현재 하드코딩된 법정동코드 매핑 범위 밖 주소일 수 있습니다."
    );
  }

  const transactions = await fetchPublicTransactions({
    buildingName: normalized.buildingName,
    exclusiveAreaM2: normalized.area,
    region,
    legalDongCode,
    targetFloor: input.floor
  });

  const usedFallback = transactions.some((tx) =>
    tx.selectionReason?.includes("fallback")
  );
  const usedExpandedAreaRange = transactions.some((tx) =>
    tx.selectionReason?.includes("±5㎡") || tx.selectionReason?.includes("±10㎡")
  );
  const usedExpandedPeriod = transactions.some((tx) =>
    tx.selectionReason?.includes("24개월") || tx.selectionReason?.includes("36개월")
  );

  if (transactions.length === 0) {
    warnings.push(
      "조건에 맞는 실거래 비교군을 찾지 못했습니다. 주소, 단지명, 전용면적, 법정동코드 매핑 또는 API 키 설정을 확인하세요."
    );
  } else if (transactions.length < 3) {
    warnings.push(
      "비교 가능한 실거래 데이터가 3건 미만입니다. 결과 신뢰도가 낮을 수 있습니다."
    );
  }

  if (usedFallback) {
    warnings.push(
      "동일단지 거래가 부족하여 동일 법정동 fallback 비교군을 사용했습니다."
    );
  }

  if (usedExpandedAreaRange) {
    warnings.push(
      "거래 부족으로 전용면적 비교 범위를 ±5㎡ 또는 ±10㎡까지 자동 확장했습니다."
    );
  }

  if (usedExpandedPeriod) {
    warnings.push(
      "최근 12개월 거래가 부족하여 조회 기간을 24개월 또는 36개월까지 자동 확장했습니다."
    );
  }

  const originalPrices = transactions.map((t) => t.dealAmount * 10000);
  const filteredPriceSet = removeOutliersByIqr(originalPrices);

  const filteredTransactions = transactions.filter((tx) =>
    filteredPriceSet.includes(tx.dealAmount * 10000)
  );

  const excludedTransactions = transactions.filter(
    (tx) => !filteredPriceSet.includes(tx.dealAmount * 10000)
  );

  if (excludedTransactions.length > 0) {
    warnings.push(
      `${excludedTransactions.length}건의 이상 거래가가 IQR 기준으로 자동 제외되었습니다.`
    );
  }

  const filteredPrices = filteredTransactions.map((t) => t.dealAmount * 10000);
  const weights = filteredTransactions.map((t) => t.similarityScore ?? 50);

  const averageSimilarity = weights.length > 0 ? average(weights) : 0;
  const sameApartmentCount = filteredTransactions.filter(
    (tx) => tx.isSameApartment
  ).length;
  const recentTransactionCount = filteredTransactions.filter(
    (tx) => (tx.monthsAgo ?? 999) <= 6
  ).length;

  let confidenceScore = 0;
  confidenceScore += Math.min(filteredTransactions.length, 5) * 12;
  confidenceScore += averageSimilarity * 0.35;
  confidenceScore += sameApartmentCount > 0 ? 15 : 0;
  confidenceScore += recentTransactionCount >= 3 ? 10 : recentTransactionCount * 3;

  if (!sameApartmentCount && filteredTransactions.length > 0) {
    confidenceScore -= 10;
  }

  if (usedExpandedAreaRange) confidenceScore -= 8;
  if (usedExpandedPeriod) confidenceScore -= 6;
  if (usedFallback) confidenceScore -= 6;

  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  let overallConfidence: "A" | "B" | "C" = "C";

  if (confidenceScore >= 80) {
    overallConfidence = "A";
  } else if (confidenceScore >= 60) {
    overallConfidence = "B";
  }

  return {
    success: true,
    normalizedAddress: normalized.normalizedAddress,
    buildingName: normalized.buildingName,
    comparableCount: transactions.length,
    lowestPrice: filteredPrices.length ? Math.min(...filteredPrices) : undefined,
    highestPrice: filteredPrices.length ? Math.max(...filteredPrices) : undefined,
    averagePrice: filteredPrices.length
      ? weightedAverage(filteredPrices, weights)
      : undefined,
    recentTransactions: transactions,
    valuationBasis: [
      "국토교통부 아파트 매매 실거래가 자료 사용",
      "동일 단지 거래 우선 비교",
      "동일 단지 거래 부족 시 동일 법정동 fallback 거래 사용",
      "전용면적 ±3㎡ 우선, 거래 부족 시 ±5㎡/±10㎡ 자동 확장",
      "최근 12개월 우선, 거래 부족 시 24개월/36개월 자동 확장",
      "층수 유사도, 준공연도, 직거래 여부를 유사도 점수에 반영",
      "IQR 방식으로 극단 거래가 제거된 보정 평균가 사용"
    ],
    overallConfidence,
    warnings: [...new Set(warnings)]
  };
}
