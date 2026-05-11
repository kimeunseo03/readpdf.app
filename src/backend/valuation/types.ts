export type RiskLevel = "SAFE" | "CAUTION" | "DANGER";
export type ReliabilityGrade = "A" | "B" | "C";

export interface MortgageItem {
  rank: number;
  creditor: string;

  /**
   * 원 단위
   */
  amount: number;
}

export interface RightsRiskInput {
  riskLevel?: RiskLevel;
  riskScore?: number;

  /**
   * 기존 단일 추출 문자열. 하위 호환용.
   */
  mortgageAmountText?: string;

  /**
   * 근저당권 현황. 원 단위.
   */
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
  buildingName?: string;
  exclusiveAreaM2?: number;

  /**
   * 원 단위
   */
  tenantDepositAmount?: number;

  /**
   * 원 단위
   */
  tenantMonthlyRent?: number;

  rightsRisk?: RightsRiskInput;
}

export interface TransactionItem {
  /**
   * 실거래가. 원 단위.
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

  /**
   * 원 단위
   */
  lowestPrice?: number;

  /**
   * 원 단위
   */
  highestPrice?: number;

  /**
   * 기준 참고가. 원 단위.
   */
  averagePrice?: number;

  /**
   * 비교군 하위값. 원 단위.
   */
  conservativePrice?: number;

  /**
   * 비교군 상위값. 원 단위.
   */
  upperReferencePrice?: number;

  /**
   * 선순위 근저당 및 임차보증금 차감 후 참고가. 원 단위.
   */
  riskAdjustedPrice?: number;

  /**
   * 권리 차감 합계. 원 단위.
   */
  seniorDebtAmount?: number;

  /**
   * 선순위 근저당 채권최고액 합계. 원 단위.
   */
  seniorMortgageAmount?: number;

  /**
   * 근저당권 현황. 원 단위.
   */
  mortgages?: MortgageItem[];

  /**
   * 임차보증금. 원 단위.
   */
  tenantDepositAmount?: number;

  /**
   * 월세. 원 단위.
   */
  tenantMonthlyRent?: number;

  /**
   * 추정 최우선변제금. 원 단위.
   */
  priorityRepaymentAmount?: number;

  recentTransactions: TransactionItem[];

  valuationBasis: string[];
  overallConfidence?: ReliabilityGrade;
  warnings: string[];
  finalComment?: string;
}
