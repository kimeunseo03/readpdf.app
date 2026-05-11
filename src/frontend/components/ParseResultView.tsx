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
    <div className="grid grid-cols-[120px_1fr] gap-4 border-b border-slate-100 py-3 text-sm last:border-b-0">
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
  const { property, rightsRisk, review } = parseResult;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">물건 정보</h3>

          <p className="mt-1 text-sm text-slate-500">
            등기부에서 추출한 기본 물건 정보입니다.
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

          {(rightsRisk.mortgages?.length ?? 0) > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-sm font-bold text-slate-900">
                  근저당권 현황
                </p>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-white text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">순위</th>
                    <th className="px-3 py-2 font-semibold">근저당권자</th>
                    <th className="px-3 py-2 text-right font-semibold">
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
                      <td className="px-3 py-2 text-slate-700">
                        {mortgage.rank}
                      </td>

                      <td className="px-3 py-2 font-medium text-slate-900">
                        {mortgage.creditor || "-"}
                      </td>

                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                        {mortgage.amount.toLocaleString()}원
                      </td>
                    </tr>
                  ))}

                  <tr className="border-t border-slate-200 bg-slate-50">
                    <td
                      colSpan={2}
                      className="px-3 py-2 font-bold text-slate-900"
                    >
                      합계
                    </td>

                    <td className="px-3 py-2 text-right font-bold tabular-nums text-red-700">
                      {rightsRisk.mortgages
                        ?.reduce((sum, mortgage) => sum + mortgage.amount, 0)
                        .toLocaleString()}
                      원
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ValuationForm
          initialValue={{
            addressRaw: property.addressRaw,
            buildingName: property.buildingName,
            exclusiveAreaM2: property.exclusiveAreaM2,
            rightsRisk
          }}
        />
      </div>

      {review.manualReviewRequired && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-500" />

            <div>
              <h3 className="font-semibold text-amber-900">
                수동 검토 필요
              </h3>

              <p className="mt-1 text-sm text-amber-800">
                자동 판독 결과 중 일부 항목은 담당자 확인이 필요합니다.
              </p>

              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900">
                {review.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>

              {review.missingRequiredFields.length > 0 && (
                <p className="mt-3 text-sm font-medium text-amber-900">
                  누락 필드: {review.missingRequiredFields.join(", ")}
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
