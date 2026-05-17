/**
 * ParseResultView — 등기부 판독 결과 + 실거래 조회 통합 뷰
 * ─────────────────────────────────────────────────────────
 * 레이아웃:
 *   상단 2분할: [등기부 판독 결과] | [조회 조건]
 *   하단 전체: 실거래 원천 조회 결과 테이블
 *
 * 상태:
 *   editableProperty : 현재 적용된 물건 정보 (PDF 추출 or 수정값)
 *   draftProperty    : 수정 중 임시 값 (Apply 전까지 반영 안 됨)
 *   isEditing        : 수정 모드 on/off
 *   buildingName, exclusiveAreaM2, targetFloor, limit : 조회 파라미터
 *   hasTenant, tenantDeposit, tenantMonthly           : 차감 항목
 *   loading, error, result                            : 조회 상태
 *
 * 인쇄: window.print() → @media print 스타일 적용
 *       no-print 요소 숨김, 면책 문구 자동 삽입
 * ─────────────────────────────────────────────────────────
 */
"use client";
import { useState, useEffect, useMemo } from "react";
import type { ParseApiResponse } from "@frontend/lib/api";
import { RawTransactionLookup, type LookupResult } from "./RawTransactionLookup";
import { formatKoreanPrice } from "@backend/valuation/formatKoreanPrice";

type EditableProperty = {
  addressRaw?: string;
  roadAddress?: string;
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
  buildingName?: string;
  buildingDong?: string;
  unitNumber?: string;
  floor?: number;
  exclusiveAreaM2?: number;
};

type DraftErrors = {
  exclusiveAreaM2?: string;
  floor?: string;
};

function validateDraft(draft: EditableProperty): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.exclusiveAreaM2 || draft.exclusiveAreaM2 <= 0)
    errors.exclusiveAreaM2 = "전유면적은 0보다 커야 합니다";
  if (!draft.floor || draft.floor <= 0)
    errors.floor = "층수는 0보다 커야 합니다";
  return errors;
}

function normalizeNumberInput(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatAreaWithPyeong(area?: number) {
  if (!area) return undefined;
  return `${area}㎡ (${(area / 3.3058).toFixed(2)}평)`;
}

/** 숫자 문자열 파싱 — 쉼표 등 비숫자 제거 */
function parseNumberInput(v: string): number {
  return Number(v.replace(/[^0-9]/g, "")) || 0;
}

/** 숫자 입력값 천 단위 콤마 포매팅 */
function fmtInput(v: string): string {
  const n = v.replace(/[^0-9]/g, "");
  return n ? Number(n).toLocaleString() : "";
}

/**
 * 최우선변제금 계산 (2023.2.21 기준)
 * 보증금이 기준 상한을 초과하면 적용 대상 아님 → 0 반환
 */
function calcPriorityRepayment(deposit: number, sido?: string): number {
  if (!deposit) return 0;
  if (sido?.includes("서울"))
    return deposit <= 165_000_000 ? Math.min(deposit, 55_000_000) : 0;
  if (sido?.includes("경기") || sido?.includes("인천"))
    return deposit <= 145_000_000 ? Math.min(deposit, 48_000_000) : 0;
  if (["부산", "대구", "광주", "대전", "울산", "세종"].some((c) => sido?.includes(c)))
    return deposit <= 85_000_000 ? Math.min(deposit, 28_000_000) : 0;
  return deposit <= 75_000_000 ? Math.min(deposit, 25_000_000) : 0;
}

/** 월세 → 보증금 환산 (월세×100 + 보증금) */
function convertToDeposit(deposit: number, monthly: number): number {
  return deposit + monthly * 100;
}

function EditableField({
  label, value, onChange, type = "text", textarea = false, error,
}: {
  label: string; value?: string | number; onChange: (value: string) => void;
  type?: "text" | "number"; textarea?: boolean; error?: string;
}) {
  const hasError = Boolean(error);
  const baseInput = "w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-4 transition-colors";
  const inputCls = hasError
    ? `${baseInput} border-red-400 focus:border-red-500 focus:ring-red-100`
    : `${baseInput} border-slate-200 focus:border-blue-500 focus:ring-blue-100`;

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500 tracking-wide uppercase">
        {label}
        {hasError && <span className="ml-1 text-red-500 normal-case font-normal">— {error}</span>}
      </span>
      {textarea ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3}
          className={`${inputCls} resize-none`} />
      ) : (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
          className={inputCls} />
      )}
    </label>
  );
}

