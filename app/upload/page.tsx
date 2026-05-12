import Link from "next/link";
import { UploadForm } from "@frontend/components/UploadForm";

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">PDF Reader MVP</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">등본 PDF 판독</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">처음으로</Link>
      </div>
      <UploadForm />
    </main>
  );
}
