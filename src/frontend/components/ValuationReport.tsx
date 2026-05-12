import { formatKoreanPrice } from "../../backend/valuation/formatKoreanPrice";

interface ValuationReportProps {
  input: {
    addressRaw?: string;
    buildingName?: string;
    exclusiveAreaM2?: string;
  };
  result: {
    comparableCount: number;
    averagePrice?: number;
    lowestPrice?: number;
    highestPrice?: number;
    overallConfidence?: "A" | "B" | "C";
    valuationBasis: string[];
    recentTransactions: {
      dealAmount: number;
      dealYear: number;
      dealMonth: number;
      dealDay: number;
      area: number;
      floor?: number;
      similarityScore?: number;
      similarityReason?: string;
      reliabilityGrade?: "A" | "B" | "C";
    }[];
    warnings: string[];
  };
}

function formatPriceOrEmpty(value?: number) {
  if (!value) return "실거래 비교군 없음";
  return formatKoreanPrice(value);
}

export function ValuationReport({ input, result }: ValuationReportProps) {
  const generatedAt = new Date().toLocaleString("ko-KR");

  return (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
      <div className="mb-6 border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
          아파트 가치평가 내부 검토 리포트
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          내부 검토용 자료이며 감정평가서 또는 법률 의견서가 아닙니다.
        </p>

        <p className="mt-2 text-xs text-slate-400">
          생성 시각: {generatedAt}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-blue-200 bg-blue-50/70 p-6">
          <p className="text-sm font-semibold text-slate-500">보정 평균가</p>
          <p className="mt-3 whitespace-pre-line break-keep text-3xl font-extrabold leading-tight text-blue-800">
            {formatPriceOrEmpty(result.averagePrice)}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-500">최저 거래가</p>
          <p className="mt-3 whitespace-pre-line break-keep text-2xl font-extrabold leading-tight text-slate-900">
            {formatPriceOrEmpty(result.lowestPrice)}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-500">최고 거래가</p>
          <p className="mt-3 whitespace-pre-line break-keep text-2xl font-extrabold leading-tight text-slate-900">
            {formatPriceOrEmpty(result.highestPrice)}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-500">평가 신뢰도</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-900">
            {result.overallConfidence ?? "산정 불가"}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            비교 거래 {result.comparableCount}건 기준
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
          <p className="text-xs font-semibold tracking-wide text-slate-500">
            PROPERTY SUMMARY
          </p>

          <h3 className="mt-1 text-lg font-bold text-slate-900">
            입력 물건 정보
          </h3>

          <div className="mt-5 space-y-4 text-sm">
            <div>
              <p className="text-slate-500">주소</p>
              <p className="mt-1 font-semibold text-slate-900 break-words">
                {input.addressRaw || "-"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">단지명</p>
              <p className="mt-1 font-semibold text-slate-900">
                {input.buildingName || "-"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">전용면적</p>
              <p className="mt-1 font-semibold text-slate-900">
                {input.exclusiveAreaM2 || "-"}㎡
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold tracking-wide text-slate-500">
            VALUATION BASIS
          </p>

          <h3 className="mt-1 text-lg font-bold text-slate-900">
            평가 기준
          </h3>

          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {result.valuationBasis.map((basis) => (
              <li key={basis}>{basis}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500">
              COMPARABLE TRANSACTIONS
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              비교 거래 내역
            </h3>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {result.comparableCount}건
          </span>
        </div>

        {result.recentTransactions.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            실거래 비교군이 없습니다. 주소, 단지명, 전용면적 또는 법정동코드 매핑을 확인하세요.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3">거래일</th>
                  <th className="px-4 py-3">거래금액</th>
                  <th className="px-4 py-3">면적</th>
                  <th className="px-4 py-3">층</th>
                  <th className="px-4 py-3">유사도</th>
                  <th className="px-4 py-3">신뢰도</th>
                </tr>
              </thead>

              <tbody>
                {result.recentTransactions.map((tx, index) => (
                  <tr key={index} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      {tx.dealYear}.{String(tx.dealMonth).padStart(2, "0")}.
                      {String(tx.dealDay).padStart(2, "0")}
                    </td>

                    <td className="px-4 py-3 font-bold tabular-nums text-slate-900">
                      {formatKoreanPrice(tx.dealAmount * 10000)}
                    </td>

                    <td className="px-4 py-3">{tx.area}㎡</td>

                    <td className="px-4 py-3">{tx.floor ?? "-"}층</td>

                    <td className="px-4 py-3">
                      {tx.similarityScore ?? "-"}점
                      {tx.similarityReason
                        ? ` · ${tx.similarityReason}`
                        : ""}
                    </td>

                    <td className="px-4 py-3">
                      {tx.reliabilityGrade ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result.warnings.length > 0 && (
        <details className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <summary className="cursor-pointer text-sm font-semibold text-amber-900">
            주의사항 보기
          </summary>

          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-900">
            {[...new Set(result.warnings)].map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
