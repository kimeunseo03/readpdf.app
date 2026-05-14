"use client";
import { useState } from "react";
import type { ParseApiResponse } from "@frontend/lib/api";
import { ValuationForm } from "./ValuationForm";
import { RawTransactionLookup } from "./RawTransactionLookup";

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

function normalizeNumberInput(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatAreaWithPyeong(area?: number) {
  if (!area) return undefined;
  return `${area}㎡ (${(area / 3.3058).toFixed(2)}평)`;
}

function FieldRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 border-b border-slate-100 py-2.5 text-sm last:border-b-0">
      <dt className="font-medium text-slate-400 text-xs pt-0.5">{label}</dt>
      <dd className="break-words font-semibold text-slate-800 text-sm leading-snug">
        {value === undefined || value === null || value === "" ? <span className="text-slate-300">-</span> : String(value)}
      </dd>
    </div>
  );
}

function EditableField({ label, value, onChange, type = "text", textarea = false }: { label: string; value?: string | number; onChange: (value: string) => void; type?: "text" | "number"; textarea?: boolean; }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500 tracking-wide uppercase">{label}</span>
      {textarea ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 resize-none" />
      ) : (
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100" />
      )}
    </label>
  );
}

export function ParseResultView({ response }: { response: ParseApiResponse }) {
  const { parseResult } = response;
  const { property, rightsRisk, review } = parseResult;

  const [isEditing, setIsEditing] = useState(false);
  const [editableProperty, setEditableProperty] = useState<EditableProperty>({
    addressRaw: property.addressRaw,
    roadAddress: property.roadAddress,
    sido: property.sido,
    sigungu: property.sigungu,
    eupmyeondong: property.eupmyeondong,
    buildingName: property.buildingName,
    buildingDong: property.buildingDong,
    unitNumber: property.unitNumber,
    floor: property.floor,
    exclusiveAreaM2: property.exclusiveAreaM2,
  });
  const [draftProperty, setDraftProperty] = useState<EditableProperty>(editableProperty);

  const reviewReasons = [...new Set(review.reasons)];
  const missingRequiredFields = [...new Set(review.missingRequiredFields)];

  function updateDraft<K extends keyof EditableProperty>(key: K, value: EditableProperty[K]) {
    setDraftProperty((prev) => ({ ...prev, [key]: value }));
  }
  function startEdit() { setDraftProperty(editableProperty); setIsEditing(true); }
  function cancelEdit() { setDraftProperty(editableProperty); setIsEditing(false); }
  function applyEdit() { setEditableProperty(draftProperty); setIsEditing(false); }

  return (
    <div className="space-y-5">
      <section className="print-shell rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="no-print flex items-center justify-between gap-4 px-7 py-5 border-b border-slate-100 bg-slate-50/60">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-blue-500 uppercase">Registry Extraction</p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">등기부 판독 결과</h2>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button type="button" onClick={cancelEdit} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors">취소</button>
                <button type="button" onClick={applyEdit} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">적용</button>
              </>
            ) : (
              <button type="button" onClick={startEdit} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100 transition-colors">추출값 수정</button>
            )}
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="no-print border-b xl:border-b-0 xl:border-r border-slate-100 bg-slate-50/40 p-6 xl:sticky xl:top-6 xl:self-start">
            <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-4">Property Info</p>
            {isEditing ? (
              <div className="grid gap-3.5">
                <EditableField label="지번주소" value={draftProperty.addressRaw} textarea onChange={(v) => updateDraft("addressRaw", v)} />
                <EditableField label="도로명주소" value={draftProperty.roadAddress} textarea onChange={(v) => updateDraft("roadAddress", v)} />
                <div className="grid grid-cols-3 gap-2">
                  <EditableField label="시도" value={draftProperty.sido} onChange={(v) => updateDraft("sido", v)} />
                  <EditableField label="시군구" value={draftProperty.sigungu} onChange={(v) => updateDraft("sigungu", v)} />
                  <EditableField label="읍면동" value={draftProperty.eupmyeondong} onChange={(v) => updateDraft("eupmyeondong", v)} />
                </div>
                <EditableField label="건물명" value={draftProperty.buildingName} onChange={(v) => updateDraft("buildingName", v)} />
                <div className="grid grid-cols-3 gap-2">
                  <EditableField label="동" value={draftProperty.buildingDong} onChange={(v) => updateDraft("buildingDong", v)} />
                  <EditableField label="호수" value={draftProperty.unitNumber} onChange={(v) => updateDraft("unitNumber", v)} />
                  <EditableField label="층수" type="number" value={draftProperty.floor} onChange={(v) => updateDraft("floor", normalizeNumberInput(v))} />
                </div>
                <EditableField label="전유면적㎡" type="number" value={draftProperty.exclusiveAreaM2} onChange={(v) => updateDraft("exclusiveAreaM2", normalizeNumberInput(v))} />
                <p className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs leading-5 text-blue-700">수정값은 원본 PDF를 변경하지 않으며, 가치평가 실행과 보고서 산출에만 반영됩니다.</p>
              </div>
            ) : (
              <dl className="divide-y divide-slate-100">
                <FieldRow label="지번주소" value={editableProperty.addressRaw} />
                <FieldRow label="도로명" value={editableProperty.roadAddress} />
                <FieldRow label="시도" value={editableProperty.sido} />
                <FieldRow label="시군구" value={editableProperty.sigungu} />
                <FieldRow label="읍면동" value={editableProperty.eupmyeondong} />
                <FieldRow label="건물명" value={editableProperty.buildingName} />
                <FieldRow label="동" value={editableProperty.buildingDong} />
                <FieldRow label="호수" value={editableProperty.unitNumber} />
                <FieldRow label="층수" value={editableProperty.floor} />
                <FieldRow label="전유면적" value={formatAreaWithPyeong(editableProperty.exclusiveAreaM2)} />
              </dl>
            )}
          </div>

          <div className="print-content p-6">
            <ValuationForm initialValue={{ addressRaw: editableProperty.addressRaw, roadAddress: editableProperty.roadAddress, buildingName: editableProperty.buildingName, exclusiveAreaM2: editableProperty.exclusiveAreaM2, floor: editableProperty.floor, rightsRisk }} />
          </div>
        </div>
      </section>

      <RawTransactionLookup defaultBuildingName={editableProperty.buildingName} defaultArea={editableProperty.exclusiveAreaM2} defaultFloor={editableProperty.floor} />

      {review.manualReviewRequired && (
        <section className="no-print rounded-2xl border border-amber-200 bg-amber-50/70 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-amber-500 text-lg">⚠</span>
            <div>
              <p className="text-xs font-bold tracking-widest text-amber-600 uppercase">Manual Review</p>
              <h3 className="mt-0.5 font-bold text-amber-900">수동 검토 필요</h3>
              {reviewReasons.length > 0 && <ul className="mt-3 space-y-1 text-sm text-amber-800">{reviewReasons.map((r) => <li key={r} className="flex items-start gap-2"><span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400 shrink-0" />{r}</li>)}</ul>}
              {missingRequiredFields.length > 0 && <p className="mt-2 text-sm font-semibold text-amber-900">누락 필드: <span className="font-normal">{missingRequiredFields.join(", ")}</span></p>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
