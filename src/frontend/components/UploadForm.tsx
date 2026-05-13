"use client";
import { useState } from "react";
import { parsePdf, type ParseApiResponse } from "@frontend/lib/api";
import { ParseResultView } from "./ParseResultView";

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="space-y-6 print:block">
      <section className="card-surface no-print p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">PDF 업로드</h2>
            <p className="mt-2 text-sm text-slate-500">최대 10MB PDF만 처리합니다. 원본 파일은 저장하지 않습니다.</p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-3 xl:grid-cols-[minmax(360px,560px)_auto]">
            <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 px-5 py-4 transition hover:border-blue-400 hover:bg-blue-50">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
                  <span className="mt-1 block text-xs text-slate-500">클릭해서 PDF 파일을 선택하세요 · 최대 10MB</span>
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

        {/* 평가 기준 안내 - 실제 코드와 일치하도록 수정 */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-6 text-blue-900">
            <p className="font-semibold text-blue-900">평가 기준</p>
            <ul className="mt-2 grid gap-x-4 gap-y-1 lg:grid-cols-2">
              <li>· 국토교통부 아파트 매매 실거래가 자료 사용</li>
              <li>· 동일 법정동과 동일 단지 거래 우선 비교</li>
              <li>· 전용면적 ±3㎡ 비교군 우선 적용</li>
              <li>· 거래 부족 시 ±5㎡까지 확장</li>
              <li>· 최근 24개월 거래 사용</li>
              <li>· 직거래 제외 (시세 왜곡 방지)</li>
              <li>· IQR 방식으로 극단 거래가 제외</li>
              <li>· 근저당과 임차보증금 차감 반영</li>
              <li>· 최우선변제금은 참고값, 중복 차감 없음</li>
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
              주소 변환: 카카오 지오코딩 API → 행정안전부 법정동코드 API 순으로 조회합니다.
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
