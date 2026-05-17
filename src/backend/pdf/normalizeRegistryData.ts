import type { RegistryParseResult } from "@shared/types/registry";
import type { ValuationInput } from "@shared/types/valuation";

export function toValuationInput(result: RegistryParseResult): ValuationInput | null {
  const { property, rightsRisk, confidence } = result;

  if (!property.addressRaw || !property.exclusiveAreaM2) {
    return null;
  }

  return {
    addressRaw: property.addressRaw,
    buildingName: property.buildingName,
    buildingDong: property.buildingDong,
    unitNumber: property.unitNumber,
    exclusiveAreaM2: property.exclusiveAreaM2,
    floor: property.floor,
    approvalDate: property.approvalDate,
    rightsRiskFlags: rightsRisk.riskFlags,
    parseConfidence: confidence.overall
  };
}
