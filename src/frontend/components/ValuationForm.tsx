"use client";

import { useState } from "react";
import { ValuationReport } from "./ValuationReport";
import { formatKoreanPrice } from "../../backend/valuation/formatKoreanPrice";

interface MortgageItem {
  rank: number;
  creditor: string;
  amount: number; // 원
}

interface ValuationFormProps {
  initialValue: {
    addressRaw?: string;
    buildingName?: string;
    exclusiveAreaM2?: number;
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
  const [addressRaw, setAddressRaw] = useState(initialValue.addressRaw ?? "");
  const [buildingName, setBuildingName] = useState(
    initialValue.buildingName ?? ""
  );
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
          tenantDepositAmount: parseAccountingInput(tenantDepositAmount),
          tenantMonthlyRent: parseAccountingInput(tenantMonthlyRent),
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

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            임차보증금(원)
          </span>

          <input
            type="text"
            inputMode="numeric"
            value={tenantDepositAmount}
            onChange={(e) =>
              setTenantDepositAmount(formatAccountingInput(e.target.value))
            }
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
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
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
            placeholder="예: 1,200,000"
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
          <div className="no-print mt-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-blue-600">
                    VALUATION RESULT
                  </p>

                  <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                    가치평가 결과
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={printReport}
                  className="no-print rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  PDF 저장
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-green-100 bg-green-50/50 p-5">
                  <p className="text-xs font-semibold text-green-700">
                    가치평가 계산값
                  </p>

                  <p className="mt-3 whitespace-pre-line text-xl font-bold leading-snug tabular-nums text-green-700">
                    {formatKoreanPrice(result.averagePrice)}
                  </p>

                  <p className="mt-3 text-xs text-slate-500">
                    유사도/IQR 이상치 보정 평균가
                  </p>
                </div>

                <div className="rounded-2xl border border-red-100 bg-red-50/50 p-5">
                  <p className="text-xs font-semibold text-red-700">
                    권리차감 후 계산값
                  </p>

                  <p className="mt-3 whitespace-pre-line text-xl font-bold leading-snug tabular-nums text-red-700">
                    {formatKoreanPrice(result.riskAdjustedPrice)}
                  </p>

                  <p className="mt-3 text-xs text-slate-500">
                    근저당/보증금 차감 후
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
                  <p className="text-xs font-semibold text-blue-700">
                    보수 기준가
                  </p>

                  <p className="mt-3 whitespace-pre-line text-xl font-bold leading-snug tabular-nums text-blue-700">
                    {formatKoreanPrice(result.conservativePrice)}
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5">
                  <p className="text-xs font-semibold text-orange-700">
                    상단 참고가
                  </p>

                  <p className="mt-3 whitespace-pre-line text-xl font-bold leading-snug tabular-nums text-orange-700">
                    {formatKoreanPrice(result.upperReferencePrice)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <p className="text-xs font-semibold tracking-wide text-slate-500">
                    RIGHTS DEDUCTION
                  </p>

                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    권리 차감 내역
                  </h3>

                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div className="flex justify-between gap-4">
                      <span>선순위 근저당 합계</span>
                      <strong>
                        {formatKoreanPrice(result.seniorMortgageAmount)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span>임차보증금</span>
                      <strong>
                        {formatKoreanPrice(result.tenantDepositAmount)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
                      <span>권리 차감 합계</span>
                      <strong className="text-red-700">
                        {formatKoreanPrice(result.seniorDebtAmount)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-4 text-xs text-slate-500">
                      <span>최우선변제금 추정 참고</span>
                      <span>
                        {formatKoreanPrice(result.priorityRepaymentAmount)}
                      </span>
                    </div>
                  </div>

                  {(result.mortgages?.length ?? 0) > 0 && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-bold text-slate-900">
                          근저당권 현황
                        </p>
                      </div>

                      <table className="w-full text-left text-xs">
                        <thead className="bg-white text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-semibold">순위</th>
                            <th className="px-3 py-2 font-semibold">
                              근저당권자
                            </th>
                            <th className="px-3 py-2 text-right font-semibold">
                              금액(원)
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {result.mortgages?.map((mortgage) => (
                            <tr
                              key={`${mortgage.rank}-${mortgage.creditor}-${mortgage.amount}`}
                              className="border-t border-slate-100"
                            >
                              <td className="px-3 py-2 text-slate-700">
                                {mortgage.rank}
                              </td>

                              <td className="px-3 py-2 font-medium text-slate-900">
                                {mortgage.creditor || "-"}
                              </td>

                              <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                                {mortgage.amount.toLocaleString()}원
                              </td>
                            </tr>
                          ))}

                          <tr className="border-t border-slate-200 bg-slate-50">
                            <td
                              colSpan={2}
                              className="px-3 py-2 font-bold text-slate-900"
                            >
                              합계
                            </td>

                            <td className="px-3 py-2 text-right font-bold tabular-nums text-red-700">
                              {result.seniorMortgageAmount?.toLocaleString() ??
                                "-"}
                              원
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div
                  className={
                    initialValue.rightsRisk?.riskLevel === "SAFE"
                      ? "rounded-2xl border border-green-100 bg-green-50/50 p-5"
                      : initialValue.rightsRisk?.riskLevel === "CAUTION"
                        ? "rounded-2xl border border-yellow-100 bg-yellow-50/50 p-5"
                        : "rounded-2xl border border-red-100 bg-red-50/50 p-5"
                  }
                >
                  <p className="text-xs font-semibold tracking-wide text-slate-500">
                    RISK / CONFIDENCE
                  </p>

                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    권리 위험도 · 평가 신뢰도
                  </h3>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500">권리 위험도</p>
                      <p className="mt-1 text-2xl font-bold">
                        {initialValue.rightsRisk?.riskLevel === "SAFE" &&
                          "안전"}
                        {initialValue.rightsRisk?.riskLevel === "CAUTION" &&
                          "주의"}
                        {initialValue.rightsRisk?.riskLevel === "DANGER" &&
                          "위험"}
                        {!initialValue.rightsRisk?.riskLevel && "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">평가 신뢰도</p>
                      <p className="mt-1 text-2xl font-bold text-blue-700">
                        {result.overallConfidence ?? "-"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-slate-500">
                    비교 거래 {result.comparableCount}건 기준
                  </p>
                </div>
              </div>

              {result.finalComment && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
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

              {result.recentTransactions.length > 0 && (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-slate-500">
                        COMPARABLE SALES
                      </p>

                      <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                        비교 거래 내역
                      </h3>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      최근 거래 우선
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-[980px] w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">거래일</th>
                          <th className="px-4 py-3 font-semibold">거래금액</th>
                          <th className="px-4 py-3 font-semibold">전용면적</th>
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
                            className={
                              index === 0
                                ? "border-b bg-green-50"
                                : "border-b hover:bg-slate-50"
                            }
                          >
                            <td className="px-4 py-3 text-slate-700">
                              {tx.dealYear}.
                              {String(tx.dealMonth).padStart(2, "0")}.
                              {String(tx.dealDay).padStart(2, "0")}
                            </td>

                            <td className="whitespace-pre-line px-4 py-3 font-medium tabular-nums text-slate-700">
                              {formatKoreanPrice(tx.dealAmount * 10000)}
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.warnings.length > 0 && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                  <p className="text-xs font-semibold tracking-wide text-amber-700">
                    WARNINGS
                  </p>

                  <h3 className="mt-1 text-lg font-bold tracking-tight text-amber-900">
                    주의사항
                  </h3>

                  <ul className="mt-3 space-y-2 text-sm text-amber-900">
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
