import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      jibunAddress,
      roadAddress,
      buildingName,
      exclusiveAreaM2,
    } = body;

    return NextResponse.json({
      success: true,
      input: {
        jibunAddress,
        roadAddress,
        buildingName,
        exclusiveAreaM2,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "API 처리 실패",
      },
      { status: 500 }
    );
  }
}