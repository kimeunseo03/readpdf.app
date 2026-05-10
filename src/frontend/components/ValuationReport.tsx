import { formatKoreanPrice } from "../../backend/valuation/formatKoreanPrice";

interface ValuationReportProps {
  input: {
    addressRaw?: string;
    buildingName?: string;
    exclusiveAreaM2?: string;
    managerName?: string;

    rightsRisk?: {
      riskLevel?: "SAFE" | "CAUTION" | "DANGER";
      summary?: string;
      riskFlags?: string[];
    };
  };

  result: {
    comparableCount: number;
    averagePrice?: number;
    lowestPrice?: number;
    highestPrice?: number;
    overallConfidence?: "A" | "B" | "C";
    valuationBasis: string[];
    finalComment?: string;

    recentTransactions: {
      dealAmount: number;
      dealYear: number;
      dealMonth: number;
      dealDay: number;
      area: number;
      floor?: number;
      buildYear?: number;
      isSameApartment?: boolean;
      areaDifferenceM2?: number;
      monthsAgo?: number;
      selectionReason?: string;
      similarityScore?: number;
      similarityReason?: string;
      reliabilityGrade?: "A" | "B" | "C";
    }[];

    warnings: string[];
  };
}

function riskLabel(level?: "SAFE" | "CAUTION" | "DANGER") {
  if (level === "SAFE") return "안전";
  if (level === "CAUTION") return "주의";
  if (level === "DANGER") return "위험";
  return "-";
}

function riskBadgeClass(level?: "SAFE" | "CAUTION" | "DANGER") {
  if (level === "SAFE") {
    return "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
  }

  if (level === "CAUTION") {
    return "rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700";
  }

  if (level === "DANGER") {
    return "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
  }

  return "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600";
}

function reliabilityBadgeClass(grade?: "A" | "B" | "C") {
  if (grade === "A") {
    return "rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700";
  }

  if (grade === "B") {
    return "rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700";
  }

  return "rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700";
}

function riskFlagLabel(flag: string) {
  if (flag === "mortgage_detected") return "근저당";
  if (flag === "seizure_detected") return "압류";
  if (flag === "provisional_seizure_detected") return "가압류";
  if (flag === "leasehold_or_tenant_right_detected") return "임차권/전세권";
  if (flag === "trust_detected") return "신탁";
  return flag;
}

