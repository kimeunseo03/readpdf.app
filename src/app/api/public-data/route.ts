import { NextRequest, NextResponse } from "next/server";

type PublicDataRequest = {
  jibunAddress?: string;
  roadAddress?: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
};

async function getVWorldCoord(address: string, type: "road" | "parcel") {
  const key = process.env.VWORLD_API_KEY;

  if (!key) {
    throw new Error("VWORLD_API_KEY가 설정되지 않았습니다.");
  }

  const url = new URL("https://api.vworld.kr/req/address");
  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getCoord");
  url.searchParams.set("format", "json");
  url.searchParams.set("crs", "epsg:4326");
  url.searchParams.set("type", type);
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`VWorld API 호출 실패: ${res.status}`);
  }

  return res.json();
}

function extractVWorldPoint(data: any) {
  const point = data?.response?.result?.point;

  if (!point?.x || !point?.y) {
    return null;
  }

  return {
    longitude: Number(point.x),
    latitude: Number(point.y),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PublicDataRequest;

    const jibunAddress = body.jibunAddress?.trim() || "";
    const roadAddress = body.roadAddress?.trim() || "";
    const buildingName = body.buildingName?.trim() || "";
    const exclusiveAreaM2 =
      typeof body.exclusiveAreaM2 === "number" ? body.exclusiveAreaM2 : null;

    const primaryAddress = roadAddress || jibunAddress;

    if (!primaryAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "주소가 필요합니다.",
        },
        { status: 400 }
      );
    }

    let vworldRaw = null;
    let coordinates = null;
    let addressType: "road" | "parcel" = roadAddress ? "road" : "parcel";

    try {
      vworldRaw = await getVWorldCoord(primaryAddress, addressType);
      coordinates = extractVWorldPoint(vworldRaw);
    } catch {
      if (jibunAddress && roadAddress) {
        addressType = "parcel";
        vworldRaw = await getVWorldCoord(jibunAddress, "parcel");
        coordinates = extractVWorldPoint(vworldRaw);
      }
    }

    return NextResponse.json({
      success: true,
      input: {
        jibunAddress,
        roadAddress,
        buildingName,
        exclusiveAreaM2,
      },
      normalizedAddress: {
        primaryAddress,
        usedAddressType: addressType,
        jibunAddress,
        roadAddress,
      },
      coordinates,
      publicData: {
        vworld: {
          matched: Boolean(coordinates),
        },
      },
      nextRequiredData: [
        "kaptCode",
        "recentTransactionPrices",
        "officialPrice",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "공공 API 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
