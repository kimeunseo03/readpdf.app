"use client";

import { useState } from "react";
import { ValuationReport } from "./ValuationReport";
import { formatKoreanPrice } from "../../backend/valuation/formatKoreanPrice";


interface ValuationFormProps {
  initialValue: {
    addressRaw?: string;
    buildingName?: string;
    exclusiveAreaM2?: number;

    rightsRisk?: {
      riskLevel?: "SAFE" | "CAUTION" | "DANGER";
      summary?: string;
      riskFlags?: string[];
    };
  };
}


interface ValuationResult {
  success: boolean;
  normalizedAddress?: string;
  buildingName?: string;
  comparableCount: number;
  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;

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

  valuationBasis: string[];

  overallConfidence?: "A" | "B" | "C";

  warnings: string[];
}

export function ValuationForm({ initialValue }: ValuationFormProps) {
  const [managerName, setManagerName] = useState("");
  
  const [addressRaw, setAddressRaw] = useState(
    initialValue.addressRaw ?? ""
  );

  const [buildingName, setBuildingName] = useState(
    initialValue.buildingName ?? ""
  );

  const [exclusiveAreaM2, setExclusiveAreaM2] = useState(
    initialValue.exclusiveAreaM2?.toString() ?? ""
  );

  const [loading, setLoading] = useState(false);

  const [result, setResult] =
    useState<ValuationResult | null>(null);

  const [error, setError] = useState<string | null>(null);

  async function runValuation() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
        addressRaw,
        buildingName,
        exclusiveAreaM2: Number(exclusiveAreaM2),
        rightsRisk: initialValue.rightsRisk
      })
      });

      if (!res.ok) {
        throw new Error("가치평가 API 호출에 실패했습니다.");
      }

      const data = await res.json();

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">
        가치평가 입력값 확인
      </h2>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            주소
          </span>

          <textarea
            value={addressRaw}
            onChange={(e) => setAddressRaw(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm"
            rows={3}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            단지명
          </span>

          <input
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            전용면적㎡
          </span>

          <input
            type="number"
            value={exclusiveAreaM2}
            onChange={(e) => setExclusiveAreaM2(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            담당자명
          </span>
        
          <input
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm"
            placeholder="예: 홍길동"
          />
        </label>
                
        <button
          type="button"
          onClick={runValuation}
          disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "평가 중..." : "가치평가 실행"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
  <>
    <div className="no-print mt-5 rounded-lg bg-gray-50 p-4 text-sm">
      <h3 className="mb-3 font-semibold">
        가치평가 결과
      </h3>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            보정 평균가
          </p>

          <p className="mt-2 whitespace-pre-line text-2xl font-bold">
            {formatKoreanPrice(result.averagePrice)}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            유사도/이상치 보정 반영
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            최저 거래가
          </p>

          <p className="mt-2 whitespace-pre-line text-2xl font-bold">
            {formatKoreanPrice(result.lowestPrice)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            최고 거래가
          </p>

          <p className="mt-2 whitespace-pre-line text-2xl font-bold">
            {formatKoreanPrice(result.highestPrice)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-gray-500">
            평가 신뢰도
          </p>

          <p className="mt-2 text-2xl font-bold">
            {result.overallConfidence ?? "-"}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            비교 거래 {result.comparableCount}건
          </p>
        </div>
      </div>

      {result.valuationBasis.length > 0 && (
        <div className="mt-4">
          <p className="font-medium">평가 기준</p>

          <ul className="mt-1 list-disc pl-5 text-gray-700">
            {result.valuationBasis.map((basis) => (
              <li key={basis}>{basis}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => window.print()}
        className="no-print mt-5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
      >
        PDF 저장
      </button>

      {result.recentTransactions.length > 0 && (
        <div className="mt-4">
          <p className="font-medium">
            비교 거래 내역
          </p>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b text-gray-500">
                <tr>
                  <th className="py-2">거래일</th>
                  <th className="py-2">거래금액</th>
                  <th className="py-2">전용면적</th>
                  <th className="py-2">층</th>
                  <th className="py-2">유사도</th>
                  <th className="py-2">신뢰도</th>
                </tr>
              </thead>

              <tbody>
                {result.recentTransactions.map(
                  (tx, index) => (
                    <tr
                      key={`${tx.dealYear}-${tx.dealMonth}-${tx.dealDay}-${tx.dealAmount}-${index}`}
                      className="border-b"
                    >
                      <td className="py-2">
                        {tx.dealYear}.
                        {String(tx.dealMonth).padStart(2, "0")}.
                        {String(tx.dealDay).padStart(2, "0")}
                      </td>

                      <td className="whitespace-pre-line py-2">
                        {formatKoreanPrice(tx.dealAmount)}
                      </td>

                      <td className="py-2">
                        {tx.area}㎡
                      </td>

                      <td className="py-2">
                        {tx.floor ?? "-"}층
                      </td>

                      <td className="py-2">
                        {tx.similarityScore ?? "-"}점
                        {tx.similarityReason
                          ? ` · ${tx.similarityReason}`
                          : ""}
                      </td>

                      <td className="py-2">
                        <span
                          className={
                            tx.reliabilityGrade === "A"
                              ? "rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700"
                              : tx.reliabilityGrade === "B"
                              ? "rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-700"
                              : "rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"
                          }
                        >
                          {tx.reliabilityGrade ?? "-"}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="mt-4">
          <p className="font-medium">주의사항</p>

          <ul className="mt-1 list-disc pl-5 text-gray-700">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>

    <ValuationReport
      input={{
        addressRaw,
        buildingName,
        exclusiveAreaM2,
        managerName,
        rightsRisk: initialValue.rightsRisk
      }}
      result={result}
    />
  </>
)}    
    </section>
  );
}
