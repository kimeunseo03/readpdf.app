import type { RegistryParseResult } from "@shared/types/registry";

export type ParseApiResponse = {
  validation: {
    isValidPdf: boolean;
    fileSizeMb: number;
    mimeType: string;
    reasons: string[];
  };
  parseResult: RegistryParseResult;
  valuation: {
    isReady: boolean;
    message: string;
    input?: unknown;
  };
  compliance: {
    usesOnlyPermittedSources: boolean;
    externalDataSources: string[];
    prohibitedCrawlingDetected: boolean;
    paidServiceDependency: boolean;
    prohibitedDataPractices: readonly string[];
  };
};

export async function parsePdf(file: File): Promise<ParseApiResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/documents/parse", {
    method: "POST",
    body: formData
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.detail || body.error || "PDF 판독 요청에 실패했습니다.");
  }

  return body as ParseApiResponse;
}
