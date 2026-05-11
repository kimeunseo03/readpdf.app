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

function formatWon(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${value.toLocaleString()}원`;
}

export function ParseResultView({ response }: { response: ParseApiResponse }) {
  const { parseResult } = response;
  const { property, rightsRisk, confidence, review, meta } = parseResult;

  return (
    <div className="space-y-6">
     <section className="card-surface p-6">
  <div>
    <h2 className="text-lg font-semibold text-slate-900">
      판독 요약
    </h2>

    <p className="mt-1 text-sm text-slate-500">
      등기부에서 추출한 주소 정보입니다.
    </p>
  </div>

  <dl className="mt-5">
    <FieldRow label="주소" value={property.addressRaw} />
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

        {(rightsRisk.mortgages?.length ?? 0) > 0 && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-sm font-bold text-slate-900">
                근저당권 현황
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

                <tr className="border-t border-slate-200 bg-slate-50">
                  <td
                    colSpan={2}
                    className="px-4 py-3 font-bold text-slate-900"
                  >
                    합계
                  </td>

                  <td className="px-4 py-3 text-right font-bold tabular-nums text-red-700">
                    {formatWon(
                      rightsRisk.mortgages?.reduce(
                        (sum, mortgage) => sum + mortgage.amount,
                        0
                      )
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
