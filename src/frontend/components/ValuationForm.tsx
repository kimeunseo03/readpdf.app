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
      riskDetails?: { type: string; label: string; severity: "LOW" | "MEDIUM" | "HIGH"; description: string }[];
    };
  };
}
interface ValuationResult {
  success: boolean;
  normalizedAddress?: string;
  buildingName?: string;
  comparableCount: number;
  averagePrice?: number;
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
function formatCompactProperty(initialValue: ValuationFormProps["initialValue"]) {
  const parts = [
    initialValue.buildingName,
    initialValue.exclusiveAreaM2 ? `전용 ${initialValue.exclusiveAreaM2}㎡` : undefined,
    initialValue.floor ? `${initialValue.floor}층` : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "평가 기준 물건 정보 확인 필요";
}

const confidenceConfig = {
  A: { label: "A", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", desc: "신뢰도 높음" },
  B: { label: "B", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", desc: "신뢰도 보통" },
  C: { label: "C", color: "text-red-700", bg: "bg-red-50 border-red-200", desc: "신뢰도 낮음" },
};

export function ValuationForm({ initialValue }: ValuationFormProps) {
  const [managerName, setManagerName] = useState("");
  const [tenantDepositAmount, setTenantDepositAmount] = useState("");
  const [tenantMonthlyRent, setTenantMonthlyRent] = useState("");
  const [hasRentalInfo, setHasRentalInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function printReport() { window.print(); }

  async function runValuation() {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressRaw: initialValue.addressRaw,
          buildingName: initialValue.buildingName,
          exclusiveAreaM2: initialValue.exclusiveAreaM2,
          floor: initialValue.floor,
          managerName,
          tenantDepositAmount: hasRentalInfo ? parseAccountingInput(tenantDepositAmount) : undefined,
          tenantMonthlyRent: hasRentalInfo ? parseAccountingInput(tenantMonthlyRent) : undefined,
          rightsRisk: initialValue.rightsRisk,
        }),
      });
      if (!res.ok) throw new Error("가치평가 API 호출에 실패했습니다.");
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const transactionPrices = result?.recentTransactions.map((tx) => tx.dealAmount * 10000) ?? [];
  const minPrice = transactionPrices.length ? Math.min(...transactionPrices) : undefined;
  const maxPrice = transactionPrices.length ? Math.max(...transactionPrices) : undefined;
  const seniorMortgageAmount = result?.seniorMortgageAmount ?? 0;
  const tenantDeposit = result?.tenantDepositAmount ?? 0;
  const totalDeductedAmount = seniorMortgageAmount + tenantDeposit;
  const conf = result?.overallConfidence ? confidenceConfig[result.overallConfidence] : null;

  // 근저당 목록: result에서 우선, 없으면 등기부 추출값 사용
  const mortgages = result?.mortgages?.length
    ? result.mortgages
    : (initialValue.rightsRisk?.mortgages ?? []);

  return (
    <div className="report-page print-report space-y-5">
      {/* 가치평가 실행 카드 */}
      <section className="card-surface p-6">
        <p className="text-[11px] font-bold tracking-widest text-blue-500 uppercase">Valuation Action</p>
        <h2 className="mt-0.5 text-lg font-bold text-slate-900 mb-4">가치평가 실행</h2>
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/50 px-5 py-4">
          <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-1">평가 기준 물건</p>
          <p className="text-sm font-bold text-slate-900 leading-snug">{initialValue.addressRaw ?? "주소 정보 확인 필요"}</p>
          <p className="mt-1 text-sm text-slate-500">{formatCompactProperty(initialValue)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">담당자명</span>
            <input value={managerName} onChange={(e) => setManagerName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
              placeholder="예: 홍길동" />
          </label>
          <label className="flex items-end">
            <div className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${hasRentalInfo ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
              onClick={() => setHasRentalInfo((v) => !v)}>
              <span>임차인 있음</span>
              <input type="checkbox" checked={hasRentalInfo} onChange={(e) => setHasRentalInfo(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            </div>
          </label>
          {hasRentalInfo && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">임차보증금(원)</span>
                <input type="text" inputMode="numeric" value={tenantDepositAmount}
                  onChange={(e) => setTenantDepositAmount(formatAccountingInput(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="예: 300,000,000" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">월세(원)</span>
                <input type="text" inputMode="numeric" value={tenantMonthlyRent}
                  onChange={(e) => setTenantMonthlyRent(formatAccountingInput(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="예: 1,200,000" />
              </label>
            </>
          )}
          <div className="col-span-2 flex justify-end pt-1">
            <button type="button" onClick={runValuation} disabled={loading}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  평가 중...
                </span>
              ) : "자동 평가 실행"}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <span className="text-base">⚠</span>
            <span>{error}</span>
          </div>
        )}
      </section>

      {result && (
        <div className="report-section space-y-5">
          {/* 결과 수치 카드 4개 */}
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-blue-500 uppercase">Valuation Result</p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">가치평가 결과</h2>
              </div>
              <button type="button" onClick={printReport}
                className="no-print rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">
                PDF 저장
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {/* 보정 평균가 */}
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">보정 평균가</p>
                <p className="mt-3 text-2xl font-black tabular-nums leading-tight text-emerald-700 whitespace-pre-line">
                  {formatKoreanPrice(result.averagePrice)}
                </p>
                <p className="mt-2 text-xs text-slate-400">실거래 유사도 보정 기준</p>
              </div>
              {/* 권리 반영가 */}
              <div className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
                <p className="text-xs font-bold text-red-600 uppercase tracking-wide">권리 반영가</p>
                <p className="mt-3 text-2xl font-black tabular-nums leading-tight text-red-700 whitespace-pre-line">
                  {result.riskAdjustedPrice === 0 ? (
                    <span className="text-red-400">0원</span>
                  ) : formatKoreanPrice(result.riskAdjustedPrice)}
                </p>
                <p className="mt-2 text-xs text-slate-400">선순위 권리 차감 후 기준</p>
                {result.riskAdjustedPrice === 0 && (
                  <p className="mt-1 text-xs text-red-400">⚠ 차감액이 시세 초과</p>
                )}
              </div>
              {/* 신뢰도 */}
              <div className={`rounded-2xl border p-5 ${conf?.bg ?? "border-slate-200 bg-slate-50"}`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${conf?.color ?? "text-slate-500"}`}>평가 신뢰도</p>
                <div className="mt-3 flex items-end gap-2">
                  <p className={`text-4xl font-black ${conf?.color ?? "text-slate-700"}`}>{result.overallConfidence ?? "-"}</p>
                  <p className={`mb-1 text-sm font-semibold ${conf?.color ?? "text-slate-500"}`}>{conf?.desc}</p>
                </div>
                <p className="mt-2 text-xs text-slate-400">비교 거래 {result.comparableCount}건 기준</p>
              </div>
              {/* 선순위 차감액 */}
              <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">선순위 차감액</p>
                <p className="mt-3 text-lg font-black tabular-nums leading-tight text-slate-900 whitespace-pre-line">
                  {totalDeductedAmount > 0 ? formatKoreanPrice(totalDeductedAmount) : "-"}
                </p>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {seniorMortgageAmount > 0 && `근저당 ${formatKoreanPrice(seniorMortgageAmount)}`}
                  {seniorMortgageAmount > 0 && tenantDeposit > 0 && " + "}
                  {tenantDeposit > 0 && `임차보증금 ${formatKoreanPrice(tenantDeposit)}`}
                  {totalDeductedAmount === 0 && "차감 반영 금액 없음"}
                </p>
              </div>
            </div>

            {/* 근저당 테이블 - 등기부 추출 기준 */}
            {mortgages.length > 0 && (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold tracking-widest text-red-500 uppercase">Mortgage Detail</p>
                    <h3 className="mt-0.5 text-base font-bold text-slate-900">근저당권 현황</h3>
                  </div>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                    합계 {formatKoreanPrice(seniorMortgageAmount)}
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-red-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-red-50/60 border-b border-red-100">
                        <th className="px-4 py-3 text-left text-xs font-bold text-red-600 uppercase tracking-wide w-[60px]">순위</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-red-600 uppercase tracking-wide">근저당권자</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-red-600 uppercase tracking-wide w-[200px]">채권최고액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50">
                      {mortgages.map((m) => (
                        <tr key={`${m.rank}-${m.creditor}`} className="hover:bg-red-50/30 transition-colors">
                          <td className="px-4 py-3 text-slate-600 font-semibold">{m.rank}순위</td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {m.creditor || "-"}
                            {m.targetOwner && (
                              <span className="ml-2 text-xs text-slate-400">({m.targetOwner})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-red-700 whitespace-pre-line">
                            {formatKoreanPrice(m.amount)}
                          </td>
                        </tr>
                      ))}
                      {/* 합계 행 */}
                      <tr className="bg-red-50/60 border-t border-red-100">
                        <td className="px-4 py-3 font-bold text-red-900" colSpan={2}>합계</td>
                        <td className="px-4 py-3 text-right font-black tabular-nums text-red-900 whitespace-pre-line">
                          {formatKoreanPrice(seniorMortgageAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* 비교 거래 내역 */}
          {result.recentTransactions.length > 0 && (
            <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-blue-500 uppercase">Comparable Sales</p>
                  <h3 className="mt-0.5 text-lg font-bold text-slate-900">비교 거래 내역</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                  {[
                    { color: "bg-emerald-100 text-emerald-700", label: "기준 거래" },
                    { color: "bg-blue-100 text-blue-700", label: "최저 거래" },
                    { color: "bg-orange-100 text-orange-700", label: "최고 거래" },
                    { color: "bg-slate-100 text-slate-600", label: "대체비교" },
                  ].map((b) => (
                    <span key={b.label} className={`rounded-full px-2.5 py-1 ${b.color}`}>{b.label}</span>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="report-table text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide w-[100px]">거래일</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide w-[160px]">거래금액</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide w-[110px]">면적 / 층</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide w-[130px]">비교유형</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide w-[72px]">유사도</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wide w-[68px]">신뢰도</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">선정 사유</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.recentTransactions.map((tx, index) => {
                        const price = tx.dealAmount * 10000;
                        const isLowest = price === minPrice;
                        const isHighest = price === maxPrice;
                        const rowBg = index === 0
                          ? "bg-emerald-50/60 hover:bg-emerald-50"
                          : isLowest ? "bg-blue-50/40 hover:bg-blue-50"
                          : isHighest ? "bg-orange-50/40 hover:bg-orange-50"
                          : "hover:bg-slate-50";
                        return (
                          <tr key={`${tx.dealYear}-${tx.dealMonth}-${tx.dealDay}-${tx.dealAmount}-${index}`}
                            className={`transition-colors ${rowBg}`}>
                            <td className="px-4 py-3.5 text-slate-600 tabular-nums text-xs">
                              {tx.dealYear}.{String(tx.dealMonth).padStart(2, "0")}.{String(tx.dealDay).padStart(2, "0")}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-bold tabular-nums text-slate-900 leading-snug whitespace-pre-line text-sm">
                                {formatKoreanPrice(price)}
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {index === 0 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">기준</span>}
                                {isLowest && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">최저</span>}
                                {isHighest && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">최고</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-700 tabular-nums">
                              <span className="font-semibold">{tx.area}㎡</span>
                              <span className="text-slate-400 mx-1">/</span>
                              <span>{tx.floor ?? "-"}층</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap gap-1">
                                {tx.isSameApartment ? (
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">동일단지</span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">대체비교</span>
                                )}
                                {(tx.monthsAgo ?? 999) <= 3 && (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">최근거래</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center font-bold text-slate-700">
                              {tx.similarityScore != null ? (
                                <span className={`text-sm ${tx.similarityScore >= 80 ? "text-emerald-600" : tx.similarityScore >= 60 ? "text-amber-600" : "text-red-500"}`}>
                                  {tx.similarityScore}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${
                                tx.reliabilityGrade === "A" ? "bg-emerald-100 text-emerald-700"
                                : tx.reliabilityGrade === "B" ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                              }`}>
                                {tx.reliabilityGrade ?? "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 leading-relaxed">
                              <div className="text-xs">{tx.selectionReason ?? "-"}</div>
                              {tx.similarityReason && (
                                <div className="mt-1 text-[11px] text-slate-400">{tx.similarityReason}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* 종합 의견 + 주의사항 */}
          <div className="grid gap-5 xl:grid-cols-2">
            {result.finalComment && (
              <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Final Comment</p>
                <h3 className="mt-0.5 text-base font-bold text-slate-900 mb-3">종합 의견</h3>
                <p className="text-sm leading-7 text-slate-600">{result.finalComment}</p>
              </section>
            )}
            {result.warnings.length > 0 && (
              <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-7 shadow-sm">
                <p className="text-[11px] font-bold tracking-widest text-amber-500 uppercase">Warnings</p>
                <h3 className="mt-0.5 text-base font-bold text-amber-900 mb-3">주의사항</h3>
                <ul className="space-y-2.5">
                  {[...new Set(result.warnings)].map((w) => (
                    <li key={w} className="flex items-start gap-2.5 text-sm text-amber-800">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span className="leading-relaxed">{w}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* 평가기준 */}
          {result.valuationBasis.length > 0 && (
            <details className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm group">
              <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-bold text-slate-700 select-none">
                <span>평가기준 및 보정요소</span>
                <span className="text-slate-400 group-open:rotate-180 transition-transform text-base">▼</span>
              </summary>
              <ul className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                {result.valuationBasis.map((b) => (
                  <li key={b} className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-slate-600 leading-relaxed">{b}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
