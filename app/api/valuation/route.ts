/**
 * POST /api/valuation
 * ─────────────────────────────────────────────────
 * 아파트 종합 감정 평가 엔드포인트
 *
 * 입력: addressRaw, buildingName, exclusiveAreaM2, floor,
 *       tenantDepositAmount, tenantMonthlyRent, rightsRisk
 * 출력: estimateApartmentValue() 결과 (시세 추정 + 담보여력)
 *
 * 에러: 500 반환 (detail 미포함 — 내부 스택 미노출)
 * ─────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from "next/server";
import { estimateApartmentValue } from "../../../src/backend/valuation/estimateApartmentValue";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await estimateApartmentValue({
      addressRaw: body.addressRaw,
      roadAddress: body.roadAddress,
      buildingName: body.buildingName,
      exclusiveAreaM2: body.exclusiveAreaM2,
      floor: body.floor,
      tenantDepositAmount: body.tenantDepositAmount,
      tenantMonthlyRent: body.tenantMonthlyRent,
      rightsRisk: body.rightsRisk
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "valuation_failed" },
      { status: 500 }
    );
  }
}
