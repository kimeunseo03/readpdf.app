export interface ValuationInput {
  addressRaw?: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
  tenantDepositAmount?: number;
  tenantMonthlyRent?: number;
  rightsRisk?: {
    riskLevel?: "SAFE" | "CAUTION" | "DANGER";
    mortgageAmountText?: string;
    riskScore?: number;  
  };
}

export interface TransactionItem {
  dealAmount: number;
  dealYear: number;
  dealMonth: number;
  dealDay: number;
  area: number;
  floor?: number;
  buildYear?: number;
  selectionReason?: string;
  isPriceOutlier?: boolean;

  isSameApartment?: boolean;
  areaDifferenceM2?: number;
  monthsAgo?: number;

  similarityScore?: number;
  similarityReason?: string;
  reliabilityGrade?: "A" | "B" | "C";
}

export interface PublicTransactionApiParams {
  legalDongCode?: string;
  dealYearMonth: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
  areaToleranceM2?: number;
}

export interface ValuationResult {
  success: boolean;

  normalizedAddress?: string;
  buildingName?: string;

  comparableCount: number;

  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;
  conservativePrice?: number;
  upperReferencePrice?: number;
  riskAdjustedPrice?: number;
  seniorDebtAmount?: number;
  tenantDepositAmount?: number;

  recentTransactions: TransactionItem[];

  valuationBasis: string[];
  overallConfidence?: "A" | "B" | "C";
  warnings: string[];
  finalComment?: string;
}
