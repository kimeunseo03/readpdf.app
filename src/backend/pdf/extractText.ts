// pdf-parse 메인 엔트리는 로드 시 테스트 PDF를 열려는 코드가 있어
// 번들러 환경에서 ENOENT 오류를 일으킬 수 있음 → 라이브러리 본체만 직접 임포트
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as typeof import("pdf-parse").default;

export type ExtractedPdfText = {
  text: string;
  pageCount: number;
  info?: Record<string, unknown>;
};

export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractedPdfText> {
  const data = await pdfParse(buffer);

  return {
    text: data.text || "",
    pageCount: data.numpages || 0,
    info: data.info as Record<string, unknown> | undefined
  };
}
