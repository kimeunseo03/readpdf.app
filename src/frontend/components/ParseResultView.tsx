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
    <div className="grid grid-cols-[110px_1fr] gap-3 border-b border-slate-100 py-3 text-sm last:border-b-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">
        {value === undefined || value === null || value === ""
          ? "-"
          : String(value)}
      </dd>
    </div>
  );
}

function formatWon(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${value.toLocaleString()}원`;
}

export function ParseResultView({ response }: { response: ParseApiResponse }) {
  const { parseResult } = response;
  const { property, rightsRisk, review } = parseResult;

  const mortgageTotal = rightsRisk.mortgages?.reduce(
    (sum, mortgage) => sum + mortgage.amount,
    0
  );

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 border-b border-slate-100 pb-4">
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            REGISTRY EXTRACTION REPORT
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">
            등기부 판독 결과
          </h2>
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <h3 className="text-base font-bold text-slate-900">물건 정보</h3>

            <dl className="mt-3">
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

        {(rightsRisk.mortgages?.length ?? 0) > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-sm font-bold text-slate-900">
                근저당권 현황
              </p>

              <p className="text-xs font-semibold text-red-700">
                합계 {formatWon(mortgageTotal)}
              </p>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-white text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">순위</th>
                  <th className="px-4 py-3 font-semibold">근저당권자</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    금액(원)
                  </th>
                </tr>
              </thead>

              <tbody>
                {rightsRisk.mortgages?.map((mortgage) => (
                  <tr
                    key={`${mortgage.rank}-${mortgage.creditor}-${mortgage.amount}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {mortgage.rank}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-900">
                      {mortgage.creditor || "-"}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {formatWon(mortgage.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {review.manualReviewRequired && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
          <h3 className="font-semibold text-amber-900">수동 검토 필요</h3>

          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {[...new Set(review.reasons)].map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          {review.missingRequiredFields.length > 0 && (
            <p className="mt-3 text-sm font-medium text-amber-900">
              누락 필드: {[...new Set(review.missingRequiredFields)].join(", ")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
