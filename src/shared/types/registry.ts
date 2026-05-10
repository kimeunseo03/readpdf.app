export type TextExtractionMethod = "native_pdf_text" | "ocr" | "hybrid";

export type RegistryParseResult = {
  document: {
    fileId: string;
    originalFileName: string;
    pageCount: number;
    documentType: "real_estate_registry" | "unknown";
    registryType?: "collective_building" | "land" | "building" | "unknown";
    textExtractionMethod: TextExtractionMethod;
    parsedAt: string;
  };
  property: {
    addressRaw?: string;
    sido?: string;
    sigungu?: string;
    eupmyeondong?: string;
    roadAddress?: string;
    lotNumberAddress?: string;
    buildingName?: string;
    buildingDong?: string;
    unitNumber?: string;
    exclusiveAreaM2?: number;
    landRightRatio?: string;
    floor?: number;
    approvalDate?: string;
  };
  rightsRisk: {
    hasMortgage?: boolean;
    hasSeizure?: boolean;
    hasProvisionalSeizure?: boolean;
    hasLeaseholdRight?: boolean;
    hasTrust?: boolean;
    coOwnerCount?: number;
    riskFlags: string[];
    riskLevel?: "SAFE" | "CAUTION" | "DANGER";
  };
  confidence: {
    overall: number;
    documentType: number;
    address: number;
    area: number;
    rightsRisk: number;
  };
  review: {
    manualReviewRequired: boolean;
    reasons: string[];
    missingRequiredFields: string[];
  };
  sourceEvidence: Array<{
    field: string;
    page: number;
    textSnippet: string;
    confidence: number;
  }>;
  meta: {
    ocrRequired: boolean;
    maskedTextPreview: string;
    warnings: string[];
  };
};

export type ReviewTask = {
  fileId: string;
  manualReviewRequired: boolean;
  reasons: string[];
  fieldsToReview: string[];
  createdAt: string;
};
