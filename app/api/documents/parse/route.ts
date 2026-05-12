import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { validatePdfFile } from "@backend/pdf/validatePdf";
import { extractTextFromPdf } from "@backend/pdf/extractText";
import { parseRegistryText } from "@backend/pdf/parseRegistryPdf";
import { getCompliancePolicy } from "@backend/compliance/dataSourcePolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file 필드에 PDF 파일을 첨부해야 합니다." }, { status: 400 });
    }

    const validation = validatePdfFile(file);
    if (!validation.isValidPdf) {
      return NextResponse.json({ error: "PDF 파일 검증에 실패했습니다.", validation }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extracted = await extractTextFromPdf(buffer);

    const parseResult = parseRegistryText({
      fileId: randomUUID(),
      originalFileName: file.name,
      text: extracted.text,
      pageCount: extracted.pageCount
    });

    return NextResponse.json({
      validation,
      parseResult,
      compliance: getCompliancePolicy()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      {
        error: "PDF 판독 중 오류가 발생했습니다.",
        detail: message,
        hint: "암호화 PDF, 손상 PDF, 이미지 기반 스캔본일 수 있습니다."
      },
      { status: 500 }
    );
  }
}
