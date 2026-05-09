import pdfParse from "pdf-parse";

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
