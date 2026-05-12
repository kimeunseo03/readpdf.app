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

function formatPriceOrEmpty(value?: number) {
  if (!value) return "비교군 없음";
  return formatKoreanPrice(value);
}

function ResultMetricCard({
  label,
  value,
  helper,
  emphasis = false
}: {
  label: string;
  value: string;
  helper?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis
          ? "rounded-3xl border border-blue-200 bg-blue-50/70 p-6 shadow-sm"
          : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      }
    >
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p
        className={
          emphasis
            ? "mt-3 whitespace-pre-line break-keep text-3xl font-extrabold leading-tight text-blue-800"
            : "mt-3 whitespace-pre-line break-keep text-2xl font-extrabold leading-tight text-slate-900"
        }
      >
        {value}
      </p>
      {helper && <p className="mt-3 text-sm leading-5 text-slate-500">{helper}</p>}
    </div>
  );
}

export function ValuationForm({ initialValue }: ValuationFormProps) {
  const [addressRaw, setAddressRaw] = useState(initialValue.addressRaw ?? "");
  const [buildingName, setBuildingName] = useState(initialValue.buildingName ?? "");
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
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
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
          <span className="mb-1 block text-sm font-medium text-slate-700">주소</span>
          <textarea
            value={addressRaw}
            onChange={(e) => setAddressRaw(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            rows={3}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">단지명</span>
          <input
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">전용면적㎡</span>
          <input
            type="number"
            value={exclusiveAreaM2}
            onChange={(e) => setExclusiveAreaM2(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">층</span>
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
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {result && (
        <div className="mt-8 rounded-[2rem] bg-slate-50 p-6 text-sm xl:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
            <div>
              <p className="text-xs font-semibold tracking-wide text-blue-600">
                VALUATION RESULT
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-slate-950">
                아파트 가치평가 보고서
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                비교 거래 {result.comparableCount}건 · 신뢰도 {result.overallConfidence ?? "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              PDF 저장
            </button>
          </div>

          {result.comparableCount === 0 && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              실거래 비교군을 찾지 못했습니다. 주소, 단지명, 전용면적, 법정동코드 매핑 또는 API 키 설정을 확인하세요.
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
            <ResultMetricCard
              label="보정 평균가"
              value={formatPriceOrEmpty(result.averagePrice)}
              helper="유사도와 IQR 이상치 보정을 반영한 내부 기준가"
              emphasis
            />
            <ResultMetricCard
              label="최저 거래가"
              value={formatPriceOrEmpty(result.lowestPrice)}
              helper="선택된 비교 거래군 중 최저가"
            />
            <ResultMetricCard
              label="최고 거래가"
              value={formatPriceOrEmpty(result.highestPrice)}
              helper="선택된 비교 거래군 중 최고가"
            />
            <ResultMetricCard
              label="평가 신뢰도"
              value={result.overallConfidence ?? "산정 불가"}
              helper={`비교 거래 ${result.comparableCount}건 기준`}
            />
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
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-lg font-bold text-slate-900">비교 거래 내역</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  fallback 반영
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3">거래일</th>
                      <th className="px-4 py-3">거래금액</th>
                      <th className="px-4 py-3">전용면적</th>
                      <th className="px-4 py-3">층</th>
                      <th className="px-4 py-3">선정 기준</th>
                      <th className="px-4 py-3">유사도</th>
                      <th className="px-4 py-3">신뢰도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.recentTransactions.map((tx, index) => (
                      <tr
                        key={`${tx.dealYear}-${tx.dealMonth}-${tx.dealDay}-${tx.dealAmount}-${index}`}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          {tx.dealYear}.{String(tx.dealMonth).padStart(2, "0")}.
                          {String(tx.dealDay).padStart(2, "0")}
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums">
                          {formatKoreanPrice(tx.dealAmount * 10000)}
                        </td>
                        <td className="px-4 py-3">{tx.area}㎡</td>
                        <td className="px-4 py-3">{tx.floor ?? "-"}층</td>
                        <td className="px-4 py-3">{tx.selectionReason ?? "-"}</td>
                        <td className="px-4 py-3">
                          {tx.similarityScore ?? "-"}점
                          {tx.similarityReason ? ` · ${tx.similarityReason}` : ""}
                        </td>
                        <td className="px-4 py-3">{tx.reliabilityGrade ?? "-"}</td>
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
