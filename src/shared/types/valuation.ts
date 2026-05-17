export type ValuationInput = {
  addressRaw: string;
  buildingName?: string;
  buildingDong?: string;
  unitNumber?: string;
  exclusiveAreaM2: number;
  floor?: number;
  approvalDate?: string;
  rightsRiskFlags: string[];
  parseConfidence: number;
};
