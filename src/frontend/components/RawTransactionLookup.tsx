/**
 * RawTransactionLookup — 실거래 결과 표시 전용 컴포넌트
 * ─────────────────────────────────────────────────────
 * 조회 파라미터·상태·차감 입력은 ParseResultView에서 관리합니다.
 * 이 컴포넌트는 결과 테이블 렌더링, 행 선택, 가중 평균 계산만 담당합니다.
 *
 * 주요 기능:
 *   - IQR + 중앙값 ±20% 이중 이상치 탐지 → 추천/비추천 태그
 *   - 행 선택 → 면적·층수·동일단지 기반 가중 평균가 산출
 *   - 담보여력 카드: 보정 평균가 − (근저당 + 임차보증금)
 *
 * 데이터 흐름:
 *   ParseResultView → /api/transactions/raw (POST) → result prop
 *   → 정렬·태깅 → 테이블 렌더 → 담보여력 카드
 * ─────────────────────────────────────────────────────
 */
"use client";
import { useEffect, useRef, useMemo, useState } from "react";
import { formatKoreanPrice, formatKoreanPriceInline } from "../../backend/valuation/formatKoreanPrice";

type SortType = "default" | "latest" | "apartment" | "area";

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "default",   label: "기본 정렬" },
  { value: "latest",    label: "거래일 순" },
  { value: "apartment", label: "아파트 순" },
  { value: "area",      label: "면적 차이 순" },
];

export type RawTransaction = {
  dealDate: string;
  dealDateKey?: number;
  aptNm: string;
  dong?: string;
  jibun?: string;
  area?: number;
  floor?: number;
  dealAmount: number;
  buildYear?: number;
  dealType?: string;
  isSameApartment?: boolean;
  isDirect?: boolean;
  areaDifferenceM2?: number;
  floorDifference?: number;
  matchType?: "same_apartment" | "same_dong_fallback";
};

type ResolvedAddress = {
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
  jibunAddress?: string;
  roadAddress?: string;
  legalDongCode?: string;
};

export type LookupResult = {
  apiLawdCd: string;
  inputLegalDongCode: string;
  note: string;
  resolvedAddress?: ResolvedAddress;
  transactions: RawTransaction[];
};

type Props = {
  /** 0건 안내에 표시할 현재 조회 개수 */
  limit: string;
  loading: boolean;
  error: string | null;
  result: LookupResult | null;
  /** 담보여력 카드용 차감 계산값 (ParseResultView에서 전달) */
  hasTenant: boolean;
  totalDeposit: number;
  mortgageAmt: number;
  seniorDebtTotal: number;
};

// ── 가중 평균가 계산 ── 동일단지 3×, 직거래 0.8×, 면적·층수차 역가중 ──────────
function calcWeightedAvg(transactions: RawTransaction[]): number | null {
  if (transactions.length === 0) return null;
  let sumW = 0;
  let sumPW = 0;
  for (const tx of transactions) {
    const areaDiff = tx.areaDifferenceM2 ?? 0;
    const floorDiff = tx.floorDifference ?? 0;
    const aptMultiplier = tx.isSameApartment ? WEIGHT.aptMultiplier : 1;
    const directPenalty = tx.isDirect ? WEIGHT.directPenalty : 1;
    const w = (aptMultiplier * directPenalty) / (1 + areaDiff * WEIGHT.areaDiffFactor + floorDiff * WEIGHT.floorDiffFactor);
    sumW += w;
    sumPW += tx.dealAmount * 10000 * w;
  }
  return sumW > 0 ? sumPW / sumW : null;
}

type TxTag = "추천" | "비추천" | null;

// ── 튜닝 상수 — 모든 점수·가중치를 여기서만 수정 ──────────────────────────────
const SCORE = {
  sameApt:        3,
  notOutlier:     2,
  directDeal:    -2,
  areaDiffExact:  { sameApt: 3, other: 2 },
  areaDiffClose:  { sameApt: 2, other: 1 },
  dateRecent:     2,
  dateMid:        1,
  floorExact:     { sameApt: 2, other: 1 },
  floorClose:     { sameApt: 1, other: 0 },
  topNRatio:              0.3,
  topNMin:                3,
  areaDiffCloseThreshold: 2,
  floorCloseThreshold:    2,
} as const;

