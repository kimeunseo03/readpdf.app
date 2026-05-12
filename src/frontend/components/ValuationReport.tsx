import {
  formatKoreanPrice,
  formatKoreanPriceInline
} from "../../backend/valuation/formatKoreanPrice";

interface MortgageItem {
  rank: number;
  creditor: string;
  amount: number; // 원
}

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
      riskScore?: number;
      mortgageAmountText?: string;
      mortgages?: MortgageItem[];
      hasCancellationKeyword?: boolean;
      riskDetails?: {
        type: string;
        label: string;
        severity: "LOW" | "MEDIUM" | "HIGH";
        description: string;
      }[];
    };
  };

  result: {
    comparableCount: number;
    averagePrice?: number;
    lowestPrice?: number;
    highestPrice?: number;
    conservativePrice?: number;
    upperReferencePrice?: number;
    riskAdjustedPrice?: number;
    seniorDebtAmount?: number;
    seniorMortgageAmount?: number;
    mortgages?: MortgageItem[];
    tenantDepositAmount?: number;
    tenantMonthlyRent?: number;
    priorityRepaymentAmount?: number;
    overallConfidence?: "A" | "B" | "C";
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

function formatWon(value?: number) {
  return formatKoreanPriceInline(value);
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

function severityBadgeClass(severity: "LOW" | "MEDIUM" | "HIGH") {
  if (severity === "HIGH") {
    return "rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700";
  }

  if (severity === "MEDIUM") {
    return "rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700";
  }

  return "rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700";
}

function severityLabel(severity: "LOW" | "MEDIUM" | "HIGH") {
  if (severity === "HIGH") return "높음";
  if (severity === "MEDIUM") return "중간";
  return "낮음";
}

export function ValuationReport({ input, result }: ValuationReportProps) {
  const generatedAt = new Date().toLocaleString("ko-KR");
  const mortgages = result.mortgages ?? input.rightsRisk?.mortgages ?? [];

  return (
    <section className="print-report mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
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
          <p className="text-slate-500">평가 신뢰도</p>
          <p className="mt-1 font-medium text-slate-900">
            {result.overallConfidence ?? "-"}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-red-100 bg-red-50/60 p-5 text-sm">
        <p className="text-xs font-semibold tracking-wide text-red-700">
          RIGHTS DEDUCTION
        </p>

        <h3 className="mt-1 text-lg font-bold text-red-900">
          권리 차감 내역
        </h3>

        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <dt className="text-red-700">선순위 근저당 합계</dt>
            <dd className="mt-1 font-semibold tabular-nums text-red-900">
              {formatWon(result.seniorMortgageAmount)}
            </dd>
          </div>

          <div>
            <dt className="text-red-700">임차보증금</dt>
            <dd className="mt-1 font-semibold tabular-nums text-red-900">
              {formatWon(result.tenantDepositAmount)}
            </dd>
          </div>

          <div>
            <dt className="text-red-700">권리 차감 합계</dt>
            <dd className="mt-1 font-semibold tabular-nums text-red-900">
              {formatWon(result.seniorDebtAmount)}
            </dd>
          </div>

          <div>
            <dt className="text-red-700">최우선변제금 추정 참고</dt>
            <dd className="mt-1 font-semibold tabular-nums text-red-900">
              {formatWon(result.priorityRepaymentAmount)}
            </dd>
          </div>
        </dl>

        {mortgages.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-red-100 bg-white">
            <div className="border-b border-red-100 bg-red-50 px-4 py-3">
              <p className="text-sm font-bold text-red-900">근저당권 현황</p>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-white text-xs tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">순위</th>
                  <th className="px-4 py-3 font-semibold">근저당권자</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    금액(원)
                  </th>
                </tr>
              </thead>

              <tbody>
                {mortgages.map((mortgage) => (
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

                <tr className="border-t border-red-100 bg-red-50/70">
                  <td className="px-4 py-3 font-bold text-red-900" colSpan={2}>
                    합계
                  </td>

                  <td className="px-4 py-3 text-right font-bold tabular-nums text-red-900">
                    {formatWon(result.seniorMortgageAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
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

      {input.rightsRisk?.riskDetails &&
        input.rightsRisk.riskDetails.length > 0 && (
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
                    <th className="px-4 py-3 font-semibold">위험도</th>
                    <th className="px-4 py-3 font-semibold">설명</th>
                  </tr>
                </thead>

                <tbody>
                  {input.rightsRisk.riskDetails.map((detail) => (
                    <tr key={detail.type} className="border-b">
                      <td className="px-4 py-3 text-slate-700">
                        {detail.label}
                      </td>

                      <td className="px-4 py-3">
                        <span className={severityBadgeClass(detail.severity)}>
                          {severityLabel(detail.severity)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {detail.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {result.recentTransactions.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">거래일</th>
                <th className="px-4 py-3 font-semibold">금액</th>
                <th className="px-4 py-3 font-semibold">면적</th>
                <th className="px-4 py-3 font-semibold">층</th>
                <th className="px-4 py-3 font-semibold">비교군</th>
                <th className="px-4 py-3 font-semibold">유사도</th>
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
                  </td>

                  <td className="whitespace-pre-line px-4 py-3 text-right font-semibold leading-5 tabular-nums text-slate-900">
                    {formatKoreanPrice(tx.dealAmount * 10000)}
                  </td>

                  <td className="px-4 py-3 text-slate-700">{tx.area}㎡</td>

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

                  <td className="px-4 py-3 leading-5 text-slate-700">
                    <p className="font-semibold text-slate-900">
                      {tx.similarityScore ?? "-"}점
                    </p>
                    {tx.similarityReason && (
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {tx.similarityReason}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {tx.selectionReason ?? "-"}
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
