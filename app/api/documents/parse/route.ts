/**
 * POST /api/documents/parse
 * ─────────────────────────────────────────────────
 * 등기부등본 PDF → 구조화 데이터 변환
 *
 * 처리 순서:
 *   1. multipart/form-data에서 file 추출
 *   2. validatePdfFile: MIME·확장자·크기 검증 (max 10MB)
 *   3. hasPdfMagicBytes: %PDF 시그니처 바이트 확인
 *   4. extractTextFromPdf: pdf-parse로 텍스트 추출
 *   5. parseRegistryText: 정규식 기반 필드 파싱
 *      → 주소, 면적, 층, 근저당, 임차권 등
 *
 * 보안:
 *   - PDF 파일은 메모리에서만 처리, 서버 디스크 저장 없음
 *   - 파일명·내용 로그 기록 없음 (에러 메시지만 로그)
 * ─────────────────────────────────────────────────
 */
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { validatePdfFile, hasPdfMagicBytes } from "@backend/pdf/validatePdf";
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

    if (!hasPdfMagicBytes(buffer)) {
      return NextResponse.json({ error: "올바른 PDF 파일이 아닙니다." }, { status: 400 });
    }

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
    const msg = error instanceof Error ? error.message : String(error);
    console.error("pdf_parse_error", msg);
    return NextResponse.json(
      {
        error: "PDF 판독 중 오류가 발생했습니다.",
        detail: msg,
        hint: "암호화 PDF, 손상 PDF, 이미지 기반 스캔본일 수 있습니다."
      },
      { status: 500 }
    );
  }
}