const WEIGHT = {
  aptMultiplier:   3,
  directPenalty:   0.8,
  areaDiffFactor:  0.03,
  floorDiffFactor: 0.015,
} as const;

const OUTLIER = {
  iqrMultiplier:   1.5,
  iqrMinSample:    8,
  medianMinSample: 3,
  medianLower:     0.8,
  medianUpper:     1.2,
} as const;

// ── 이상치 탐지 ── IQR×1.5 (n≥8) + 중앙값 ±20% (n≥3) 이중 필터 ──────────────

/** IQR 기반 이상치 범위 (표본 8건 이상일 때만 적용) */
function calcIqrBounds(transactions: RawTransaction[]): { lower: number; upper: number } | null {
  if (transactions.length < OUTLIER.iqrMinSample) return null;
  const prices = [...transactions.map((t) => t.dealAmount)].sort((a, b) => a - b);
  const q1 = prices[Math.floor(prices.length * 0.25)];
  const q3 = prices[Math.floor(prices.length * 0.75)];
  const iqr = q3 - q1;
  return { lower: q1 - OUTLIER.iqrMultiplier * iqr, upper: q3 + OUTLIER.iqrMultiplier * iqr };
}

/** 중앙값 ±20% 기반 이상치 범위 (표본 적을 때 보조 필터) */
function calcMedianBounds(transactions: RawTransaction[]): { lower: number; upper: number } | null {
  if (transactions.length < OUTLIER.medianMinSample) return null;
  const prices = [...transactions.map((t) => t.dealAmount)].sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  return { lower: median * OUTLIER.medianLower, upper: median * OUTLIER.medianUpper };
}

// ── 추천 태그 산출 ── SCORE 기준 점수화 → 상위 30%(최소 3건) 추천, 이상치 비추천 ──
function calcTxTags(transactions: RawTransaction[]): { tags: TxTag[]; ranks: (number | null)[] } {
  if (transactions.length === 0) return { tags: [], ranks: [] };
  const iqrBounds    = calcIqrBounds(transactions);
  const medianBounds = calcMedianBounds(transactions);
  const dateKeys = transactions.map((t) => t.dealDateKey ?? 0).sort((a, b) => a - b);
  const dateQ50 = dateKeys[Math.floor(dateKeys.length * 0.5)];
  const dateQ75 = dateKeys[Math.floor(dateKeys.length * 0.75)];

  const scores = transactions.map((t) => {
    const iqrOut    = iqrBounds    ? t.dealAmount < iqrBounds.lower    || t.dealAmount > iqrBounds.upper    : false;
    const medianOut = medianBounds ? t.dealAmount < medianBounds.lower || t.dealAmount > medianBounds.upper : false;
    const isOutlier = iqrOut || medianOut;

    let score = 0;
    if (t.isSameApartment) score += SCORE.sameApt;
    if (!isOutlier) score += SCORE.notOutlier;
    if (t.isDirect) score += SCORE.directDeal;
    const areaDiff = t.areaDifferenceM2 ?? 999;
    if (areaDiff === 0) score += t.isSameApartment ? SCORE.areaDiffExact.sameApt : SCORE.areaDiffExact.other;
    else if (areaDiff <= SCORE.areaDiffCloseThreshold) score += t.isSameApartment ? SCORE.areaDiffClose.sameApt : SCORE.areaDiffClose.other;
    const dk = t.dealDateKey ?? 0;
    if (dk >= dateQ75) score += SCORE.dateRecent;
    else if (dk >= dateQ50) score += SCORE.dateMid;
    if ((t.floorDifference ?? 999) === 0) score += t.isSameApartment ? SCORE.floorExact.sameApt : SCORE.floorExact.other;
    else if ((t.floorDifference ?? 999) <= SCORE.floorCloseThreshold) score += t.isSameApartment ? SCORE.floorClose.sameApt : SCORE.floorClose.other;
    return { score, isOutlier };
  });

  const topN = Math.max(SCORE.topNMin, Math.ceil(transactions.length * SCORE.topNRatio));

  const sameAptEligible = scores.filter((s, i) => !s.isOutlier && transactions[i].isSameApartment);
  const onlySameApt = sameAptEligible.length >= topN;

  const eligible = scores
    .map((s, i) => ({ ...s, i }))
    .filter(({ isOutlier, i }) => !isOutlier && (!onlySameApt || transactions[i].isSameApartment))
    .sort((a, b) =>
      b.score !== a.score
        ? b.score - a.score
        : (transactions[b.i].dealDateKey ?? 0) - (transactions[a.i].dealDateKey ?? 0)
    );

  const rankMap = new Map(eligible.slice(0, topN).map(({ i }, rankIdx) => [i, rankIdx + 1]));

  const tags: TxTag[]            = scores.map(({ isOutlier }, i) => isOutlier ? "비추천" : rankMap.has(i) ? "추천" : null);
  const ranks: (number | null)[] = scores.map((_, i) => rankMap.get(i) ?? null);

  return { tags, ranks };
}

