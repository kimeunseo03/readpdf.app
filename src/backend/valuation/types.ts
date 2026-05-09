export interface ValuationInput {
  addressRaw?: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
}

export interface TransactionItem {
  dealAmount: number;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  area: number;
  floor?: number;
  
  similarityScore?: number;
  similarityReason?: string;
  reliabilityGrade?: "A" | "B" | "C";
}

export interface PublicTransactionApiParams {
  legalDongCode?: string;
  dealYearMonth: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
}

export interface ValuationResult {
  success: boolean;

  normalizedAddress?: string;
  buildingName?: string;

  comparableCount: number;

  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;

  recentTransactions: TransactionItem[];
  
  valuationBasis: string[];
  overallConfidence?: "A" | "B" | "C";
  warnings: string[];
}
