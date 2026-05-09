export type PdfValidationResult = {
  isValidPdf: boolean;
  fileSizeMb: number;
  mimeType: string;
  reasons: string[];
};

const MAX_FILE_SIZE_MB = 10;

export function validatePdfFile(file: File): PdfValidationResult {
  const fileSizeMb = file.size / 1024 / 1024;
  const reasons: string[] = [];

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    reasons.push("PDF 확장자 파일만 업로드할 수 있습니다.");
  }

  if (file.type && file.type !== "application/pdf") {
    reasons.push(`MIME type이 application/pdf가 아닙니다: ${file.type}`);
  }

  if (fileSizeMb > MAX_FILE_SIZE_MB) {
    reasons.push(`파일 용량이 ${MAX_FILE_SIZE_MB}MB를 초과합니다.`);
  }

  return {
    isValidPdf: reasons.length === 0,
    fileSizeMb: Number(fileSizeMb.toFixed(2)),
    mimeType: file.type || "unknown",
    reasons
  };
}
