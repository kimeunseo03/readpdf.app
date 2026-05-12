export type RiskLevel = "SAFE" | "CAUTION" | "DANGER";
export type ReliabilityGrade = "A" | "B" | "C";

export interface MortgageItem {
  rank: number;
  creditor: string;
  amount: number;
  targetOwner?: string;
}

export interface RightsRiskInput {
  riskLevel?: RiskLevel;
  riskScore?: number;
  mortgageAmountText?: string;
  mortgages?: MortgageItem[];
  hasCancellationKeyword?: boolean;
  riskFlags?: string[];
  riskDetails?: {
    type: string;
    label: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
  }[];
  summary?: string;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface ValuationInput {
  addressRaw?: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
  floor?: number;
  coordinate?: Coordinate;
  tenantDepositAmount?: number;
  tenantMonthlyRent?: number;
  rightsRisk?: RightsRiskInput;
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
  reliabilityGrade?: ReliabilityGrade;
  distanceMeters?: number;
}

export interface PublicTransactionApiParams {
  legalDongCode?: string;
  dealYearMonth: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
  areaToleranceM2?: number;
  allowedMonths?: number;
  targetFloor?: number;
  targetCoordinate?: Coordinate;
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
  seniorMortgageAmount?: number;
  mortgages?: MortgageItem[];
  tenantDepositAmount?: number;
  tenantMonthlyRent?: number;
  priorityRepaymentAmount?: number;
  recentTransactions: TransactionItem[];
  valuationBasis: string[];
  overallConfidence?: ReliabilityGrade;
  warnings: string[];
  finalComment?: string;
}
