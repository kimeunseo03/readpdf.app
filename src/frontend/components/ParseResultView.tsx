"use client";

import { useState } from "react";
import type { ParseApiResponse } from "@frontend/lib/api";
import { ValuationForm } from "./ValuationForm";

type EditableProperty = {
  addressRaw?: string;
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
  buildingName?: string;
  buildingDong?: string;
  unitNumber?: string;
  floor?: number;
  exclusiveAreaM2?: number;
  landRightRatio?: string;
};

function normalizeNumberInput(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function FieldRow({
  label,
  value
}: {
  label: string;
  value?: string | number | boolean | null;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 border-b border-slate-100 py-3 text-sm last:border-b-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="break-words font-medium text-slate-900">
        {value === undefined || value === null || value === ""
          ? "-"
          : String(value)}
      </dd>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
  textarea = false
}: {
  label: string;
  value?: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
      </span>

      {textarea ? (
        <textarea
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100"
        />
      )}
    </label>
  );
}

export function ParseResultView({ response }: { response: ParseApiResponse }) {
  const { parseResult } = response;
  const { property, rightsRisk, review } = parseResult;

  const [isEditing, setIsEditing] = useState(false);

  const [editableProperty, setEditableProperty] =
    useState<EditableProperty>({
      addressRaw: property.addressRaw,
      sido: property.sido,
      sigungu: property.sigungu,
      eupmyeondong: property.eupmyeondong,
      buildingName: property.buildingName,
      buildingDong: property.buildingDong,
      unitNumber: property.unitNumber,
      floor: property.floor,
      exclusiveAreaM2: property.exclusiveAreaM2,
      landRightRatio: property.landRightRatio
    });

  const [draftProperty, setDraftProperty] =
    useState<EditableProperty>(editableProperty);

  const reviewReasons = [...new Set(review.reasons)];
  const missingRequiredFields = [...new Set(review.missingRequiredFields)];

  function updateDraft<K extends keyof EditableProperty>(
    key: K,
    value: EditableProperty[K]
  ) {
    setDraftProperty((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  function startEdit() {
    setDraftProperty(editableProperty);
    setIsEditing(true);
  }

  function cancelEdit() {
    setDraftProperty(editableProperty);
    setIsEditing(false);
  }

  function applyEdit() {
    setEditableProperty(draftProperty);
    setIsEditing(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-600">
              REGISTRY EXTRACTION
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              등기부 판독 결과
            </h2>
          </div>

          <div className="no-print flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
                >
                  취소
                </button>

                <button
                  type="button"
                  onClick={applyEdit}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  적용
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startEdit}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
              >
                추출값 수정
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div className="mb-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500">
                PROPERTY INFO
              </p>

              <h3 className="mt-1 text-lg font-bold text-slate-900">
                물건 정보
              </h3>
            </div>

            {isEditing ? (
              <div className="grid gap-4">
                <EditableField
                  label="주소"
                  value={draftProperty.addressRaw}
                  textarea
                  onChange={(value) => updateDraft("addressRaw", value)}
                />

                <div className="grid grid-cols-3 gap-3">
                  <EditableField
                    label="시도"
                    value={draftProperty.sido}
                    onChange={(value) => updateDraft("sido", value)}
                  />

                  <EditableField
                    label="시군구"
                    value={draftProperty.sigungu}
                    onChange={(value) => updateDraft("sigungu", value)}
                  />

                  <EditableField
                    label="읍면동"
                    value={draftProperty.eupmyeondong}
                    onChange={(value) => updateDraft("eupmyeondong", value)}
                  />
                </div>

                <EditableField
                  label="건물명"
                  value={draftProperty.buildingName}
                  onChange={(value) => updateDraft("buildingName", value)}
                />

                <div className="grid grid-cols-3 gap-3">
                  <EditableField
                    label="동"
                    value={draftProperty.buildingDong}
                    onChange={(value) => updateDraft("buildingDong", value)}
                  />

                  <EditableField
                    label="호수"
                    value={draftProperty.unitNumber}
                    onChange={(value) => updateDraft("unitNumber", value)}
                  />

                  <EditableField
                    label="층수"
                    type="number"
                    value={draftProperty.floor}
                    onChange={(value) =>
                      updateDraft("floor", normalizeNumberInput(value))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <EditableField
                    label="전유면적㎡"
                    type="number"
                    value={draftProperty.exclusiveAreaM2}
                    onChange={(value) =>
                      updateDraft(
                        "exclusiveAreaM2",
                        normalizeNumberInput(value)
                      )
                    }
                  />

                  <EditableField
                    label="대지권"
                    value={draftProperty.landRightRatio}
                    onChange={(value) => updateDraft("landRightRatio", value)}
                  />
                </div>

                <p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                  수정값은 원본 PDF를 변경하지 않으며, 아래 가치평가 입력값과
                  보고서 산출에만 반영됩니다.
                </p>
              </div>
            ) : (
              <dl>
                <FieldRow label="주소" value={editableProperty.addressRaw} />
                <FieldRow label="시도" value={editableProperty.sido} />
                <FieldRow label="시군구" value={editableProperty.sigungu} />
                <FieldRow
                  label="읍면동"
                  value={editableProperty.eupmyeondong}
                />
                <FieldRow label="건물명" value={editableProperty.buildingName} />
                <FieldRow label="동" value={editableProperty.buildingDong} />
                <FieldRow label="호수" value={editableProperty.unitNumber} />
                <FieldRow label="층수" value={editableProperty.floor} />
                <FieldRow
                  label="전유면적"
                  value={
                    editableProperty.exclusiveAreaM2
                      ? `${editableProperty.exclusiveAreaM2}㎡`
                      : undefined
                  }
                />
                <FieldRow
                  label="대지권"
                  value={editableProperty.landRightRatio}
                />
              </dl>
            )}
          </div>

          <ValuationForm
            initialValue={{
              addressRaw: editableProperty.addressRaw,
              buildingName: editableProperty.buildingName,
              exclusiveAreaM2: editableProperty.exclusiveAreaM2,
              floor: editableProperty.floor,
              rightsRisk
            }}
          />
        </div>
      </section>

      {review.manualReviewRequired && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
          <p className="text-xs font-semibold tracking-wide text-amber-700">
            MANUAL REVIEW
          </p>

          <h3 className="mt-1 font-semibold text-amber-900">
            수동 검토 필요
          </h3>

          {reviewReasons.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900">
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
        </section>
      )}
    </div>
  );
}
