import { normalizeAddress } from "./normalizeAddress";
import { fetchPublicTransactions } from "./publicTransactionApi";
import { extractRegion } from "./extractRegion";

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

export async function estimateApartmentValue(
  input: ValuationInput
): Promise<ValuationResult> {
  const normalized = normalizeAddress(input);
  const region = extractRegion(normalized.normalizedAddress);
  const warnings: string[] = [];

  if (!normalized.normalizedAddress) {
    warnings.push("주소 정보가 부족합니다.");
  }

  if (!normalized.area) {
    warnings.push("전용면적 정보가 부족합니다.");
  }

  const transactions = await fetchPublicTransactions({
    buildingName: normalized.buildingName,
    exclusiveAreaM2: normalized.area
  });

  const prices = transactions.map((t) => t.dealAmount);

  return {
    success: true,

    normalizedAddress: normalized.normalizedAddress,
    buildingName: normalized.buildingName,

    comparableCount: transactions.length,

    lowestPrice: prices.length ? Math.min(...prices) : undefined,
    highestPrice: prices.length ? Math.max(...prices) : undefined,
    averagePrice: prices.length ? average(prices) : undefined,

    recentTransactions: transactions,

    warnings
  };
}
