import { NextRequest, NextResponse } from "next/server";

import { estimateApartmentValue } from "../../../src/backend/valuation/estimateApartmentValue";

function parseOptionalNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await estimateApartmentValue({
      addressRaw: typeof body.addressRaw === "string" ? body.addressRaw : undefined,
      buildingName:
        typeof body.buildingName === "string" ? body.buildingName : undefined,
      exclusiveAreaM2: parseOptionalNumber(body.exclusiveAreaM2),
      floor: parseOptionalNumber(body.floor),
      tenantDepositAmount: parseOptionalNumber(body.tenantDepositAmount),
      tenantMonthlyRent: parseOptionalNumber(body.tenantMonthlyRent),
      rightsRisk: body.rightsRisk
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "valuation_failed"
      },
      {
        status: 500
      }
    );
  }
}
