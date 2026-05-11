import type { ParseApiResponse } from "@frontend/lib/api";
import { ValuationForm } from "./ValuationForm";

function FieldRow({
  label,
  value
}: {
  label: string;
  value?: string | number | boolean | null;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 border-b border-slate-100 py-3 text-sm last:border-b-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-slate-900">
        {value === undefined || value === null || value === ""
          ? "-"
          : String(value)}
      </dd>
    </div>
  );
}

export function ParseResultView({ response }: { response: ParseApiResponse }) {
  const { parseResult } = response;
  const { property, rightsRisk, review } = parseResult;

  const reviewReasons = [...new Set(review.reasons)];
  const missingRequiredFields = [...new Set(review.missingRequiredFields)];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 border-b border-slate-100 pb-4">
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            REGISTRY EXTRACTION
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">
            등기부 판독 결과
          </h2>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="mb-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500">
                PROPERTY INFO
              </p>

              <h3 className="mt-1 text-lg font-bold text-slate-900">
                물건 정보
              </h3>
            </div>

            <dl>
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
              <FieldRow label="대지권" value={property.landRightRatio} />
            </dl>
          </div>

          <ValuationForm
            initialValue={{
              addressRaw: property.addressRaw,
              buildingName: property.buildingName,
              exclusiveAreaM2: property.exclusiveAreaM2,
              rightsRisk
            }}
          />
        </div>
      </section>

      {review.manualReviewRequired && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
          <p className="text-xs font-semibold tracking-wide text-amber-700">
            MANUAL REVIEW
          </p>

          <h3 className="mt-1 font-semibold text-amber-900">
            수동 검토 필요
          </h3>

          {reviewReasons.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {reviewReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

          {missingRequiredFields.length > 0 && (
            <p className="mt-3 text-sm font-medium text-amber-900">
              누락 필드: {missingRequiredFields.join(", ")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
