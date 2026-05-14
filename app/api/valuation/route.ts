import { NextRequest, NextResponse } from "next/server";
import { estimateApartmentValue } from "../../../src/backend/valuation/estimateApartmentValue";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await estimateApartmentValue({
      addressRaw: body.addressRaw,
      // ✅ 1번: 도로명 주소 추가 전달 (parseRegistryPdf에서 추출한 roadAddress)
      roadAddress: body.roadAddress,
      buildingName: body.buildingName,
      exclusiveAreaM2: body.exclusiveAreaM2,
      floor: body.floor,
      tenantDepositAmount: body.tenantDepositAmount,
      tenantMonthlyRent: body.tenantMonthlyRent,
      rightsRisk: body.rightsRisk,
    } as any);

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "valuation_failed" },
      { status: 500 }
    );
  }
}
