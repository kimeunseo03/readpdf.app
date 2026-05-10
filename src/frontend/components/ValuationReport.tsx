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

export function ValuationReport({ input, result }: ValuationReportProps) {

  const generatedAt = new Date().toLocaleString("ko-KR");
  
  return (
    <section className="print-report mt-6 rounded-xl border border-gray-200 bg-white p-6 print:border-0 print:shadow-none">
      <div className="mb-5 border-b pb-4">
        <h2 className="text-xl font-bold">아파트 가치평가 내부 검토 리포트</h2>
        <p className="mt-1 text-sm text-gray-500">
          내부 검토용 자료이며, 감정평가서 또는 법률 의견서가 아닙니다.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          생성 시각: {generatedAt}
        </p>
      </div>

      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <p className="text-gray-500">주소</p>
          <p className="font-medium">{input.addressRaw || "-"}</p>
        </div>

        <div>
          <p className="text-gray-500">단지명</p>
          <p className="font-medium">{input.buildingName || "-"}</p>
        </div>

        <div>
          <p className="text-gray-500">전용면적</p>
          <p className="font-medium">{input.exclusiveAreaM2 || "-"}㎡</p>
        </div>

        <div>
          <p className="text-gray-500">담당자</p>
          <p className="font-medium">{input.managerName || "-"}</p>
        </div>
        <div>
          <p className="text-gray-500">평가 신뢰도</p>
          <p className="font-medium">{result.overallConfidence ?? "-"}</p>
        </div>

        <div>
          <p className="text-gray-500">권리 위험도</p>
          <p className="font-medium">
            {input.rightsRisk?.riskLevel === "SAFE" && "안전"}
            {input.rightsRisk?.riskLevel === "CAUTION" && "주의"}
            {input.rightsRisk?.riskLevel === "DANGER" && "위험"}
            {!input.rightsRisk?.riskLevel && "-"}
          </p>
        </div>

        <div>
          <p className="text-gray-500">보정 평균가</p>
          <p className="whitespace-pre-line font-medium">
            {formatKoreanPrice(result.averagePrice)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            실거래 비교군의 유사도, 거래 최근성, 층수, 준공연도, 이상치 제거 기준을 반영한 내부 참고가입니다.
          </p>
        </div>

        <div>
          <p className="text-gray-500">비교 거래 수</p>
          <p className="font-medium">{result.comparableCount}건</p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-2 font-semibold">비교 거래 내역</h3>

        <table className="w-full text-left text-xs">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="py-2">거래일</th>
              <th className="py-2">금액</th>
              <th className="py-2">면적</th>
              <th className="py-2">층</th>
              <th className="py-2">유사도</th>
              <th className="py-2">신뢰도</th>
            </tr>
          </thead>

          <tbody>
            {result.recentTransactions.map((tx, index) => (
              <tr key={index} className="border-b">
                <td className="py-2">
                  {tx.dealYear}.{String(tx.dealMonth).padStart(2, "0")}.
                  {String(tx.dealDay).padStart(2, "0")}
                </td>
                <td className="py-2">{formatKoreanPrice(tx.dealAmount)}</td>
                <td className="py-2">{tx.area}㎡</td>
                <td className="py-2">{tx.floor ?? "-"}층</td>
                <td className="py-2">
                  {tx.similarityScore ?? "-"}점
                  {tx.similarityReason ? ` · ${tx.similarityReason}` : ""}
                </td>
                <td className="py-2">{tx.reliabilityGrade ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {input.rightsRisk?.summary && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <h3 className="font-semibold text-amber-900">권리 리스크 요약</h3>
          <p className="mt-2 text-amber-900">
            {input.rightsRisk.summary}
          </p>
        </div>
      )}
      {input.rightsRisk?.riskFlags &&
  input.rightsRisk.riskFlags.length > 0 && (
    <div className="mt-4">
      <h3 className="mb-2 font-semibold">
        권리 리스크 상세
      </h3>

      <table className="w-full text-left text-xs">
        <thead className="border-b text-gray-500">
          <tr>
            <th className="py-2">항목</th>
            <th className="py-2">상태</th>
          </tr>
        </thead>

        <tbody>
          {input.rightsRisk.riskFlags.map((flag) => {
            const label =
              flag === "mortgage_detected"
                ? "근저당"
                : flag === "seizure_detected"
                ? "압류"
                : flag === "provisional_seizure_detected"
                ? "가압류"
                : flag === "leasehold_or_tenant_right_detected"
                ? "임차권/전세권"
                : flag === "trust_detected"
                ? "신탁"
                : flag;

            return (
              <tr
                key={flag}
                className="border-b"
              >
                <td className="py-2">
                  {label}
                </td>

                <td className="py-2 text-red-600">
                  감지됨
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
)}
      

      <div className="mt-6">
        <h3 className="mb-2 font-semibold">평가 기준</h3>
        <ul className="list-disc pl-5 text-sm text-gray-700">
          {result.valuationBasis.map((basis) => (
            <li key={basis}>{basis}</li>
          ))}
        </ul>
      </div>

      {result.warnings.length > 0 && (
        <div className="mt-6 rounded-lg bg-yellow-50 p-4 text-sm">
          <h3 className="font-semibold">주의사항</h3>
          <ul className="mt-2 list-disc pl-5">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
