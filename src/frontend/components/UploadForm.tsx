/**
 * UploadForm — PDF 업로드 진입점 컴포넌트
 * ─────────────────────────────────────────────────
 * 흐름: 파일 선택(드래그&드롭) → /api/documents/parse 호출
 *       → ParseResultView로 결과 전달
 *
 * 상태:
 *   file     : 선택된 PDF File 객체
 *   result   : API 응답 (ParseApiResponse)
 *   isLoading: 판독 진행 중 여부
 *   error    : 유효성 검사 / API 오류 메시지
 *
 * 진행 단계(스텝바):
 *   1 PDF 업로드 → 2 등기부 판독 → 3 실거래 조회
 *   모바일: 상단 가로, 데스크탑: 우측 중앙 고정 세로
 * ─────────────────────────────────────────────────
 */
"use client";
import { useState } from "react";
import { parsePdf, type ParseApiResponse } from "@frontend/lib/api";
import { ParseResultView } from "./ParseResultView";

// ── 진행 스텝바 ──────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: "PDF 업로드" },
  { num: 2, label: "등기부 판독" },
  { num: 3, label: "실거래 조회" },
];

const CheckIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

/** 모바일: 상단 가로 스텝바 */
function HorizontalStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav className="no-print lg:hidden flex items-start justify-center gap-0 py-4">
      {STEPS.map((step, i) => {
        const done   = step.num < current;
        const active = step.num === current;
        return (
          <div key={step.num} className="flex items-start">
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ring-2 transition-all ${
                done   ? "bg-blue-600 text-white ring-blue-600" :
                active ? "bg-blue-600 text-white ring-blue-200 ring-4" :
                         "bg-slate-100 text-slate-400 ring-slate-100"
              }`}>
                {done ? <CheckIcon /> : step.num}
              </div>
              <span className={`mt-1.5 text-[11px] font-semibold whitespace-nowrap ${
                active ? "text-blue-600" : done ? "text-slate-500" : "text-slate-300"
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-3 mt-4 h-0.5 w-12 flex-shrink-0 transition-colors ${
                step.num < current ? "bg-blue-500" : "bg-slate-200"
              }`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** 데스크탑: 세로 스텝바 (우측 sticky 사이드바용) */
function VerticalStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav className="no-print">
      <p className="mb-4 text-[10px] font-bold tracking-widest text-slate-300 uppercase">진행 단계</p>
      {STEPS.map((step, i) => {
        const done   = step.num < current;
        const active = step.num === current;
        return (
          <div key={step.num} className="relative flex gap-3 pb-7 last:pb-0">
            {/* 세로 연결선 */}
            {i < STEPS.length - 1 && (
              <div className={`absolute left-[15px] top-8 w-0.5 h-full transition-colors ${
                done ? "bg-blue-400" : "bg-slate-200"
              }`} />
            )}
            {/* 원형 */}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 transition-all ${
              done   ? "bg-blue-600 text-white ring-blue-600" :
              active ? "bg-blue-600 text-white ring-blue-200 ring-4" :
                       "bg-slate-100 text-slate-400 ring-slate-100"
            }`}>
              {done ? <CheckIcon /> : step.num}
            </div>
            {/* 라벨 */}
            <div className="pt-1">
              <p className={`text-xs font-semibold leading-tight ${
                active ? "text-blue-600" : done ? "text-slate-600" : "text-slate-300"
              }`}>{step.label}</p>
              {active && <p className="mt-0.5 text-[10px] text-blue-400">진행 중</p>}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(nextFile?: File | null) {
    setError(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!isPdfFile(nextFile)) {
      setFile(null);
      setError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setError("10MB 이하 PDF 파일만 업로드할 수 있습니다.");
      return;
    }

    setFile(nextFile);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError("PDF 파일을 선택하세요."); return; }
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await parsePdf(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  // 현재 스텝 결정
  const currentStep: 1 | 2 | 3 = result ? 3 : isLoading ? 2 : 1;

  // 업로드 카드 — 판독 전(단독) · 판독 후(좌측 슬롯) 양쪽에서 재사용
  const uploadCard = (
    <section className="no-print rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 카드 헤더 */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="h-5 w-0.5 rounded-full bg-blue-500" />
        <div>
          <p className="text-[10px] font-bold tracking-widest text-blue-500 uppercase leading-none">Document Upload</p>
          <h2 className="mt-1 text-base font-bold text-slate-900 leading-none">등기부등본 업로드</h2>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* 드래그 & 드롭 존 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
              isDragging
                ? "border-blue-400 bg-blue-50"
                : file
                ? "border-blue-300 bg-blue-50/60"
                : "border-slate-200 bg-slate-50/50 hover:border-blue-300 hover:bg-blue-50/40"
            }`}
          >
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
            />
            {/* 아이콘 */}
            <div className={`shrink-0 rounded-full p-2 ${file ? "bg-blue-100" : "bg-slate-100"}`}>
              {file ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </div>
            {/* 텍스트 */}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold truncate ${file ? "text-blue-700" : "text-slate-600"}`}>
                {file ? file.name : "PDF를 드래그하거나 클릭해서 선택"}
              </p>
              <p className="text-xs text-slate-400">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB · 다시 선택`
                  : "등기부등본 PDF · 최대 10MB"}
              </p>
            </div>
          </label>

          <button
            type="submit"
            disabled={isLoading || !file}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            {isLoading ? "판독 중..." : "PDF 판독 실행"}
          </button>
        </form>

        {/* 에러 */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="print:block">
      {/* 스텝바: 판독 전에는 모바일 전용 (데스크탑은 우측 aside), 판독 후에는 전체 화면 */}
      <HorizontalStepper current={currentStep} />

      {result ? (
        /* 판독 완료: ParseResultView가 2분할 레이아웃 담당 (업로드 카드를 좌측 슬롯으로 전달) */
        <ParseResultView response={result} uploadSlot={uploadCard} />
      ) : (
        /* 판독 전: 업로드 카드 + 플레이스홀더 + 데스크탑 세로 스텝바 */
        <div className="lg:flex lg:gap-8">
          <div className="flex-1 min-w-0 space-y-6">
            {uploadCard}
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-14 text-sm text-slate-400">
              PDF를 업로드하면 판독 결과가 여기에 표시됩니다.
            </div>
          </div>
          {/* 데스크탑 우측 세로 스텝바 (sticky — fixed 사용 시 overflow-x:hidden 클리핑 버그) */}
          <aside className="no-print hidden lg:block w-28 shrink-0">
            <div className="sticky top-1/3">
              <VerticalStepper current={currentStep} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
