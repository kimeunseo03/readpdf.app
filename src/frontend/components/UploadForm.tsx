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
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">PDF 업로드</h2>
        <p className="mt-2 text-sm text-slate-600">
          최대 10MB PDF만 처리합니다. 현재 1차 구현은 원본 파일을 저장하지 않고 요청 중 메모리에서만 판독합니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <span className="block text-sm font-medium text-slate-800">
              {file ? file.name : "등본 PDF 선택"}
            </span>
            <span className="mt-2 block text-xs text-slate-500">클릭해서 파일을 선택하세요.</span>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? "판독 중" : "PDF 판독 실행"}
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