/** YYYYMMDD 숫자키 → "YYYY.MM" 문자열 */
function keyToYearMonth(k: number): string {
  const y = Math.floor(k / 10000);
  const m = Math.floor((k % 10000) / 100);
  return `${y}.${String(m).padStart(2, "0")}`;
}

export function RawTransactionLookup({
  limit,
  loading,
  error,
  result,
  hasTenant,
  totalDeposit,
  mortgageAmt,
  seniorDebtTotal,
}: Props) {
  const [sortType, setSortType] = useState<SortType>("default");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 정렬 기준 변경 시 선택 초기화 — 행 순서가 바뀌면 인덱스 기반 선택이 엉킴
  useEffect(() => { setSelectedIndices(new Set()); }, [sortType]);
  // 새 조회 결과 로드 시 선택 초기화
  useEffect(() => { setSelectedIndices(new Set()); }, [result]);

  const sortedTransactions = useMemo(() => {
    if (!result?.transactions) return [];
    const items = [...result.transactions];
    if (sortType === "default") {
      return items.sort((a, b) => {
        const sameA = a.isSameApartment ? 0 : 1;
        const sameB = b.isSameApartment ? 0 : 1;
        if (sameA !== sameB) return sameA - sameB;
        const areaDiff = (a.areaDifferenceM2 ?? 999) - (b.areaDifferenceM2 ?? 999);
        if (areaDiff !== 0) return areaDiff;
        const dateDiff = (b.dealDateKey ?? 0) - (a.dealDateKey ?? 0);
        if (dateDiff !== 0) return dateDiff;
        return (a.floorDifference ?? 999) - (b.floorDifference ?? 999);
      });
    }
    if (sortType === "latest") return items.sort((a, b) => (b.dealDateKey ?? 0) - (a.dealDateKey ?? 0));
    if (sortType === "apartment") {
      return items.sort((a, b) => {
        const sameA = a.isSameApartment ? 0 : 1;
        const sameB = b.isSameApartment ? 0 : 1;
        if (sameA !== sameB) return sameA - sameB;
        const nameCompare = a.aptNm.localeCompare(b.aptNm, "ko");
        if (nameCompare !== 0) return nameCompare;
        return (b.dealDateKey ?? 0) - (a.dealDateKey ?? 0);
      });
    }
    if (sortType === "area") {
      return items.sort((a, b) => {
        const areaDiff = (a.areaDifferenceM2 ?? 999) - (b.areaDifferenceM2 ?? 999);
        if (areaDiff !== 0) return areaDiff;
        return (b.dealDateKey ?? 0) - (a.dealDateKey ?? 0);
      });
    }
    return items;
  }, [result, sortType]);

  const { tags: txTags, ranks: txRanks } = useMemo(() => calcTxTags(sortedTransactions), [sortedTransactions]);

  const dateRange = useMemo(() => {
    if (!result?.transactions?.length) return null;
    const keys = result.transactions.map((t) => t.dealDateKey ?? 0).filter((k) => k > 0);
    if (!keys.length) return null;
    return { oldest: keyToYearMonth(Math.min(...keys)), newest: keyToYearMonth(Math.max(...keys)) };
  }, [result]);

  const selectedTransactions = useMemo(
    () => sortedTransactions.filter((_, i) => selectedIndices.has(i)),
    [sortedTransactions, selectedIndices]
  );

  const weightedAvgPrice = useMemo(() => calcWeightedAvg(selectedTransactions), [selectedTransactions]);

  // 음수 허용 — 담보가치가 선순위 채권보다 낮을 때도 표시
  const collateralValue = weightedAvgPrice !== null ? weightedAvgPrice - seniorDebtTotal : null;

  const allSelected = sortedTransactions.length > 0 && selectedIndices.size === sortedTransactions.length;
  const someSelected = selectedIndices.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) setSelectedIndices(new Set());
    else setSelectedIndices(new Set(sortedTransactions.map((_, i) => i)));
  }

  function toggleOne(idx: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  const hasOutlierSelected = selectedTransactions.some(
    (t) => txTags[sortedTransactions.indexOf(t)] === "비추천"
  );

  // 정렬 기준 컬럼 하이라이트 키
  const sortActiveCol: Record<SortType, string | null> = {
    default: null, latest: "date", apartment: "name", area: "areadiff",
  };
  const activeCol = sortActiveCol[sortType];

  return (
    <div className="min-w-0">

      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="shrink-0">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* 로딩 스켈레톤 — 조회 중일 때 테이블 자리 표시 */}
      {loading && (
        <div className="no-print animate-pulse space-y-2">
          <div className="h-10 rounded-xl bg-slate-100" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
              <div className="h-4 w-4 rounded bg-slate-100" />
              <div className="h-4 flex-1 rounded bg-slate-100" />
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-4 w-16 rounded bg-slate-100" />
              <div className="h-4 w-12 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {result && (
        <>
          {/* 결과 메타 정보 */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-1">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span>
                <span className="font-semibold text-slate-600">법정동코드</span>{" "}
                <span className="font-mono text-slate-800">{result.apiLawdCd || result.inputLegalDongCode || "-"}</span>
              </span>
              {result.resolvedAddress?.jibunAddress && (
                <span>
                  <span className="font-semibold text-slate-600">지번</span>{" "}
                  <span className="text-slate-800">{result.resolvedAddress.jibunAddress}</span>
                </span>
              )}
              {result.resolvedAddress?.eupmyeondong && (
                <span>
                  <span className="font-semibold text-slate-600">읍면동</span>{" "}
                  <span className="text-slate-800">{result.resolvedAddress.eupmyeondong}</span>
                </span>
              )}
              {dateRange && (
                <span>
                  <span className="font-semibold text-slate-600">거래 기간</span>{" "}
                  <span className="text-slate-800">{dateRange.oldest} ~ {dateRange.newest}</span>
                </span>
              )}
            </div>
            {result.note && <p className="text-slate-400">{result.note}</p>}
          </div>

          {/* 동일단지 0건 경고 */}
          {sortedTransactions.length > 0 && !sortedTransactions.some((tx) => tx.isSameApartment) && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-bold text-amber-700">⚠ 동일단지 거래 없음</p>
              <p className="mt-0.5 text-xs text-amber-600">
                조회 기간 내 동일단지 거래가 없어 유사단지만으로 구성된 결과입니다.
                보정 평균가 신뢰도가 낮으므로 참고용으로만 활용하세요.
              </p>
            </div>
          )}

          {/* 0건 안내 — 구체적인 개선 방법 제시 */}
          {sortedTransactions.length === 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-5">
              <p className="font-bold text-amber-700 text-sm">조회된 거래가 없습니다</p>
              <ul className="mt-2 space-y-1 text-xs text-amber-600 list-disc list-inside">
                <li><strong>조회 개수</strong>를 늘리세요 (현재 {limit}건 → 20~30건 권장)</li>
                <li><strong>면적 범위</strong>를 ±5㎡ 이상으로 넓혀 재조회</li>
                <li><strong>단지명</strong>이 정확한지 확인 (오타·약칭 주의)</li>
                <li>신규 단지이거나 거래 빈도가 낮은 지역일 수 있습니다</li>
              </ul>
            </div>
          )}

          {sortedTransactions.length > 0 && (
            <>
              {/* 선택 안내 + 배지 범례 */}
              <p className="no-print mt-3 text-xs text-slate-400">
                행을 클릭해 비교 거래를 선택하세요. 선택한 거래만 담보여력 계산에 반영됩니다.
              </p>
              <p className="no-print mt-1 text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-semibold text-emerald-600">추천</span> = 동일 단지·면적·층수 기준 점수 상위 30%
                <span className="text-slate-300">|</span>
                <span className="font-semibold text-red-500">비추천</span> = IQR 또는 중앙값 ±20% 기준을 벗어난 이상치
                <span className="text-slate-300">|</span>
                <span className="font-semibold text-orange-500">직거래</span> = 중개 없이 당사자 간 직접 거래 (감점 적용)
              </p>

              {/* 정렬 + 건수 + 전체선택/초기화 */}
              <div className="no-print mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-500">
                    총 <span className="font-bold text-slate-900">{sortedTransactions.length}건</span>
                    {selectedIndices.size > 0 && (
                      <span className="ml-2 text-blue-600 font-bold">{selectedIndices.size}건 선택</span>
                    )}
                  </p>
                  {!allSelected ? (
                    <button type="button" onClick={toggleAll}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors">
                      전체 선택
                    </button>
                  ) : (
                    <button type="button" onClick={() => setSelectedIndices(new Set())}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
                      선택 초기화
                    </button>
                  )}
                  {someSelected && !allSelected && (
                    <button type="button" onClick={() => setSelectedIndices(new Set())}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
                      선택 초기화
                    </button>
                  )}
                </div>
                <div ref={sortMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSortMenu((prev) => !prev)}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <span>정렬: {SORT_OPTIONS.find((o) => o.value === sortType)?.label ?? "기본 정렬"}</span>
                    <svg className={`h-4 w-4 text-slate-400 transition-transform ${showSortMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showSortMenu && (
                    <div className="absolute right-0 z-10 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      {SORT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => { setSortType(option.value); setShowSortMenu(false); }}
                          className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${sortType === option.value ? "font-bold text-blue-600" : "text-slate-700"}`}
                        >
                          {sortType === option.value
                            ? <svg className="h-3.5 w-3.5 shrink-0 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            : <span className="w-3.5 shrink-0" />}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 인쇄 전용: 건수 요약 */}
              <div className="hidden print:block mt-4 text-sm text-slate-500">
                총 <span className="font-bold text-slate-900">{sortedTransactions.length}건</span>
                {selectedIndices.size > 0 && (
                  <span className="ml-2 text-blue-600 font-bold">({selectedIndices.size}건 선택 평균 반영)</span>
                )}
              </div>

              {/* 담보여력 카드 — 테이블 위 고정 표시 (선택 전엔 안내 문구, 선택 후 계산값) */}
              <div className="no-print mt-3 grid grid-cols-2 gap-3">

                {/* 카드 ①: 보정 평균가 */}
                <div className={`rounded-xl border p-3 transition-colors ${
                  weightedAvgPrice !== null ? "border-blue-200 bg-blue-50/60" : "border-slate-100 bg-slate-50/50"
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">보정 평균가</p>
                    {weightedAvgPrice !== null && (
                      <span
                        title={`가중 평균 계산 방식\n─────────────────\n• 동일단지: 가중치 3배\n• 직거래: 가중치 0.8배 (감점)\n• 면적차 클수록 / 층수차 클수록 가중치 감소\n• 가중치 = (동일단지배수 × 직거래배수) ÷ (1 + 면적차×0.03 + 층수차×0.015)\n─────────────────\n비슷한 조건의 거래일수록 평균가에 더 많이 반영됩니다.`}
                        className="cursor-help rounded-full bg-blue-200 text-blue-700 text-[9px] font-black w-3.5 h-3.5 flex items-center justify-center leading-none select-none"
                      >?</span>
                    )}
                  </div>
                  {weightedAvgPrice !== null ? (
                    <>
                      <p className="text-xl font-black text-blue-700 leading-tight whitespace-nowrap">
                        {formatKoreanPrice(weightedAvgPrice)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        선택 {selectedIndices.size}건 · 면적·층수 가중평균
                      </p>
                      {selectedTransactions.length >= 2 && (
                        <p className="mt-0.5 text-[10px] text-slate-300">
                          {formatKoreanPrice(Math.min(...selectedTransactions.map(t => t.dealAmount * 10000)))}
                          {" ~ "}
                          {formatKoreanPrice(Math.max(...selectedTransactions.map(t => t.dealAmount * 10000)))}
                        </p>
                      )}
                      {hasOutlierSelected && (
                        <p className="mt-1 text-[11px] font-semibold text-red-500">⚠ 비추천 포함</p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-300">아래 거래를 선택하면 계산됩니다</p>
                  )}
                </div>

                {/* 카드 ②: 차감 내역 */}
                <div className={`rounded-xl border p-3 transition-colors ${
                  weightedAvgPrice !== null ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/50"
                }`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">차감 내역</p>
                  {weightedAvgPrice !== null ? (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">보정 평균가</span>
                        <span className="font-semibold whitespace-nowrap text-blue-600">{formatKoreanPrice(weightedAvgPrice)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">
                          <span className="inline-block rounded-full bg-slate-600 px-1.5 py-0.5 text-[9px] font-black text-white leading-none mr-1">①</span>
                          근저당
                        </span>
                        <span className={`font-semibold whitespace-nowrap ${mortgageAmt > 0 ? "text-red-500" : "text-slate-300"}`}>
                          {mortgageAmt > 0 ? `− ${formatKoreanPrice(mortgageAmt)}` : "없음"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-400">
                          <span className="inline-block rounded-full bg-slate-600 px-1.5 py-0.5 text-[9px] font-black text-white leading-none mr-1">②</span>
                          임차보증금
                        </span>
                        <span className={`font-semibold whitespace-nowrap ${hasTenant && totalDeposit > 0 ? "text-amber-500" : "text-slate-300"}`}>
                          {hasTenant && totalDeposit > 0 ? `− ${formatKoreanPrice(totalDeposit)}` : "해당 없음"}
                        </span>
                      </div>
                      <div className={`flex justify-between gap-2 border-t border-slate-100 pt-1.5 mt-0.5 ${
                        seniorDebtTotal > 0 && collateralValue !== null
                          ? collateralValue >= 0 ? "text-emerald-700" : "text-red-600"
                          : "text-slate-300"
                      }`}>
                        <span className="font-black">담보여력</span>
                        <span className="font-black whitespace-nowrap text-sm">
                          {seniorDebtTotal > 0 && collateralValue !== null
                            ? (collateralValue < 0 ? "−" : "") + formatKoreanPrice(Math.abs(collateralValue))
                            : "—"}
                        </span>
                      </div>
                      {seniorDebtTotal === 0 && (
                        <p className="mt-1.5 text-[11px] text-amber-500">⚠ 차감 항목 미입력</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300">아래 거래를 선택하면 계산됩니다</p>
                  )}
                </div>

              </div>

              {/* 거래 테이블 — outer에 overflow-hidden 제거해 정렬 드롭다운 클리핑 방지 */}
              <div className="no-print mt-3 rounded-2xl border border-slate-200">
                <div className="overflow-x-auto rounded-2xl">
                  <table className="w-full min-w-[660px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="no-print w-10 px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected; }}
                            onChange={toggleAll}
                            className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                          />
                        </th>
                        <th className={`px-3 py-3 text-center text-xs font-bold text-slate-500 whitespace-nowrap ${activeCol === "date" ? "bg-blue-50 text-blue-600" : ""}`}>거래일</th>
                        <th className={`px-3 py-3 text-center text-xs font-bold text-slate-500 ${activeCol === "name" ? "bg-blue-50 text-blue-600" : ""}`}>아파트명</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 whitespace-nowrap">거래금액</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 whitespace-nowrap">면적·층</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-slate-500">구분</th>
                        <th className="px-3 py-3 text-center text-xs font-bold text-slate-500">추천</th>
                        <th className={`px-3 py-3 text-center text-xs font-bold text-slate-500 whitespace-nowrap ${activeCol === "areadiff" || activeCol === "floordiff" ? "bg-blue-50 text-blue-600" : ""}`}>면적차·층차</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedTransactions.map((tx, idx) => {
                        const tag = txTags[idx];
                        const rank = txRanks[idx];
                        const isOutlier = tag === "비추천";
                        const isSelected = selectedIndices.has(idx);
                        const rowBase = isOutlier
                          ? isSelected ? "bg-red-50 hover:bg-red-100/70" : "bg-red-50/40 hover:bg-red-50"
                          : isSelected ? "bg-blue-50 hover:bg-blue-100/70" : "hover:bg-slate-50";
                        const colHl = (col: string) =>
                          activeCol === col && !isSelected && !isOutlier ? "bg-blue-50/40" : "";
                        return (
                          <tr
                            key={`${tx.dealDate}-${tx.aptNm}-${tx.dealAmount}-${idx}`}
                            onClick={() => toggleOne(idx)}
                            className={`cursor-pointer transition-colors ${rowBase}`}
                          >
                            <td className="no-print px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleOne(idx)}
                                className="h-4 w-4 rounded accent-blue-600 cursor-pointer"
                              />
                            </td>
                            <td className={`px-3 py-3 text-center text-xs text-slate-500 whitespace-nowrap ${colHl("date")}`}>{tx.dealDate}</td>
                            <td className={`px-3 py-3 text-left font-semibold whitespace-nowrap ${isOutlier ? "text-red-700" : "text-slate-900"} ${colHl("name")}`}>{tx.aptNm}</td>
                            <td className={`px-3 py-3 text-left font-bold whitespace-nowrap ${isOutlier ? "text-red-600" : "text-slate-900"}`}>
                              {formatKoreanPriceInline(tx.dealAmount * 10000)}
                            </td>
                            <td className="px-3 py-3 text-left text-slate-600 whitespace-nowrap">
                              {tx.area !== undefined ? `${tx.area.toFixed(1)}㎡` : "-"}
                              {tx.floor !== undefined ? ` · ${tx.floor}층` : ""}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="inline-flex flex-col items-center gap-px">
                                {tx.matchType === "same_dong_fallback"
                                  ? <span className="rounded-full bg-amber-100 px-2 py-px text-[11px] font-bold text-amber-700 leading-none whitespace-nowrap">유사단지</span>
                                  : <span className="rounded-full bg-blue-100 px-2 py-px text-[11px] font-bold text-blue-700 leading-none whitespace-nowrap">동일단지</span>}
                                {tx.isDirect && (
                                  <span className="rounded-full bg-orange-100 px-2 py-px text-[10px] font-bold text-orange-600 leading-none whitespace-nowrap">직거래</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap">
                              {tag === "추천" && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 whitespace-nowrap">
                                  {rank}순위
                                </span>
                              )}
                              {tag === "비추천" && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600 whitespace-nowrap">비추천</span>
                              )}
                            </td>
                            <td className={`px-3 py-3 text-center whitespace-nowrap ${colHl("areadiff") || colHl("floordiff")}`}>
                              {/* 0차이면 "동일" 표시 — "0.0㎡"보다 직관적 */}
                              <p className="text-slate-500">
                                {tx.areaDifferenceM2 === undefined ? "-"
                                  : tx.areaDifferenceM2 === 0 ? <span className="text-emerald-600 font-semibold">동일</span>
                                  : `${tx.areaDifferenceM2.toFixed(1)}㎡`}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {tx.floorDifference === undefined ? ""
                                  : tx.floorDifference === 0 ? ""
                                  : `${tx.floorDifference}층차`}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 인쇄 전용 축약 테이블 (선택 항목만) */}
              {selectedIndices.size > 0 && (
                <div className="hidden print:block mt-4">
                  <p className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-widest">선택 거래 ({selectedIndices.size}건)</p>
                  <table className="w-full text-xs border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">거래일</th>
                        <th className="px-2 py-1.5 text-left font-bold text-slate-500">아파트명</th>
                        <th className="px-2 py-1.5 text-right font-bold text-slate-500">거래금액</th>
                        <th className="px-2 py-1.5 text-right font-bold text-slate-500">면적</th>
                        <th className="px-2 py-1.5 text-right font-bold text-slate-500">층</th>
                        <th className="px-2 py-1.5 text-center font-bold text-slate-500">구분</th>
                        <th className="px-2 py-1.5 text-center font-bold text-slate-500">추천</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTransactions.map((tx, i) => {
                        const tag = txTags[sortedTransactions.indexOf(tx)];
                        return (
                          <tr key={i} className={tag === "비추천" ? "bg-red-50" : ""}>
                            <td className="px-2 py-1.5 text-slate-600">{tx.dealDate}</td>
                            <td className="px-2 py-1.5 font-semibold text-slate-900">{tx.aptNm}</td>
                            <td className="px-2 py-1.5 text-right font-bold text-slate-900">{(tx.dealAmount).toLocaleString()}만원</td>
                            <td className="px-2 py-1.5 text-right text-slate-600">{tx.area?.toFixed(2)}㎡</td>
                            <td className="px-2 py-1.5 text-right text-slate-600">{tx.floor}층</td>
                            <td className="px-2 py-1.5 text-center">{tx.matchType === "same_dong_fallback" ? "유사단지" : "동일단지"}</td>
                            <td className="px-2 py-1.5 text-center">{tag === "추천" ? "추천" : tag === "비추천" ? "비추천" : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </>
          )}
        </>
      )}
    </div>
  );
}
