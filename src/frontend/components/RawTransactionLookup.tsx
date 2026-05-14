"use client";
import { useState } from "react";
import { formatKoreanPrice } from "../../backend/valuation/formatKoreanPrice";

type LookupType = "legalDongCode" | "jibun" | "road";

type RawTransaction = {
  dealDate: string;
  aptNm: string;
  dong?: string;
  jibun?: string;
  area?: number;
  floor?: number;
  dealAmount: number;
  buildYear?: number;
  dealType?: string;
  isSameApartment?: boolean;
  areaDifferenceM2?: number;
  floorDifference?: number;
};

type ResolvedAddress = {
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
  jibunAddress?: string;
  roadAddress?: string;
  legalDongCode?: string;
};

type LookupResult = {
  apiLawdCd: string;
  inputLegalDongCode: string;
  lookupType?: LookupType;
  note: string;
  resolvedAddress?: ResolvedAddress;
  transactions: RawTransaction[];
};

type Props = {
  defaultBuildingName?: string;
  defaultArea?: number;
  defaultFloor?: number;
};

function formatNumber(value?: number, suffix = "") {
  if (value === undefined || value === null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString()}${suffix}`;
}

export function RawTransactionLookup({ defaultBuildingName, defaultArea, defaultFloor }: Props) {
  const [lookupType, setLookupType] = useState<LookupType>("legalDongCode");
  const [legalDongCode, setLegalDongCode] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [buildingName, setBuildingName] = useState(defaultBuildingName ?? "");
  const [exclusiveAreaM2, setExclusiveAreaM2] = useState(defaultArea ? String(defaultArea) : "");
  const [targetFloor, setTargetFloor] = useState(defaultFloor ? String(defaultFloor) : "");
  const [limit, setLimit] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);

  async function lookup() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/transactions/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookupType,
          legalDongCode: lookupType === "legalDongCode" ? legalDongCode : undefined,
          addressQuery: lookupType === "legalDongCode" ? undefined : addressQuery.trim(),
          buildingName: buildingName.trim() || undefined,
          exclusiveAreaM2: exclusiveAreaM2 ? Number(exclusiveAreaM2) : undefined,
          targetFloor: targetFloor ? Number(targetFloor) : undefined,
          limit: limit ? Number(limit) : 10,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "실거래 원천 조회에 실패했습니다.");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const isCodeLookup = lookupType === "legalDongCode";

  return (
    <section className="no-print rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-blue-500 uppercase">Raw Transaction Lookup</p>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900">실거래 원천 조회</h3>
          <p className="mt-1 text-sm text-slate-500">법정동코드, 지번주소, 도로명주소 중 하나로 조회합니다. 단지명, 전용면적, 층수는 검증용 선택값입니다.</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { value: "legalDongCode", label: "법정동코드" },
          { value: "jibun", label: "지번주소" },
          { value: "road", label: "도로명주소" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setLookupType(option.value as LookupType)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
              lookupType === option.value
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_140px_120px_100px_auto]">
        {isCodeLookup ? (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">법정동코드 *</span>
            <input value={legalDongCode} onChange={(e) => setLegalDongCode(e.target.value.replace(/[^0-9]/g, ""))} placeholder="5자리 또는 10자리" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100" />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">{lookupType === "jibun" ? "지번주소 *" : "도로명주소 *"}</span>
            <input value={addressQuery} onChange={(e) => setAddressQuery(e.target.value)} placeholder={lookupType === "jibun" ? "예: 서울 송파구 가락동 913" : "예: 서울 송파구 송파대로 345"} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100" />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">단지명 선택</span>
          <input value={buildingName} onChange={(e) => setBuildingName(e.target.value)} placeholder="예: 헬리오시티" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">전용면적 선택</span>
          <input value={exclusiveAreaM2} onChange={(e) => setExclusiveAreaM2(e.target.value)} placeholder="㎡" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">층수 선택</span>
          <input value={targetFloor} onChange={(e) => setTargetFloor(e.target.value.replace(/[^0-9]/g, ""))} placeholder="층" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">개수</span>
          <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100" />
        </label>
        <div className="flex items-end">
          <button type="button" onClick={lookup} disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50">
            {loading ? "조회 중" : "조회"}
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {result && (
        <div className="mt-5">
          <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
            조회방식 {result.lookupType ?? lookupType} · 변환 법정동코드 {result.inputLegalDongCode} · API 호출 코드 {result.apiLawdCd}<br />
            {result.resolvedAddress && (
              <>
                지번: {result.resolvedAddress.jibunAddress ?? "-"} · 도로명: {result.resolvedAddress.roadAddress ?? "-"}<br />
              </>
            )}
            {result.note}
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500">거래일</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500">아파트명</th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-slate-500">지번</th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-slate-500">거래금액</th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-slate-500">면적</th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-slate-500">층</th>
                    <th className="px-3 py-3 text-center text-xs font-bold text-slate-500">동일단지</th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-slate-500">면적차</th>
                    <th className="px-3 py-3 text-right text-xs font-bold text-slate-500">층수차</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.transactions.map((tx, idx) => (
                    <tr key={`${tx.dealDate}-${tx.aptNm}-${tx.dealAmount}-${idx}`} className={tx.isSameApartment ? "bg-blue-50/50" : "bg-white"}>
                      <td className="px-3 py-3 text-xs text-slate-600">{tx.dealDate}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{tx.aptNm}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{tx.jibun || "-"}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-900 whitespace-pre-line">{formatKoreanPrice(tx.dealAmount * 10000)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(tx.area, "㎡")}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(tx.floor, "층")}</td>
                      <td className="px-3 py-3 text-center">{tx.isSameApartment ? <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700">일치</span> : <span className="text-xs text-slate-400">-</span>}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{tx.areaDifferenceM2 !== undefined ? `${tx.areaDifferenceM2.toFixed(3)}㎡` : "-"}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{tx.floorDifference !== undefined ? `${tx.floorDifference}층` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