export function ParseResultView({ response, uploadSlot }: { response: ParseApiResponse; uploadSlot?: React.ReactNode }) {
  const { parseResult } = response;
  const { property, rightsRisk } = parseResult;

  // ── 등기부 보기/편집 상태 ──
  const [isEditing, setIsEditing] = useState(false);
  const [editableProperty, setEditableProperty] = useState<EditableProperty>({
    addressRaw:    property.addressRaw,
    roadAddress:   property.roadAddress,
    sido:          property.sido,
    sigungu:       property.sigungu,
    eupmyeondong:  property.eupmyeondong,
    buildingName:  property.buildingName,
    buildingDong:  property.buildingDong,
    unitNumber:    property.unitNumber,
    floor:         property.floor,
    exclusiveAreaM2: property.exclusiveAreaM2,
  });
  const [draftProperty, setDraftProperty] = useState<EditableProperty>(editableProperty);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});

  // ── 조회 파라미터 상태 ──
  const [buildingName, setBuildingName]     = useState(property.buildingName ?? "");
  const [exclusiveAreaM2, setExclusiveAreaM2] = useState(property.exclusiveAreaM2 ? String(property.exclusiveAreaM2) : "");
  const [targetFloor, setTargetFloor]       = useState(property.floor ? String(property.floor) : "");
  const [limit, setLimit]                   = useState("10");

  // ── 차감 항목 상태 ──
  const [hasTenant, setHasTenant]           = useState(false);
  const [tenantDeposit, setTenantDeposit]   = useState("");
  const [tenantMonthly, setTenantMonthly]   = useState("");

  // ── 조회 결과 상태 ──
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<LookupResult | null>(null);

  // 수정 적용 시 조회 파라미터 동기화
  useEffect(() => { if (editableProperty.buildingName)   setBuildingName(editableProperty.buildingName); },   [editableProperty.buildingName]);
  useEffect(() => { if (editableProperty.exclusiveAreaM2) setExclusiveAreaM2(String(editableProperty.exclusiveAreaM2)); }, [editableProperty.exclusiveAreaM2]);
  useEffect(() => { if (editableProperty.floor)          setTargetFloor(String(editableProperty.floor)); },   [editableProperty.floor]);

  // ── 계산값 ──
  const mortgageAmt = useMemo(
    () => (rightsRisk.mortgages ?? []).reduce((s, m) => s + (m.amount ?? 0), 0),
    [rightsRisk]
  );
  const depositAmt   = parseNumberInput(tenantDeposit);
  const monthlyAmt   = parseNumberInput(tenantMonthly);
  const totalDeposit = hasTenant ? convertToDeposit(depositAmt, monthlyAmt) : 0;
  const priorityAmt  = hasTenant ? calcPriorityRepayment(totalDeposit, editableProperty.sido) : 0;
  // 선순위 채권 합계 = 근저당 + 임차보증금
  const seniorDebtTotal = mortgageAmt + (hasTenant ? totalDeposit : 0);

  // ── 조회 실행 ──
  async function handleLookup() {
    if (!editableProperty.addressRaw) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/transactions/raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookupType: "jibun",
          addressQuery: editableProperty.addressRaw.trim(),
          buildingName: buildingName.trim() || undefined,
          exclusiveAreaM2: Number(exclusiveAreaM2) || undefined,
          targetFloor: Number(targetFloor) || undefined,
          limit: Number(limit) || 10,
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

  // ── 편집 모드 제어 ──
  function updateDraft<K extends keyof EditableProperty>(key: K, value: EditableProperty[K]) {
    const next = { ...draftProperty, [key]: value };
    setDraftProperty(next);
    if (key === "exclusiveAreaM2" || key === "floor") setDraftErrors(validateDraft(next));
  }
  function startEdit()  { setDraftProperty(editableProperty); setDraftErrors({}); setIsEditing(true); }
  function cancelEdit() { setDraftProperty(editableProperty); setDraftErrors({}); setIsEditing(false); }
  function applyEdit() {
    const errors = validateDraft(draftProperty);
    if (Object.keys(errors).length > 0) { setDraftErrors(errors); return; }
    setEditableProperty(draftProperty);
    setDraftErrors({});
    setIsEditing(false);
  }

  return (
    <div className="space-y-4 print:block">

      {/* ── 인쇄 전용 면책 문구 ── */}
      <div className="hidden print:block mb-4 rounded border border-slate-300 bg-slate-50 px-4 py-2 text-xs text-slate-500 text-center">
        본 평가는 참고용이며 법적 효력이 없습니다. 담보 목적으로 사용 불가 · 출력일 {new Date().toLocaleDateString("ko-KR")}
      </div>

      {/* ── 상단: 업로드 슬롯 + 통합 카드 ── */}
      <div className="space-y-4 print:block">
        {uploadSlot}

        {/* ═══ 등기부 판독 결과 + 조회 조건 통합 카드 ═══ */}
        <section className="print-shell rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

          {/* 카드 헤더 */}
          <div className="no-print flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="h-5 w-0.5 rounded-full bg-blue-500" />
              <div>
                <p className="text-[10px] font-bold tracking-widest text-blue-500 uppercase leading-none">Registry Extraction</p>
                <h2 className="mt-1 text-base font-bold text-slate-900 leading-none">등기부 판독 결과</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button type="button" onClick={cancelEdit}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    취소
                  </button>
                  <button type="button" onClick={applyEdit}
                    className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
                    적용
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => window.print()}
                    className="no-print rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    인쇄 / PDF 저장
                  </button>
                  <button
                    type="button"
                    onClick={startEdit}
                    title="PDF에서 잘못 인식된 주소·면적·층수 등을 직접 수정합니다. 원본 파일은 변경되지 않습니다."
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                    추출값 수정 ✎
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 물건 정보 */}
          <div className="p-6">
            {isEditing ? (
              /* ── 편집 모드: 그리드 입력폼 ── */
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <EditableField label="지번주소" value={draftProperty.addressRaw} textarea
                    onChange={(v) => updateDraft("addressRaw", v)} />
                </div>
                <div className="sm:col-span-2">
                  <EditableField label="도로명주소 (보조)" value={draftProperty.roadAddress}
                    onChange={(v) => updateDraft("roadAddress", v)} />
                </div>
                <EditableField label="시도"   value={draftProperty.sido}          onChange={(v) => updateDraft("sido", v)} />
                <EditableField label="시군구" value={draftProperty.sigungu}       onChange={(v) => updateDraft("sigungu", v)} />
                <EditableField label="읍면동" value={draftProperty.eupmyeondong}  onChange={(v) => updateDraft("eupmyeondong", v)} />
                <EditableField label="건물명" value={draftProperty.buildingName}  onChange={(v) => updateDraft("buildingName", v)} />
                <EditableField label="동"     value={draftProperty.buildingDong}  onChange={(v) => updateDraft("buildingDong", v)} />
                <EditableField label="호수"   value={draftProperty.unitNumber}    onChange={(v) => updateDraft("unitNumber", v)} />
                <EditableField label="층수 *" type="number" value={draftProperty.floor}
                  onChange={(v) => updateDraft("floor", normalizeNumberInput(v))} error={draftErrors.floor} />
                <EditableField label="전유면적 ㎡ *" type="number" value={draftProperty.exclusiveAreaM2}
                  onChange={(v) => updateDraft("exclusiveAreaM2", normalizeNumberInput(v))} error={draftErrors.exclusiveAreaM2} />
                <div className="sm:col-span-2">
                  <p className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs leading-5 text-blue-700">
                    수정값은 원본 PDF를 변경하지 않으며, 실거래 조회 및 보고서 산출에만 반영됩니다.
                  </p>
                </div>
              </div>
            ) : (
              /* ── 보기 모드: 물건정보 + 선순위근저당 ── */
              <div className="space-y-4">
                {/* 주소 */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">지번주소</p>
                  <p className="text-sm font-semibold text-slate-800 leading-snug">
                    {editableProperty.addressRaw || <span className="text-slate-300">—</span>}
                  </p>
                </div>
                {/* 3열 컴팩트 그리드 */}
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4">
                  {([
                    ["건물명",   editableProperty.buildingName],
                    ["동",       editableProperty.buildingDong],
                    ["호수",     editableProperty.unitNumber],
                    ["층수",     editableProperty.floor],
                    ["전유면적", formatAreaWithPyeong(editableProperty.exclusiveAreaM2)],
                    ["시도",     editableProperty.sido],
                    ["시군구",   editableProperty.sigungu],
                    ["읍면동",   editableProperty.eupmyeondong],
                  ] as [string, string | number | undefined][]).map(([label, value]) => (
                    <div key={label} className="border-b border-slate-50 py-2">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-slate-800 leading-snug truncate">
                        {value !== undefined && value !== "" && value !== null
                          ? String(value)
                          : <span className="text-slate-300">—</span>}
                      </dd>
                    </div>
                  ))}
                </dl>

                {/* 선순위 근저당 — 구분선 아래 컴팩트 */}
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">
                    선순위 근저당
                    <span className="ml-1 font-normal normal-case text-amber-500">· PDF 자동</span>
                  </p>
                  {rightsRisk.mortgages && rightsRisk.mortgages.length > 0 ? (
                    <div className="space-y-2">
                      {rightsRisk.mortgages.map((m) => (
                        <div key={m.rank} className="flex items-center gap-1.5 text-xs">
                          <span className="shrink-0 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-black text-white leading-none">
                            {m.rank}순위
                          </span>
                          <span className="flex-1 truncate text-slate-600 font-medium">{m.creditor}</span>
                          <span className="shrink-0 font-bold text-red-600 whitespace-nowrap">{formatKoreanPrice(m.amount)}</span>
                        </div>
                      ))}
                      {rightsRisk.mortgages.length > 1 && (
                        <div className="flex justify-between border-t border-slate-100 pt-1.5 text-xs">
                          <span className="font-bold text-slate-600">합계</span>
                          <span className="font-black text-red-700">{formatKoreanPrice(mortgageAmt)}</span>
                        </div>
                      )}
                      <p className="text-[10px] text-amber-600">⚠ 말소·해지 여부 원문 확인 필요</p>
                    </div>
                  ) : rightsRisk.mortgageSummaryChecked ? (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-2 text-xs text-emerald-700">
                      <span>✓</span>
                      <span>기록사항 없음</span>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-xs text-amber-700">
                      ⚠ 자동추출 실패 — 원문 확인
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 임차보증금 + 조회 버튼 (구분선 아래) ── */}
          <div className="no-print border-t border-slate-100 px-6 py-4 space-y-3">

            {/* 임차보증금 토글 + 입력 */}
            <div className="space-y-2">
              <div
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  hasTenant ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"
                }`}
                onClick={() => setHasTenant((v) => !v)}
              >
                <span>임차보증금 있음 (전세·월세)</span>
                <input
                  type="checkbox"
                  checked={hasTenant}
                  onChange={() => setHasTenant((v) => !v)}
                  className="h-4 w-4 accent-blue-600"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {hasTenant && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">보증금 (원)</span>
                    <input
                      value={tenantDeposit}
                      onChange={(e) => setTenantDeposit(fmtInput(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">월세 (원)</span>
                    <input
                      value={tenantMonthly}
                      onChange={(e) => setTenantMonthly(fmtInput(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none"
                    />
                  </label>
                  {totalDeposit > 0 && (
                    <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-0.5">
                      <p className="text-xs text-slate-500">
                        환산 보증금: <span className="font-bold text-slate-700">{formatKoreanPrice(totalDeposit)}</span>
                      </p>
                      <p className="text-xs text-slate-500">
                        최우선변제금:{" "}
                        {priorityAmt > 0 ? (
                          <span className="font-bold text-slate-700">{formatKoreanPrice(priorityAmt)}</span>
                        ) : (
                          <span className="font-semibold text-red-500">적용 불가</span>
                        )}
                        <span className="ml-1 text-slate-400">
                          ({editableProperty.sido?.includes("서울") ? "서울" : editableProperty.sido?.includes("경기") || editableProperty.sido?.includes("인천") ? "수도권" : "기타"} 기준)
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 조회 버튼 */}
            <button
              type="button"
              onClick={handleLookup}
              disabled={loading || !editableProperty.addressRaw}
              className="w-full rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "조회 중…" : result ? "재조회" : "조회 시작"}
            </button>

            {!editableProperty.addressRaw && (
              <p className="text-xs text-amber-600 text-center">
                PDF에서 주소를 추출하지 못했습니다. 등기부 원문을 확인하세요.
              </p>
            )}
          </div>

        </section>
      </div>{/* end 상단 */}

      {/* ── 하단: 실거래 원천 조회 결과 (전체 너비) ── */}
      <div className="print-shell rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="no-print flex items-center justify-between gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50/40">
          <p className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase">실거래 원천 조회 결과</p>
          {result && <p className="text-xs text-slate-400 truncate">{result.note}</p>}
        </div>
        <div className="p-6">
          {!loading && !error && !result ? (
            /* 조회 전 플레이스홀더 */
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm text-slate-400">
              <svg className="h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <p>조회 조건을 확인하고 <strong className="text-blue-600">조회 시작</strong>을 누르세요.</p>
            </div>
          ) : (
            <RawTransactionLookup
              limit={limit}
              loading={loading}
              error={error}
              result={result}
              hasTenant={hasTenant}
              totalDeposit={totalDeposit}
              mortgageAmt={mortgageAmt}
              seniorDebtTotal={seniorDebtTotal}
            />
          )}
        </div>
      </div>

    </div>
  );
}
