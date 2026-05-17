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

// 파일 앞 5바이트가 "%PDF-" 인지 확인 (실제 PDF 파일인지 검증)
export function hasPdfMagicBytes(buffer: Buffer): boolean {
  return (
    buffer.length >= 5 &&
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2D    // -
  );
}
