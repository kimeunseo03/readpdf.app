import type { ParseApiResponse } from "@frontend/lib/api";
import { ValuationForm } from "./ValuationForm";

function ConfidenceBadge({ value }: { value: number }) {
  const label = value >= 0.9 ? "높음" : value >= 0.75 ? "보통" : "검토 필요";

  return (
    <span
      className={
        value >= 0.9
          ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
          : value >= 0.75
          ? "rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
          : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
      }
    >
      {label} · {(value * 100).toFixed(0)}%
    </span>
  );
}

function FieldRow({
  label,
  value
}: {
  label: string;
  value?: string | number | boolean | null;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 border-b border-slate-100 py-3.5 text-sm last:border-b-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="text-slate-900">
        {value === undefined || value === null || value === ""
          ? "-"
          : String(value)}
      </dd>
    </div>
  );
}

export function ParseResultView({ response }: { response: ParseApiResponse }) {
  const { parseResult } = response;
  const { property, rightsRisk, confidence, review, meta } = parseResult;

  return (
    <div className="space-y-6">
      <section className="card-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">판독 요약</h2>
            <p className="mt-1 text-sm text-slate-500">
              {parseResult.document.originalFileName}
            </p>
          </div>

          <ConfidenceBadge value={confidence.overall} />
        </div>

        <dl className="mt-5">
          <FieldRow label="문서 유형" value={parseResult.document.documentType} />
          <FieldRow label="등본 유형" value={parseResult.document.registryType} />
          <FieldRow label="페이지 수" value={parseResult.document.pageCount} />
          <FieldRow
            label="OCR 필요 여부"
            value={meta.ocrRequired ? "필요" : "불필요"}
          />
          <FieldRow
            label="수동 검토"
            value={review.manualReviewRequired ? "필요" : "불필요"}
          />
        </dl>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">물건 정보</h3>
        <p className="mt-1 text-sm text-slate-500">
          등기부에서 추출한 기본 물건 정보입니다. 가치평가 전 수정이 필요하면 아래 입력값에서 조정하세요.
        </p>

        <dl className="mt-4">
          <FieldRow label="주소" value={property.addressRaw} />
          <FieldRow label="시도" value={property.sido} />
          <FieldRow label="시군구" value={property.sigungu} />
          <FieldRow label="읍면동" value={property.eupmyeondong} />
          <FieldRow label="건물명" value={property.buildingName} />
          <FieldRow label="동" value={property.buildingDong} />
          <FieldRow label="호수" value={property.unitNumber} />
          <FieldRow
            label="전유면적"
            value={
              property.exclusiveAreaM2
                ? `${property.exclusiveAreaM2}㎡`
                : undefined
            }
          />
          <FieldRow label="대지권 비율" value={property.landRightRatio} />
        </dl>
      </section>

      <ValuationForm
        initialValue={{
          addressRaw: property.addressRaw,
          buildingName: property.buildingName,
          exclusiveAreaM2: property.exclusiveAreaM2,
          rightsRisk
        }}
      />

      <section className="card-surface p-6">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="font-semibold text-slate-900">
        권리관계 리스크
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        등기부상 권리 제한 가능성이 있는 키워드를 자동 탐지합니다.
      </p>
    </div>

    <span
      className={
        rightsRisk.riskLevel === "SAFE"
          ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
          : rightsRisk.riskLevel === "CAUTION"
          ? "rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700"
          : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
      }
    >
      {rightsRisk.riskLevel === "SAFE" && "안전"}
      {rightsRisk.riskLevel === "CAUTION" && "주의"}
      {rightsRisk.riskLevel === "DANGER" && "위험"}
      {!rightsRisk.riskLevel && "검토 필요"}
    </span>
  </div>

  {rightsRisk.summary && (
    <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
      {rightsRisk.summary}
    </p>
  )}

  <div className="mt-4 flex flex-wrap gap-2">
    {rightsRisk.riskFlags.length ? (
      rightsRisk.riskFlags.map((flag) => {
        const label =
          flag === "mortgage_detected"
            ? "근저당 설정 확인"
            : flag === "seizure_detected"
            ? "압류 이력 존재"
            : flag === "provisional_seizure_detected"
            ? "가압류 이력 존재"
            : flag === "leasehold_or_tenant_right_detected"
            ? "임차권/전세권 설정"
            : flag === "trust_detected"
            ? "신탁 설정 확인"
            : flag;

        return (
          <span
            key={flag}
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
          >
            {label}
          </span>
        );
      })
    ) : (
      <span className="text-sm text-slate-500">
        탐지된 리스크 없음
      </span>
    )}
  </div>
</section>

      {review.manualReviewRequired && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h3 className="font-semibold text-amber-900">수동 검토 사유</h3>

          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {review.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          {review.missingRequiredFields.length > 0 && (
            <p className="mt-3 text-sm text-amber-900">
              누락 필드: {review.missingRequiredFields.join(", ")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
