import type { TransactionItem } from "./types";

interface FetchParams {
  buildingName?: string;
  exclusiveAreaM2?: number;
}

/**
 * 현재는 Mock.
 * 다음 단계에서 국토부 실거래가 API 연결 예정.
 */
export async function fetchPublicTransactions(
  params: FetchParams
): Promise<TransactionItem[]> {
  const baseArea = params.exclusiveAreaM2 ?? 84;

  return [
    {
      dealAmount: 51000,
      dealYear: 2026,
      dealMonth: 3,
      dealDay: 12,
      area: baseArea,
      floor: 15
    },
    {
      dealAmount: 53000,
      dealYear: 2026,
      dealMonth: 2,
      dealDay: 2,
      area: baseArea,
      floor: 18
    },
    {
      dealAmount: 52000,
      dealYear: 2026,
      dealMonth: 1,
      dealDay: 21,
      area: baseArea,
      floor: 11
    }
  ];
}
