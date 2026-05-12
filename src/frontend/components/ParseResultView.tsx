"use client";

import { useMemo, useState } from "react";
import type { ParseApiResponse } from "@frontend/lib/api";
import { ValuationForm } from "./ValuationForm";

type EditableProperty = {
  addressRaw: string;
  sido: string;
  sigungu: string;
  eupmyeondong: string;
  buildingName: string;
  buildingDong: string;
  unitNumber: string;
  exclusiveAreaM2: string;
  floor: string;
  landRightRatio: string;
};

function ConfidenceBadge({ value }: { value: number }) {
  const label = value >= 0.9 ? "높음" : value >= 0.75 ? "보통" : "검토 필요";

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {label} · {(value * 100).toFixed(0)}%
    </span>
  );
}

function toEditableProperty(response: ParseApiResponse): EditableProperty {
  const property = response.parseResult.property;

  return {
    addressRaw: property.addressRaw ?? "",
    sido: property.sido ?? "",
    sigungu: property.sigungu ?? "",
    eupmyeondong: property.eupmyeondong ?? "",
    buildingName: property.buildingName ?? "",
    buildingDong: property.buildingDong ?? "",
    unitNumber: property.unitNumber ?? "",
    exclusiveAreaM2: property.exclusiveAreaM2?.toString() ?? "",
    floor: property.floor?.toString() ?? "",
    landRightRatio: property.landRightRatio ?? ""
  };
}

function DisplayRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 border-b border-slate-100 py-3 text-sm last:border-b-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="break-words font-semibold text-slate-900">
        {value && value.trim() ? value : "-"}
      </dd>
    </div>
  );
}

function EditInput({
  label,
  value,
  onChange,
  multiline = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className={multiline ? "block md:col-span-2" : "block"}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label}
      </span>

      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
        />
      )}
    </label>
  );
}

export function ParseResultView({ response }: { response: ParseApiResponse }) {
  const { parseResult } = response;
  const { rightsRisk, confidence, review, meta } = parseResult;
  const [isEditing, setIsEditing] = useState(false);
  const [showReviewDetail, setShowReviewDetail] = useState(false);
  const [editableProperty, setEditableProperty] = useState<EditableProperty>(() =>
    toEditableProperty(response)
  );

  const reviewReasons = [...new Set(review.reasons)];
  const missingRequiredFields = [...new Set(review.missingRequiredFields)];

  const valuationInitialValue = useMemo(
    () => ({
      addressRaw: editableProperty.addressRaw,
      buildingName: editableProperty.buildingName,
      exclusiveAreaM2: editableProperty.exclusiveAreaM2
        ? Number(editableProperty.exclusiveAreaM2)
        : undefined,
      floor: editableProperty.floor ? Number(editableProperty.floor) : undefined,
      rightsRisk
    }),
    [editableProperty, rightsRisk]
  );

  function updateField<K extends keyof EditableProperty>(
    key: K,
    value: EditableProperty[K]
  ) {
    setEditableProperty((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-2 xl:px-0">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">판독 요약</h2>
            <p className="mt-1 text-sm text-slate-500">
              {parseResult.document.originalFileName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ConfidenceBadge value={confidence.overall} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              OCR {meta.ocrRequired ? "필요" : "불필요"}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-600">
              REGISTRY EXTRACTION
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              등기부 판독 결과 · 수정 가능
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="no-print rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
          >
            {isEditing ? "수정 완료" : "추출값 수정"}
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(360px,520px)_minmax(640px,1fr)] xl:items-start">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500">
                  PROPERTY INFO
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  물건 정보
                </h3>
              </div>

              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
                PDF 추출값
              </span>
            </div>

            {isEditing ? (
              <div className="grid gap-3 md:grid-cols-2">
                <EditInput
                  label="주소"
                  value={editableProperty.addressRaw}
                  multiline
                  onChange={(value) => updateField("addressRaw", value)}
                />
                <EditInput label="시도" value={editableProperty.sido} onChange={(value) => updateField("sido", value)} />
                <EditInput label="시군구" value={editableProperty.sigungu} onChange={(value) => updateField("sigungu", value)} />
                <EditInput label="읍면동" value={editableProperty.eupmyeondong} onChange={(value) => updateField("eupmyeondong", value)} />
                <EditInput label="건물명" value={editableProperty.buildingName} onChange={(value) => updateField("buildingName", value)} />
                <EditInput label="동" value={editableProperty.buildingDong} onChange={(value) => updateField("buildingDong", value)} />
                <EditInput label="호수" value={editableProperty.unitNumber} onChange={(value) => updateField("unitNumber", value)} />
                <EditInput label="층" value={editableProperty.floor} onChange={(value) => updateField("floor", value)} />
                <EditInput label="전유면적㎡" value={editableProperty.exclusiveAreaM2} onChange={(value) => updateField("exclusiveAreaM2", value)} />
                <EditInput label="대지권" value={editableProperty.landRightRatio} onChange={(value) => updateField("landRightRatio", value)} />
              </div>
            ) : (
              <dl>
                <DisplayRow label="주소" value={editableProperty.addressRaw} />
                <DisplayRow label="시도" value={editableProperty.sido} />
                <DisplayRow label="시군구" value={editableProperty.sigungu} />
                <DisplayRow label="읍면동" value={editableProperty.eupmyeondong} />
                <DisplayRow label="건물명" value={editableProperty.buildingName} />
                <DisplayRow label="동" value={editableProperty.buildingDong} />
                <DisplayRow label="호수" value={editableProperty.unitNumber} />
                <DisplayRow label="층" value={editableProperty.floor ? `${editableProperty.floor}층` : ""} />
                <DisplayRow label="전유면적" value={editableProperty.exclusiveAreaM2 ? `${editableProperty.exclusiveAreaM2}㎡` : ""} />
                <DisplayRow label="대지권" value={editableProperty.landRightRatio} />
              </dl>
            )}
          </div>

          <div className="min-w-0">
            <ValuationForm initialValue={valuationInitialValue} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">권리관계 리스크 플래그</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {rightsRisk.riskFlags.length ? (
            rightsRisk.riskFlags.map((flag) => (
              <span key={flag} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {flag}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">탐지된 리스크 키워드 없음</span>
          )}
        </div>
      </section>

      {review.manualReviewRequired && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-amber-700">
                MANUAL REVIEW
              </p>
              <h3 className="mt-1 font-semibold text-amber-900">
                수동 검토 필요
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setShowReviewDetail((prev) => !prev)}
              className="no-print rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-200"
            >
              {showReviewDetail ? "상세 숨기기" : "상세 보기"}
            </button>
          </div>

          {showReviewDetail && (
            <div className="mt-4 rounded-2xl bg-white/60 p-4">
              {reviewReasons.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {reviewReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}

              {missingRequiredFields.length > 0 && (
                <p className="mt-3 text-sm font-medium text-amber-900">
                  누락 필드: {missingRequiredFields.join(", ")}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
