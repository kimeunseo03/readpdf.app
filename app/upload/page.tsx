import Link from "next/link";
import { UploadForm } from "@frontend/components/UploadForm";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-blue-600">
            PDF BREAKER MVP
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            등기부 자동 판독 및 가치평가
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            PDF 업로드 후 등기부 정보 추출, 권리 리스크 분석,
            실거래 기반 가치평가를 자동 수행합니다.
          </p>
        </div>
      </div>
      <UploadForm />
    </main>
  );
}
