import type { ValuationInput } from "./types";

export function normalizeAddress(input: ValuationInput) {
  const address = input.addressRaw?.replace(/\s+/g, " ").trim();

  return {
    normalizedAddress: address,
    buildingName: input.buildingName?.trim(),
    area: input.exclusiveAreaM2
  };
}
