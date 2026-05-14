"use client";
import { useState } from "react";
import { parsePdf, type ParseApiResponse } from "@frontend/lib/api";
import { ParseResultView } from "./ParseResultView";

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

  return (
    <div className="space-y-6 print:block">
      <section className="card-surface no-print p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">PDF 업로드</h2>
            <p className="mt-2 text-sm text-slate-500">최대 10MB PDF만 처리합니다. 원본 파일은 저장하지 않습니다.</p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-3 xl:grid-cols-[minmax(420px,620px)_auto]">
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`block cursor-pointer rounded-2xl border-2 border-dashed px-5 py-4 transition ${
                isDragging
                  ? "border-blue-500 bg-blue-100/70"
                  : "border-blue-200 bg-blue-50/40 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-3">
                <div className="shrink-0 rounded-full bg-blue-100 p-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {file ? file.name : "등기부등본 PDF 업로드"}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    클릭해서 선택하거나 PDF를 이 영역에 드래그하세요 · 최대 10MB
                  </span>
                </div>
              </div>
            </label>
            <button
              type="submit"
              disabled={isLoading || !file}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "판독 중..." : "PDF 판독 실행"}
            </button>
          </form>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-6 text-blue-900">
            <p className="font-semibold text-blue-900">평가 기준</p>
            <ul className="mt-2 grid gap-x-4 gap-y-1 lg:grid-cols-2">
              <li>· 국토교통부 아파트 매매 실거래가 자료 사용</li>
              <li>· 동일 지역과 동일 단지 거래 우선 비교</li>
              <li>· 전용면적 ±3㎡ 비교군 우선 적용</li>
              <li>· 거래 부족 시 ±5㎡까지 확장</li>
              <li>· 최근 24개월 거래 사용</li>
              <li>· 직거래 감점 반영</li>
              <li>· IQR 방식으로 극단 거래가 제외</li>
              <li>· 임차보증금 차감 반영</li>
              <li>· 근저당 자동 추출값은 검증 중</li>
              <li>· 거래 시점 최신성 유사도 반영</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
            <p className="font-semibold text-slate-800">내부 정책</p>
            <p className="mt-2">
              KB부동산 등 유료 서비스 데이터, 로그인 우회, 무단 크롤링,
              화면 캡처 자동화는 사용하지 않습니다.
            </p>
            <p className="mt-2">
              주소 변환: 카카오 주소검색 API → 행정안전부 법정동코드 API 순으로 조회합니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}
      </section>

      {result ? (
        <ParseResultView response={result} />
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          판독 결과가 여기에 표시됩니다.
        </div>
      )}
    </div>
  );
}
