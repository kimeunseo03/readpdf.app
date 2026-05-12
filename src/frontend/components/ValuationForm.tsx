"use client";

import { useState } from "react";
import { ValuationReport } from "./ValuationReport";
import { formatKoreanPrice } from "../../backend/valuation/formatKoreanPrice";

interface ValuationFormProps {
  initialValue: {
    addressRaw?: string;
    buildingName?: string;
    exclusiveAreaM2?: number;
    floor?: number;
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
    buildYear?: number;
    selectionReason?: string;
    isSameApartment?: boolean;
    areaDifferenceM2?: number;
    monthsAgo?: number;
    similarityScore?: number;
    similarityReason?: string;
    reliabilityGrade?: "A" | "B" | "C";
  }[];
  valuationBasis: string[];
  overallConfidence?: "A" | "B" | "C";
  warnings: string[];
}

function parseOptionalNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

export function ValuationForm({ initialValue }: ValuationFormProps) {
  const [addressRaw, setAddressRaw] = useState(initialValue.addressRaw ?? "");
  const [buildingName, setBuildingName] = useState(
    initialValue.buildingName ?? ""
  );
  const [exclusiveAreaM2, setExclusiveAreaM2] = useState(
    initialValue.exclusiveAreaM2?.toString() ?? ""
  );
  const [floor, setFloor] = useState(initialValue.floor?.toString() ?? "");
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
          exclusiveAreaM2: parseOptionalNumber(exclusiveAreaM2),
          floor: parseOptionalNumber(floor)
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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <p className="text-xs font-semibold tracking-wide text-blue-600">
          VALUATION INPUT
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          가치평가 입력값 확인
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            주소
          </span>
          <textarea
            value={addressRaw}
            onChange={(e) => setAddressRaw(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            rows={3}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            단지명
          </span>
          <input
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            전용면적㎡
          </span>
          <input
            type="number"
            value={exclusiveAreaM2}
            onChange={(e) => setExclusiveAreaM2(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            층
          </span>
          <input
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            placeholder="예: 12"
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={runValuation}
            disabled={loading}
            className="w-fit rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "평가 중..." : "자동 평가 실행"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 rounded-3xl bg-slate-50 p-5 text-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-blue-600">
                VALUATION RESULT
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                아파트 가치평가 보고서
              </h3>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              PDF 저장
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs text-slate-500">보정 평균가</p>
              <p className="mt-2 whitespace-pre-line text-2xl font-bold text-slate-900">
                {formatKoreanPrice(result.averagePrice)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                유사도/이상치 보정 반영
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs text-slate-500">최저 거래가</p>
              <p className="mt-2 whitespace-pre-line text-2xl font-bold text-slate-900">
                {formatKoreanPrice(result.lowestPrice)}
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs text-slate-500">최고 거래가</p>
              <p className="mt-2 whitespace-pre-line text-2xl font-bold text-slate-900">
                {formatKoreanPrice(result.highestPrice)}
              </p>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs text-slate-500">평가 신뢰도</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">
                {result.overallConfidence ?? "-"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                비교 거래 {result.comparableCount}건
              </p>
            </div>
          </div>

          <ValuationReport
            input={{
              addressRaw,
              buildingName,
              exclusiveAreaM2
            }}
            result={result}
          />

          {result.recentTransactions.length > 0 && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">비교 거래 내역</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  fallback 반영
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-xs">
                  <thead className="border-b bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">거래일</th>
                      <th className="px-3 py-2">거래금액</th>
                      <th className="px-3 py-2">전용면적</th>
                      <th className="px-3 py-2">층</th>
                      <th className="px-3 py-2">선정 기준</th>
                      <th className="px-3 py-2">유사도</th>
                      <th className="px-3 py-2">신뢰도</th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.recentTransactions.map((tx, index) => (
                      <tr
                        key={`${tx.dealYear}-${tx.dealMonth}-${tx.dealDay}-${tx.dealAmount}-${index}`}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-3 py-2">
                          {tx.dealYear}.
                          {String(tx.dealMonth).padStart(2, "0")}.
                          {String(tx.dealDay).padStart(2, "0")}
                        </td>
                        <td className="px-3 py-2 font-semibold tabular-nums">
                          {formatKoreanPrice(tx.dealAmount * 10000)}
                        </td>
                        <td className="px-3 py-2">{tx.area}㎡</td>
                        <td className="px-3 py-2">{tx.floor ?? "-"}층</td>
                        <td className="px-3 py-2">{tx.selectionReason ?? "-"}</td>
                        <td className="px-3 py-2">
                          {tx.similarityScore ?? "-"}점
                          {tx.similarityReason ? ` · ${tx.similarityReason}` : ""}
                        </td>
                        <td className="px-3 py-2">{tx.reliabilityGrade ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.valuationBasis.length > 0 && (
            <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                평가 기준 보기
              </summary>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
                {result.valuationBasis.map((basis) => (
                  <li key={basis}>{basis}</li>
                ))}
              </ul>
            </details>
          )}

          {result.warnings.length > 0 && (
            <details className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-amber-900">
                주의사항 보기
              </summary>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-900">
                {[...new Set(result.warnings)].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
