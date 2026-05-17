import { UploadForm } from "@frontend/components/UploadForm";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-5 pb-16 lg:px-8">

      {/* 상단 헤더 */}
      <header className="flex items-center justify-between border-b border-slate-200 py-4">
        <div className="flex items-center gap-3">
          <div className="h-7 w-1 rounded-full bg-blue-600" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
              등기부 자동 판독 및 가치평가
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              PDF 업로드 · 권리분석 · 실거래 기반 가치평가
            </p>
          </div>
        </div>
        <span className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
          내부 검토용
        </span>
      </header>

      <UploadForm />

      {/* 평가 기준 — 페이지 하단 */}
      <footer className="no-print mt-10 border-t border-slate-100 pt-6 pb-4">
        <p className="mb-3 text-[10px] font-bold tracking-widest text-slate-300 uppercase">평가 기준</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            "국토부 실거래가",
            "동일 단지 우선",
            "±3㎡ 비교군",
            "거래 부족 시 ±5㎡ 확장",
            "최근 24개월",
            "직거래 감점",
            "IQR 이상치 표기",
            "임차보증금 차감",
            "최우선변제금 추정",
            "거래 최신성 반영",
            "카카오 API → 법정동코드",
          ].map((tag) => (
            <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] text-slate-400">
              {tag}
            </span>
          ))}
        </div>
      </footer>
    </main>
  );
}
