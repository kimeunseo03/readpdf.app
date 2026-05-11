import { UploadForm } from "@frontend/components/UploadForm";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-blue-600">
            PDF BREAKER MVP
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            등기부 자동 판독 및 가치평가
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            PDF 업로드 후 등기부 정보 추출, 권리 리스크 분석,
            실거래 기반 가치평가를 자동 수행합니다.
          </p>
        </div>

        <div className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm">
          내부 검토용
        </div>
      </div>

      <UploadForm />
    </main>
  );
}
