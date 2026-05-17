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

export interface ValuationInput {
  addressRaw?: string;
  roadAddress?: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
  floor?: number;
  coordinate?: Coordinate;

  tenantDepositAmount?: number;

  tenantMonthlyRent?: number;

  rightsRisk?: RightsRiskInput;
}

export interface TransactionItem {
  /**
   * 공공 실거래가 API 원본 기준 만원 단위.
   * 가치평가 계산 및 화면 표시는 원 단위로 변환한다.
   */
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
  /**
   * 대상 물건과 거래 단지 간 거리. 미터 단위.
   */
  distanceMeters?: number;
}

export interface PublicTransactionApiParams {
  legalDongCode?: string;
  dealYearMonth: string;

  buildingName?: string;
  exclusiveAreaM2?: number;
  areaToleranceM2?: number;

  targetFloor?: number;
  targetCoordinate?: Coordinate;

  targetBuildYear?: number;
  targetHouseholdCount?: number;
  targetKaptCode?: string;
  targetSubwayWalkMinutes?: number;
}

export interface ValuationResult {
  success: boolean;

  normalizedAddress?: string;
  buildingName?: string;
  addressBasisType?: "road" | "jibun";
  addressBasisLabel?: string;
  addressBasisAddress?: string;

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

export interface Coordinate {
  latitude: number;
  longitude: number;
}
