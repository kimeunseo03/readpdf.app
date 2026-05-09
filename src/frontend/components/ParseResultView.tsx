import type { ParseApiResponse } from "@frontend/lib/api";
import { ValuationForm } from "./ValuationForm";

function ConfidenceBadge({ value }: { value: number }) {
  const label = value >= 0.9 ? "높음" : value >= 0.75 ? "보통" : "검토 필요";
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {label} · {(value * 100).toFixed(0)}%
    </span>
  );
}

function FieldRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-slate-100 py-3 text-sm">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value === undefined || value === null || value === "" ? "-" : String(value)}</dd>
    </div>
  );
}

export function ParseResultView({ response }: { response: ParseApiResponse }) {
  const { parseResult, valuation, compliance } = response;
  const { property, rightsRisk, confidence, review, sourceEvidence, meta } = parseResult;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">판독 요약</h2>
            <p className="mt-1 text-sm text-slate-500">{parseResult.document.originalFileName}</p>
          </div>
          <ConfidenceBadge value={confidence.overall} />
        </div>

        <dl className="mt-5">
          <FieldRow label="문서 유형" value={parseResult.document.documentType} />
          <FieldRow label="등본 유형" value={parseResult.document.registryType} />
          <FieldRow label="페이지 수" value={parseResult.document.pageCount} />
          <FieldRow label="OCR 필요 여부" value={meta.ocrRequired ? "필요" : "불필요"} />
          <FieldRow label="수동 검토" value={review.manualReviewRequired ? "필요" : "불필요"} />
        </dl>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">물건 정보</h3>
        <dl className="mt-4">
          <FieldRow label="주소" value={property.addressRaw} />
          <FieldRow label="시도" value={property.sido} />
          <FieldRow label="시군구" value={property.sigungu} />
          <FieldRow label="읍면동" value={property.eupmyeondong} />
          <FieldRow label="건물명" value={property.buildingName} />
          <FieldRow label="동" value={property.buildingDong} />
          <FieldRow label="호수" value={property.unitNumber} />
          <FieldRow label="전유면적" value={property.exclusiveAreaM2 ? `${property.exclusiveAreaM2}㎡` : undefined} />
          <FieldRow label="대지권 비율" value={property.landRightRatio} />
        </dl>
      </section>
      
      <ValuationForm
  initialValue={{
    addressRaw: result.property.addressRaw,
    buildingName: result.property.buildingName,
    exclusiveAreaM2: result.property.exclusiveAreaM2
  }}
/>

      <ValuationForm
  initialValue={{
    addressRaw: property.addressRaw,
    buildingName: property.buildingName,
    exclusiveAreaM2: property.exclusiveAreaM2
  }}
/>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">권리관계 리스크 플래그</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {rightsRisk.riskFlags.length ? rightsRisk.riskFlags.map((flag) => (
            <span key={flag} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{flag}</span>
          )) : <span className="text-sm text-slate-500">탐지된 리스크 키워드 없음</span>}
        </div>
      </section>

      {review.manualReviewRequired && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h3 className="font-semibold text-amber-900">수동 검토 사유</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {review.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          {review.missingRequiredFields.length > 0 && (
            <p className="mt-3 text-sm text-amber-900">누락 필드: {review.missingRequiredFields.join(", ")}</p>
          )}
        </section>
      )}

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">원문 근거</h3>
        <div className="mt-4 space-y-3">
          {sourceEvidence.length ? sourceEvidence.map((item, index) => (
            <div key={`${item.field}-${index}`} className="rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-700">{item.field}</span>
                <span className="text-xs text-slate-500">p.{item.page} · {(item.confidence * 100).toFixed(0)}%</span>
              </div>
              <p className="text-slate-600">{item.textSnippet}</p>
            </div>
          )) : <p className="text-sm text-slate-500">표시할 근거 스니펫이 없습니다.</p>}
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">가치평가 모듈 연결 상태</h3>
        <p className="mt-2 text-sm text-slate-600">{valuation.message}</p>
        <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-50">
          {JSON.stringify(valuation.input ?? null, null, 2)}
        </pre>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">마스킹된 텍스트 미리보기</h3>
        <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">{meta.maskedTextPreview || "텍스트 없음"}</p>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">컴플라이언스</h3>
        <dl className="mt-4">
          <FieldRow label="허용 데이터만 사용" value={compliance.usesOnlyPermittedSources ? "예" : "아니오"} />
          <FieldRow label="무단 크롤링" value={compliance.prohibitedCrawlingDetected ? "탐지" : "없음"} />
          <FieldRow label="유료서비스 의존" value={compliance.paidServiceDependency ? "있음" : "없음"} />
        </dl>
      </section>
    </div>
  );
}
