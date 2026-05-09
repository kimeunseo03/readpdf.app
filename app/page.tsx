import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <section className="rounded-3xl border bg-white p-10 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-500">Internal MVP</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          등본 PDF 판독 시스템
        </h1>
        <p className="mt-4 max-w-3xl text-slate-600">
          업로드된 등본 PDF에서 텍스트를 추출하고, 주소·동호수·전유면적·권리관계 리스크 플래그를 구조화합니다.
          원본 PDF는 저장하지 않으며, 결과는 내부 검토용 JSON으로만 반환합니다.
        </p>
        <div className="mt-8">
          <Link
            href="/upload"
            className="inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
          >
            PDF 업로드 시작
          </Link>
        </div>
      </section>
    </main>
  );
}
