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
    roadAddress?: string;
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
  addressBasisType?: "road" | "jibun";
  addressBasisLabel?: string;
  addressBasisAddress?: string;
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
function formatAreaWithPyeong(area?: number) {
  if (!area) return undefined;
  return `${area}㎡ (${(area / 3.3058).toFixed(2)}평)`;
}
function formatCompactProperty(initialValue: ValuationFormProps["initialValue"]) {
  const parts = [
    initialValue.buildingName,
    initialValue.exclusiveAreaM2 ? `전용 ${formatAreaWithPyeong(initialValue.exclusiveAreaM2)}` : undefined,
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
          roadAddress: initialValue.roadAddress,
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
  const extractedMortgageCount = initialValue.rightsRisk?.mortgages?.length ?? 0;
  const mortgageExtractionPaused = extractedMortgageCount > 0 || Boolean(initialValue.rightsRisk?.mortgageAmountText);

  return (
    <div className="report-page print-report space-y-5">
      <section className="no-print card-surface p-6">
        <p className="text-[11px] font-bold tracking-widest text-blue-500 uppercase">Valuation Action</p>
        <h2 className="mt-0.5 text-lg font-bold text-slate-900 mb-4">가치평가 실행</h2>
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/50 px-5 py-4">
          <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-1">평가 기준 물건</p>
          <p className="text-sm font-bold text-slate-900 leading-snug">{initialValue.addressRaw ?? "주소 정보 확인 필요"}</p>
          <p className="mt-1 text-sm text-slate-500">{formatCompactProperty(initialValue)}</p>
          {initialValue.roadAddress && (
            <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5 text-blue-700">
              도로명 보조값: {initialValue.roadAddress}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
...TRUNCATED...
