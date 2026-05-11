export type RiskLevel = "SAFE" | "CAUTION" | "DANGER";
export type ReliabilityGrade = "A" | "B" | "C";

export interface RightsRiskInput {
  riskLevel?: RiskLevel;
  riskScore?: number;

  mortgageAmountText?: string;
  hasCancellationKeyword?: boolean;

  riskFlags?: string[];

  riskDetails?: {
    type: string;
    label: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    description: string;
  }[];
}

export interface ValuationInput {
  addressRaw?: string;
  buildingName?: string;
  exclusiveAreaM2?: number;

  /**
   * 만원 단위
   */
  tenantDepositAmount?: number;

  /**
   * 만원 단위
   */
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

  /**
   * 기준 참고가. 만원 단위.
   */
  averagePrice?: number;

  /**
   * 비교군 하위값. 임의 98% 할인 제거.
   */
  conservativePrice?: number;

  /**
   * 비교군 상위값. 임의 102% 할증 제거.
   */
  upperReferencePrice?: number;

  /**
   * 선순위 근저당 + 임차보증금 + 최우선변제금 반영 후 참고가.
   */
  riskAdjustedPrice?: number;

  /**
   * 권리 차감 합계. 만원 단위.
   */
  seniorDebtAmount?: number;

  /**
   * 선순위 근저당 채권최고액. 만원 단위.
   */
  seniorMortgageAmount?: number;

  /**
   * 임차보증금. 만원 단위.
   */
  tenantDepositAmount?: number;

  /**
   * 월세. 만원 단위.
   */
  tenantMonthlyRent?: number;

  /**
   * 추정 최우선변제금. 만원 단위.
   */
  priorityRepaymentAmount?: number;

  recentTransactions: TransactionItem[];

  valuationBasis: string[];
  overallConfidence?: ReliabilityGrade;
  warnings: string[];
  finalComment?: string;
}
