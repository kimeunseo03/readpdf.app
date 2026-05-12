import { NextRequest, NextResponse } from "next/server";

import { estimateApartmentValue } from "../../../src/backend/valuation/estimateApartmentValue";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await estimateApartmentValue({
      addressRaw: body.addressRaw,
      buildingName: body.buildingName,
      exclusiveAreaM2: body.exclusiveAreaM2
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
