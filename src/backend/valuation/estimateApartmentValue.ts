import { normalizeAddress } from "./normalizeAddress";
import { fetchPublicTransactions } from "./publicTransactionApi";
import { extractRegion } from "./extractRegion";
import { findLegalDongCode } from "./legalDongCode";

import type {
  TransactionItem,
  ValuationInput,
  ValuationResult
} from "./types";

function average(numbers: number[]) {
  if (!numbers.length) return 0;

  return Math.round(
    numbers.reduce((acc, cur) => acc + cur, 0) / numbers.length
  );
}
function weightedAverage(
  values: number[],
  weights: number[]
) {
  if (!values.length || values.length !== weights.length) {
    return 0;
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (!totalWeight) {
    return average(values);
  }

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
  warnings.push("법정동코드를 찾을 수 없어 실거래가 조회 정확도가 낮습니다. 주소 또는 법정동코드 매핑을 확인하세요.");
}
  
  const transactions = await fetchPublicTransactions({
  buildingName: normalized.buildingName,
  exclusiveAreaM2: normalized.area,
  region,
  legalDongCode
});

  if (transactions.length === 0) {
  warnings.push(
    "조건에 맞는 실거래 비교군을 찾지 못했습니다. 단지명, 전용면적, 법정동코드 매핑을 확인하세요."
  );
} else if (transactions.length < 3) {
  warnings.push(
    "비교 가능한 실거래 데이터가 3건 미만입니다. 결과 신뢰도가 낮을 수 있습니다."
  );
}
  
  const originalPrices = transactions.map(
  (t) => t.dealAmount
);

  const filteredPriceSet = removeOutliersByIqr(
    originalPrices
  );
  
  const excludedTransactions = transactions.filter(
    (tx) => !filteredPriceSet.includes(tx.dealAmount)
  );
  
  const averagePriceBeforeOutlier =
    originalPrices.length > 0 ? average(originalPrices) : 0;
  
  const abnormalPriceTransactions = transactions.filter((tx) => {
    if (!averagePriceBeforeOutlier) return false;
  
    const diffRatio =
      Math.abs(tx.dealAmount - averagePriceBeforeOutlier) /
      averagePriceBeforeOutlier;
  
    return diffRatio >= 0.4;
  });
  
  const excludedReasons: string[] = [];

  excludedTransactions.forEach((tx) => {
    excludedReasons.push(
      `${tx.dealYear}.${String(tx.dealMonth).padStart(2, "0")}.${String(tx.dealDay).padStart(2, "0")} 거래 (${tx.dealAmount.toLocaleString()}만원) 이상치 제외`
    );
  });
    
  const filteredTransactions = transactions.filter(
    (tx) => filteredPriceSet.includes(tx.dealAmount)
  );
  
  if (excludedTransactions.length > 0) {
    warnings.push(
      `${excludedTransactions.length}건의 이상 거래가가 자동 제외되었습니다.`
    );
  
    excludedReasons.forEach((reason) => {
      warnings.push(reason);
    });
  }

  if (abnormalPriceTransactions.length > 0) {
  warnings.push(
    `${abnormalPriceTransactions.length}건의 평균 대비 40% 이상 차이 거래가 감지되었습니다.`
  );
}
  
  const filteredPrices = filteredTransactions.map(
    (t) => t.dealAmount
  );
  
  const weights = filteredTransactions.map(
    (t) => t.similarityScore ?? 50
  );

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
confidenceScore += recentTransactionCount >= 3 ? 10 : recentTransactionCount * 3;

if (excludedRatio >= 0.4) {
  confidenceScore -= 15;
} else if (excludedRatio >= 0.2) {
  confidenceScore -= 8;
}

if (input.rightsRisk?.riskLevel === "CAUTION") {
  confidenceScore -= 5;
}

if (input.rightsRisk?.riskLevel === "DANGER") {
  confidenceScore -= 15;
}

confidenceScore = Math.max(0, Math.min(100, confidenceScore));

let overallConfidence: "A" | "B" | "C" = "C";

if (confidenceScore >= 80) {
  overallConfidence = "A";
} else if (confidenceScore >= 60) {
  overallConfidence = "B";
}

if (
  input.rightsRisk?.riskLevel === "DANGER" &&
  overallConfidence === "A"
) {
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
    averagePrice: filteredPrices.length ? weightedAverage(filteredPrices, weights) : undefined,

    recentTransactions: transactions,
    valuationBasis: [
      "국토교통부 아파트 매매 실거래가 자료 사용",
      "동일 법정동 기준 조회",
      "전용면적 ±3㎡ 비교군 사용",
      "최근 12개월 거래 우선 사용",
      "동일 단지 거래는 높은 가중치로 반영",
      "최근 3개월 및 6개월 이내 거래는 추가 가중치 반영",
      "층수와 준공연도를 유사도 점수에 반영",
      "거래 부족 시 전용면적 허용 범위를 ±3㎡ → ±5㎡ → ±8㎡ 순서로 자동 확장",
      "평균 대비 40% 이상 차이 거래는 추가 검토 대상으로 표시",
      "IQR 방식으로 극단 거래가 제거된 보정 평균가 사용",
      "동일 단지 거래가 없는 경우 동일 법정동 유사 면적 거래를 fallback으로 사용"
    ],
    overallConfidence,
    finalComment,
    warnings
  };
}