export function ValuationReport({ input, result }: ValuationReportProps) {
  const generatedAt = new Date().toLocaleString("ko-KR");

  return (
    <section className="print-report mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
      <div className="mb-8 border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          INTERNAL VALUATION REPORT
        </p>

        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          아파트 가치평가 내부 검토 리포트
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          내부 검토용 자료이며, 감정평가서 또는 법률 의견서가 아닙니다.
        </p>

        <p className="mt-2 text-xs text-slate-400">
          생성 시각: {generatedAt}
        </p>
      </div>

      <div className="grid gap-x-8 gap-y-5 text-sm md:grid-cols-3">
        <div>
          <p className="text-slate-500">주소</p>
          <p className="mt-1 font-medium text-slate-900">
            {input.addressRaw || "-"}
          </p>
        </div>

        <div>
          <p className="text-slate-500">단지명</p>
          <p className="mt-1 font-medium text-slate-900">
            {input.buildingName || "-"}
          </p>
        </div>

        <div>
          <p className="text-slate-500">전용면적</p>
          <p className="mt-1 font-medium text-slate-900">
            {input.exclusiveAreaM2 || "-"}㎡
          </p>
        </div>

        <div>
          <p className="text-slate-500">담당자</p>
          <p className="mt-1 font-medium text-slate-900">
            {input.managerName || "-"}
          </p>
        </div>

        <div>
          <p className="text-slate-500">권리 위험도</p>
          <div className="mt-2">
            <span className={riskBadgeClass(input.rightsRisk?.riskLevel)}>
              {riskLabel(input.rightsRisk?.riskLevel)}
            </span>
          </div>
        </div>

        <div>
          <p className="text-slate-500">비교 거래 수</p>
          <p className="mt-1 font-medium text-slate-900">
            {result.comparableCount}건
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
          <p className="text-xs font-semibold text-green-700">보정 평균가</p>
          <p className="mt-3 whitespace-pre-line text-lg font-bold leading-snug tracking-tight tabular-nums text-green-700">
            {formatKoreanPrice(result.averagePrice)}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-xs font-semibold text-blue-700">최저 거래가</p>
          <p className="mt-3 whitespace-pre-line text-lg font-bold leading-snug tracking-tight tabular-nums text-blue-700">
            {formatKoreanPrice(result.lowestPrice)}
          </p>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
          <p className="text-xs font-semibold text-orange-700">최고 거래가</p>
          <p className="mt-3 whitespace-pre-line text-lg font-bold leading-snug tracking-tight tabular-nums text-orange-700">
            {formatKoreanPrice(result.highestPrice)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-600">평가 신뢰도</p>
          <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-slate-900">
            {result.overallConfidence ?? "-"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            비교 거래 {result.comparableCount}건
          </p>
        </div>
      </div>

      {result.finalComment && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <p className="text-xs font-semibold tracking-wide text-slate-500">
            FINAL COMMENT
          </p>

          <h3 className="mt-1 text-lg font-bold text-slate-900">
            종합 의견
          </h3>

          <p className="mt-3 text-sm leading-6 text-slate-700">
            {result.finalComment}
          </p>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500">
            COMPARABLE SALES
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">
            비교 거래 내역
          </h3>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">거래일</th>
                <th className="px-4 py-3 font-semibold">금액</th>
                <th className="px-4 py-3 font-semibold">면적</th>
                <th className="px-4 py-3 font-semibold">층</th>
                <th className="px-4 py-3 font-semibold">유사도</th>
                <th className="px-4 py-3 font-semibold">비교군</th>
                <th className="px-4 py-3 font-semibold">선정 기준</th>
                <th className="px-4 py-3 font-semibold">신뢰도</th>
              </tr>
            </thead>

            <tbody>
              {result.recentTransactions.map((tx, index) => (
                <tr
                  key={`${tx.dealYear}-${tx.dealMonth}-${tx.dealDay}-${tx.dealAmount}-${index}`}
                  className={index === 0 ? "border-b bg-green-50" : "border-b"}
                >
                  <td className="px-4 py-3 text-slate-700">
                    {tx.dealYear}.{String(tx.dealMonth).padStart(2, "0")}.
                    {String(tx.dealDay).padStart(2, "0")}

                    {index === 0 && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                        최우선 비교군
                      </span>
                    )}
                  </td>

                  <td className="whitespace-pre-line px-4 py-3 font-medium tabular-nums text-slate-700">
                    {formatKoreanPrice(tx.dealAmount)}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {tx.area}㎡
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {tx.floor ?? "-"}층
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    <div className="flex flex-wrap gap-1">
                      {tx.isSameApartment && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          동일단지
                        </span>
                      )}
                  
                      {(tx.monthsAgo ?? 999) <= 3 && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          최근거래
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {tx.similarityScore ?? "-"}점
                    {tx.similarityReason ? ` · ${tx.similarityReason}` : ""}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    <span className={reliabilityBadgeClass(tx.reliabilityGrade)}>
                      {tx.reliabilityGrade ?? "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {input.rightsRisk?.summary && (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm">
          <p className="text-xs font-semibold tracking-wide text-amber-700">
            RIGHTS RISK SUMMARY
          </p>

          <h3 className="mt-1 text-lg font-bold text-amber-900">
            권리 리스크 요약
          </h3>

          <p className="mt-3 leading-6 text-amber-900">
            {input.rightsRisk.summary}
          </p>
        </div>
      )}

      {input.rightsRisk?.riskFlags &&
        input.rightsRisk.riskFlags.length > 0 && (
          <div className="mt-6">
            <div className="mb-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500">
                RIGHTS RISK DETAIL
              </p>

              <h3 className="mt-1 text-lg font-bold text-slate-900">
                권리 리스크 상세
              </h3>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">항목</th>
                    <th className="px-4 py-3 font-semibold">상태</th>
                  </tr>
                </thead>

                <tbody>
                  {input.rightsRisk.riskFlags.map((flag) => (
                    <tr key={flag} className="border-b">
                      <td className="px-4 py-3 text-slate-700">
                        {riskFlagLabel(flag)}
                      </td>

                      <td className="px-4 py-3 font-medium text-red-600">
                        감지됨
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {result.valuationBasis.length > 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="mb-3">
            <p className="text-xs font-semibold tracking-wide text-slate-500">
              VALUATION BASIS
            </p>

            <h3 className="mt-1 text-lg font-bold text-slate-900">
              평가 기준
            </h3>
          </div>

          <ul className="space-y-2.5 text-sm text-slate-700">
            {result.valuationBasis.map((basis) => (
              <li key={basis} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span>{basis}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-sm">
          <p className="text-xs font-semibold tracking-wide text-amber-700">
            WARNINGS
          </p>

          <h3 className="mt-1 text-lg font-bold text-amber-900">
            주의사항
          </h3>

          <ul className="mt-3 space-y-2.5 text-amber-900">
            {result.warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-400">
        <p>본 자료는 내부 검토 및 참고 목적의 자동 분석 결과입니다.</p>
        <p>
          감정평가서, 법률 의견서 또는 금융기관의 공식 심사자료가 아니며,
          실제 거래가격 및 권리관계 판단은 별도 검토가 필요합니다.
        </p>
        <p>
          실거래 데이터, OCR 결과 및 주소 정규화 과정에서 일부 오차가 발생할 수 있습니다.
        </p>
      </div>
    </section>
  );
}
