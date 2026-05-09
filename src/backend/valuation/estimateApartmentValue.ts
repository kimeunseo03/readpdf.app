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
  warnings.push("법정동코드를 찾을 수 없습니다.");
}
  
  const transactions = await fetchPublicTransactions({
  buildingName: normalized.buildingName,
  exclusiveAreaM2: normalized.area,
  region,
  legalDongCode
});
  
  const prices = transactions.map((t) => t.dealAmount);
  const filteredPrices = removeOutliersByIqr(prices);

  return {
    success: true,

    normalizedAddress: normalized.normalizedAddress,
    buildingName: normalized.buildingName,

    comparableCount: transactions.length,

    lowestPrice: filteredPrices.length ? Math.min(...filteredPrices) : undefined,
    highestPrice: filteredPrices.length ? Math.max(...filteredPrices) : undefined,
    averagePrice: filteredPrices.length ? average(filteredPrices) : undefined,

    recentTransactions: transactions,
    valuationBasis: [
  "국토교통부 아파트 매매 실거래가 자료 사용",
  "동일 법정동 기준 조회",
  "전용면적 ±3㎡ 비교군 사용",
  "최근 12개월 거래 우선 사용",
  "IQR 방식으로 극단 거래가 제거된 보정 평균가 사용",
  "동일 단지 거래가 없는 경우 동일 법정동 유사 면적 거래를 fallback으로 사용"
],

    warnings
  };
}
