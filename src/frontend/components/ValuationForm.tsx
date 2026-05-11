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
  conservativePrice?: number;
  upperReferencePrice?: number;
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
    conservativePrice?: number;
    upperReferencePrice?: number;
  }[];
  valuationBasis: string[];
  overallConfidence?: "A" | "B" | "C";
  warnings: string[];
}

export function ValuationForm({ initialValue }: ValuationFormProps) {
  const [managerName, setManagerName] = useState("");
  const [addressRaw, setAddressRaw] = useState(initialValue.addressRaw ?? "");
  const [buildingName, setBuildingName] = useState(initialValue.buildingName ?? "");
  const [exclusiveAreaM2, setExclusiveAreaM2] = useState(
    initialValue.exclusiveAreaM2?.toString() ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function printReport() {
    const originalTitle = document.title;
    const safeAddress = addressRaw?.split(" ")[0] || "valuation";
    const today = new Date().toISOString().slice(0, 10);

    document.title = `${safeAddress}_가치평가리포트_${today}`;
    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  }

  async function runValuation() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <section className="card-surface p-6">
      <div className="mb-5">
        <p className="text-sm font-semibold tracking-wide text-blue-600">
          VALUATION INPUT
        </p>

        <h2 className="mt-1 text-xl font-bold text-slate-900">
          가치평가 입력값 확인
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          등기부에서 추출한 값을 기준으로 평가를 실행합니다. 필요하면 주소, 단지명, 면적, 담당자명을 수정하세요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            주소
          </span>

          <textarea
            value={addressRaw}
            onChange={(e) => setAddressRaw(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
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
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
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
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            담당자명
          </span>

          <input
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            placeholder="예: 홍길동"
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={runValuation}
            disabled={loading}
            className="w-fit rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:opacity-50"
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
        <>
          <div className="no-print mt-5 rounded-3xl border border-slate-200 bg-white p-7 text-sm shadow-sm transition-all duration-300">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold tracking-tight text-slate-900">
                가치평가 결과
              </h3>

              <button
                type="button"
                onClick={printReport}
                className="no-print rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
              >
                PDF 저장
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-green-100 bg-green-50/50 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-xs font-semibold text-green-700">
                  보정 평균가
                </p>

                <p className="mt-3 whitespace-pre-line text-xl font-bold leading-snug tracking-tight tabular-nums text-green-700">
                  {formatKoreanPrice(result.averagePrice)}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  유사도/이상치 보정 반영
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs font-semibold text-blue-700">
                보수 기준가
              </p>
            
              <p className="mt-3 whitespace-pre-line text-xl font-bold leading-snug tracking-tight tabular-nums text-blue-700">
                {formatKoreanPrice(result.conservativePrice)}
              </p>
            </div>
            
            <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs font-semibold text-orange-700">
                상단 참고가
              </p>
            
              <p className="mt-3 whitespace-pre-line text-xl font-bold leading-snug tracking-tight tabular-nums text-orange-700">
                {formatKoreanPrice(result.upperReferencePrice)}
              </p>
            </div>

              <div
                className={
                  initialValue.rightsRisk?.riskLevel === "SAFE"
                    ? "rounded-2xl border border-green-100 bg-green-50/50 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                    : initialValue.rightsRisk?.riskLevel === "CAUTION"
                      ? "rounded-2xl border border-yellow-100 bg-yellow-50/50 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                      : "rounded-2xl border border-red-100 bg-red-50/50 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                }
              >
                <p
                  className={
                    initialValue.rightsRisk?.riskLevel === "SAFE"
                      ? "text-xs font-semibold text-green-700"
                      : initialValue.rightsRisk?.riskLevel === "CAUTION"
                        ? "text-xs font-semibold text-yellow-700"
                        : "text-xs font-semibold text-red-700"
                  }
                >
                  권리 위험도
                </p>

                <p
                  className={
                    initialValue.rightsRisk?.riskLevel === "SAFE"
                      ? "mt-3 text-2xl font-bold text-green-700"
                      : initialValue.rightsRisk?.riskLevel === "CAUTION"
                        ? "mt-3 text-2xl font-bold text-yellow-700"
                        : "mt-3 text-2xl font-bold text-red-700"
                  }
                >
                  {initialValue.rightsRisk?.riskLevel === "SAFE" && "안전"}
                  {initialValue.rightsRisk?.riskLevel === "CAUTION" && "주의"}
                  {initialValue.rightsRisk?.riskLevel === "DANGER" && "위험"}
                  {!initialValue.rightsRisk?.riskLevel && "-"}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  등기부 권리관계 기준
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-xs font-semibold text-blue-700">
                  평가 신뢰도
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-blue-700">
                  {result.overallConfidence ?? "-"}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  비교 거래 {result.comparableCount}건
                </p>
              </div>
            </div>

            {result.finalComment && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                <p className="text-xs font-semibold tracking-wide text-slate-500">
                  FINAL COMMENT
                </p>

                <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  종합 의견
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {result.finalComment}
                </p>
              </div>
            )}

            {result.valuationBasis.length > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                <div className="mb-3">
                  <p className="text-xs font-semibold tracking-wide text-slate-500">
                    VALUATION BASIS
                  </p>

                  <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    평가 기준
                  </h3>
                </div>

                <ul className="space-y-2 text-sm text-slate-700">
                  {result.valuationBasis.map((basis) => (
                    <li key={basis} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span>{basis}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recentTransactions.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold tracking-wide text-slate-500">
                      COMPARABLE SALES
                    </p>

                    <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      비교 거래 내역
                    </h3>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    최근 거래 우선
                  </span>
                </div>

                <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">거래일</th>
                        <th className="px-4 py-3 font-semibold">거래금액</th>
                        <th className="px-4 py-3 font-semibold">전용면적</th>
                        <th className="px-4 py-3 font-semibold">층</th>
                        <th className="px-4 py-3 font-semibold">비교군</th>
                        <th className="px-4 py-3 font-semibold">유사도</th>
                        <th className="px-4 py-3 font-semibold">선정 기준</th>
                        <th className="px-4 py-3 font-semibold"></th>
                      </tr>
                    </thead>

                    <tbody>
                      {result.recentTransactions.map((tx, index) => (
                        <tr
                          key={`${tx.dealYear}-${tx.dealMonth}-${tx.dealDay}-${tx.dealAmount}-${index}`}
                          className={
                            index === 0
                              ? "border-b bg-green-50 hover:bg-green-100"
                              : "border-b hover:bg-slate-50"
                          }
                        >
                          <td className="px-4 py-3 text-slate-700">
                            {tx.dealYear}.
                            {String(tx.dealMonth).padStart(2, "0")}.
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
                            {tx.similarityReason
                              ? ` · ${tx.similarityReason}`
                              : ""}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
                <div className="mb-3">
                  <p className="text-xs font-semibold tracking-wide text-amber-700">
                    WARNINGS
                  </p>

                  <h3 className="mt-1 text-xl font-bold tracking-tight text-amber-900">
                    주의사항
                  </h3>
                </div>

                <ul className="space-y-2 text-sm text-amber-900">
                  {result.warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
