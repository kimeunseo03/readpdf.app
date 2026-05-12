"use client";

import { useState } from "react";
import { formatKoreanPrice } from "../../backend/valuation/formatKoreanPrice";

interface MortgageItem {
  rank: number;
  creditor: string;
  amount: number;
  targetOwner?: string;
}

interface ValuationFormProps {
  initialValue: {
    addressRaw?: string;
    buildingName?: string;
    exclusiveAreaM2?: number;
    floor?: number;
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
  riskAdjustedPrice?: number;
  seniorDebtAmount?: number;
  seniorMortgageAmount?: number;
  mortgages?: MortgageItem[];
  tenantDepositAmount?: number;
  tenantMonthlyRent?: number;
  priorityRepaymentAmount?: number;
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
  valuationBasis: string[];
  overallConfidence?: "A" | "B" | "C";
  warnings: string[];
}

function formatAccountingInput(value: string) {
  const numeric = value.replace(/[^0-9]/g, "");
  if (!numeric) return "";
  return Number(numeric).toLocaleString();
}

function parseAccountingInput(value: string) {
  const numeric = value.replace(/[^0-9]/g, "");
  return numeric ? Number(numeric) : undefined;
}

export function ValuationForm({ initialValue }: ValuationFormProps) {
  const [managerName, setManagerName] = useState("");
  const [tenantDepositAmount, setTenantDepositAmount] = useState("");
  const [tenantMonthlyRent, setTenantMonthlyRent] = useState("");
  const [hasRentalInfo, setHasRentalInfo] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function printReport() {
    window.print();
  }

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
          addressRaw: initialValue.addressRaw,
          buildingName: initialValue.buildingName,
          exclusiveAreaM2: initialValue.exclusiveAreaM2,
          floor: initialValue.floor,
          managerName,
          tenantDepositAmount: hasRentalInfo
            ? parseAccountingInput(tenantDepositAmount)
            : undefined,
          tenantMonthlyRent: hasRentalInfo
            ? parseAccountingInput(tenantMonthlyRent)
            : undefined,
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

  const transactionPrices =
    result?.recentTransactions.map((tx) => tx.dealAmount * 10000) ?? [];

  const minTransactionPrice = transactionPrices.length
    ? Math.min(...transactionPrices)
    : undefined;

  const maxTransactionPrice = transactionPrices.length
    ? Math.max(...transactionPrices)
    : undefined;

  return (
    <div className="report-page print-report space-y-6">
      <section className="card-surface p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-wide text-blue-600">
            VALUATION ACTION
          </p>

          <h2 className="mt-1 text-xl font-bold text-slate-900">
            가치평가 실행
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            왼쪽 물건 정보의 최종 수정값을 기준으로 가치평가를 실행합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              담당자명
            </span>

            <input
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
              placeholder="예: 홍길동"
            />
          </label>

          <label className="flex items-end">
            <span className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 shadow-sm">
              <span>임대인 있음</span>
              <input
                type="checkbox"
                checked={hasRentalInfo}
                onChange={(e) => setHasRentalInfo(e.target.checked)}
                className="h-4 w-4"
              />
            </span>
          </label>

          {hasRentalInfo && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  임차보증금(원)
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  value={tenantDepositAmount}
                  onChange={(e) =>
                    setTenantDepositAmount(
                      formatAccountingInput(e.target.value)
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="예: 300,000,000"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  월세(원)
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  value={tenantMonthlyRent}
                  onChange={(e) =>
                    setTenantMonthlyRent(formatAccountingInput(e.target.value))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="예: 1,200,000"
                />
              </label>
            </>
          )}

          <div className="col-span-2 flex justify-end">
            <button
              type="button"
              onClick={runValuation}
              disabled={loading}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
      </section>

      {result && (
        <section className="report-section space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-blue-600">
                  VALUATION RESULT
                </p>

                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  가치평가 결과
                </h2>
              </div>

              <button
                type="button"
                onClick={printReport}
                className="no-print rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                PDF 저장
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-green-100 bg-green-50/60 p-5">
                <p className="text-xs font-semibold text-green-700">
                  보정 평균가
                </p>
                <p className="mt-2 text-xl font-bold leading-snug tabular-nums text-green-700">
                  {formatKoreanPrice(result.averagePrice)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  유사도/이상치 보정 반영
                </p>
              </div>

              <div className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
                <p className="text-xs font-semibold text-red-700">
                  권리 반영가
                </p>
                <p className="mt-2 text-xl font-bold leading-snug tabular-nums text-red-700">
                  {formatKoreanPrice(result.riskAdjustedPrice)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  근저당/보증금 차감 후
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold text-slate-600">
                  평가 신뢰도
                </p>
                <p className="mt-2 text-3xl font-bold text-blue-700">
                  {result.overallConfidence ?? "-"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  비교 거래 {result.comparableCount}건 기준
                </p>
              </div>
            </div>
          </div>

          {result.recentTransactions.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-blue-600">
                    COMPARABLE SALES
                  </p>

                  <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                    비교 거래 내역
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">
                    기준 거래
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                    최저 거래
                  </span>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700">
                    최고 거래
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="report-table text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-[105px] px-4 py-3 font-semibold">
                        거래일
                      </th>
                      <th className="w-[145px] px-4 py-3 font-semibold">
                        거래금액
                      </th>
                      <th className="w-[95px] px-4 py-3 font-semibold">
                        전용면적
                      </th>
                      <th className="w-[70px] px-4 py-3 font-semibold">층</th>
                      <th className="w-[130px] px-4 py-3 font-semibold">
                        비교군
                      </th>
                      <th className="w-[190px] px-4 py-3 font-semibold">
                        유사도
                      </th>
                      <th className="px-4 py-3 font-semibold">선정 기준</th>
                      <th className="w-[80px] px-4 py-3 font-semibold">
                        신뢰도
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.recentTransactions.map((tx, index) => {
                      const price = tx.dealAmount * 10000;
                      const isLowest = price === minTransactionPrice;
                      const isHighest = price === maxTransactionPrice;

                      return (
                        <tr
                          key={`${tx.dealYear}-${tx.dealMonth}-${tx.dealDay}-${tx.dealAmount}-${index}`}
                          className={
                            index === 0
                              ? "border-b bg-green-50/60"
                              : isLowest
                                ? "border-b bg-blue-50/50 hover:bg-blue-50"
                                : isHighest
                                  ? "border-b bg-orange-50/50 hover:bg-orange-50"
                                  : "border-b hover:bg-slate-50"
                          }
                        >
                          <td className="px-4 py-3 text-slate-700">
                            {tx.dealYear}.
                            {String(tx.dealMonth).padStart(2, "0")}.
                            {String(tx.dealDay).padStart(2, "0")}
                          </td>

                          <td className="px-4 py-3 font-medium leading-5 tabular-nums text-slate-700">
                            <div>{formatKoreanPrice(price)}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {index === 0 && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                  기준
                                </span>
                              )}
                              {isLowest && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                  최저
                                </span>
                              )}
                              {isHighest && (
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                  최고
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {tx.area}㎡
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {tx.floor ?? "-"}층
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            <div className="flex flex-wrap gap-1">
                              {tx.isSameApartment ? (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                  동일단지
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  대체비교
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
                            {tx.similarityScore ?? "-"}점
                            {tx.similarityReason
                              ? ` · ${tx.similarityReason}`
                              : ""}
                          </td>

                          <td className="px-4 py-3 leading-5 text-slate-700">
                            {tx.selectionReason ?? "-"}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            {result.finalComment && (
              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-slate-500">
                  FINAL COMMENT
                </p>

                <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                  종합 의견
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {result.finalComment}
                </p>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-7 shadow-sm">
                <p className="text-xs font-semibold tracking-wide text-amber-700">
                  WARNINGS
                </p>

                <h3 className="mt-1 text-lg font-bold tracking-tight text-amber-900">
                  주의사항
                </h3>

                <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                  {[...new Set(result.warnings)].map((warning) => (
                    <li key={warning} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {result.valuationBasis.length > 0 && (
            <details className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                평가기준 및 보정요소 보기
              </summary>

              <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-2">
                {result.valuationBasis.map((basis) => (
                  <li key={basis} className="rounded-xl bg-slate-50 px-4 py-2">
                    {basis}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
