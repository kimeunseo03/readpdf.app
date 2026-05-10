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
    if (!file) {
      setError("PDF 파일을 선택하세요.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const parsed = await parsePdf(file);
      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
      <section className="card-surface p-6">
        <h2 className="text-lg font-semibold text-slate-900">PDF 업로드</h2>
        <p className="mt-2 text-sm text-slate-500">
          최대 10MB PDF만 처리합니다. 원본 파일은 저장하지 않습니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
  <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center transition hover:border-blue-400 hover:bg-blue-50">
    <input
      type="file"
      accept="application/pdf,.pdf"
      className="hidden"
      onChange={(event) =>
        setFile(event.target.files?.[0] ?? null)
      }
    />

    <div className="flex flex-col items-center justify-center">
      <div className="mb-3 rounded-full bg-blue-100 p-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      </div>

      <span className="block text-sm font-semibold text-slate-800">
        {file
          ? file.name
          : "등기부등본 PDF 업로드"}
      </span>

      <span className="mt-2 block text-xs text-slate-500">
        클릭해서 PDF 파일을 선택하세요
      </span>

      <span className="mt-1 block text-[11px] text-slate-400">
        최대 10MB · PDF만 지원
      </span>
    </div>
  </label>
         <button
            type="submit"
            disabled={loading || !file}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "판독 중..." : "PDF 판독 실행"}
          </button>
        </form>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">
          <p className="font-semibold text-slate-800">내부 정책</p>
          <p>KB부동산 등 유료 서비스 데이터, 로그인 우회, 무단 크롤링, 화면 캡처 자동화는 사용하지 않습니다.</p>
        </div>
      </section>

      <section>
        {result ? (
          <ParseResultView response={result} />
        ) : (
          <div className="rounded-3xl border bg-white p-8 text-sm text-slate-500 shadow-sm">
            판독 결과가 여기에 표시됩니다.
          </div>
        )}
      </section>
    </div>
  );
}
