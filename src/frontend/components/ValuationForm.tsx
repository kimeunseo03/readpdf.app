"use client";

import { useState } from "react";

interface ValuationFormProps {
  initialValue: {
    addressRaw?: string;
    buildingName?: string;
    exclusiveAreaM2?: number;
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
  valuationBasis: string[];
  warnings: string[];
}

export function ValuationForm({ initialValue }: ValuationFormProps) {
  const [addressRaw, setAddressRaw] = useState(initialValue.addressRaw ?? "");
  const [buildingName, setBuildingName] = useState(initialValue.buildingName ?? "");
  const [exclusiveAreaM2, setExclusiveAreaM2] = useState(
    initialValue.exclusiveAreaM2?.toString() ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
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
          exclusiveAreaM2: Number(exclusiveAreaM2)
        })
      });

      if (!res.ok) {
        throw new Error("가치평가 API 호출에 실패했습니다.");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">가치평가 입력값 확인</h2>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">주소</span>
          <textarea
            value={addressRaw}
            onChange={(e) => setAddressRaw(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm"
            rows={3}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">단지명</span>
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
        <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm">
          <h3 className="mb-3 font-semibold">가치평가 결과</h3>

          <dl className="space-y-2">
            <div>
              <dt className="text-gray-500">비교 거래 수</dt>
              <dd>{result.comparableCount}건</dd>
            </div>

            <div>
              <dt className="text-gray-500">평균가</dt>
              <dd>{result.averagePrice?.toLocaleString() ?? "-"}만원</dd>
            </div>

            <div>
              <dt className="text-gray-500">최저가</dt>
              <dd>{result.lowestPrice?.toLocaleString() ?? "-"}만원</dd>
            </div>

            <div>
              <dt className="text-gray-500">최고가</dt>
              <dd>{result.highestPrice?.toLocaleString() ?? "-"}만원</dd>
            </div>
          </dl>
          
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
      )}
    </section>
  );
}
