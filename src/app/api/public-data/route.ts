import { NextRequest, NextResponse } from "next/server";

type PublicDataRequest = {
  jibunAddress?: string;
  roadAddress?: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
};

type VWorldAddressType = "road" | "parcel";

async function getVWorldCoord(address: string, type: VWorldAddressType) {
  const key = process.env.VWORLD_API_KEY;

  if (!key) {
    throw new Error("VWORLD_API_KEY가 설정되지 않았습니다.");
  }

  const url = new URL("https://api.vworld.kr/req/address");

  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getCoord");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("format", "json");
  url.searchParams.set("crs", "epsg:4326");
  url.searchParams.set("refine", "true");
  url.searchParams.set("simple", "false");
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
  const status = data?.response?.status;
  const point = data?.response?.result?.point;

  if (status !== "OK" || !point?.x || !point?.y) {
    return null;
  }

  return {
    longitude: Number(point.x),
    latitude: Number(point.y),
    crs: "EPSG:4326",
  };
}

async function getKaptCode(params: {
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
}) {
  const serviceKey = process.env.PUBLIC_DATA_API_KEY;

  if (!serviceKey) {
    throw new Error("PUBLIC_DATA_API_KEY가 설정되지 않았습니다.");
  }

  const url = new URL(
    "https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusBassInfo"
  );

  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("kaptCode", "A13822003");
  url.searchParams.set("_type", "json");

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`KAPT API 호출 실패: ${res.status}`);
  }

  const data = await res.json();

  console.log("KAPT BASIS RAW:", JSON.stringify(data, null, 2));

  return {
    matched: true,
    kaptCode: "A13822003",
  };
}

  return {
    matched: Boolean(matched),
    kaptCode: matched?.kaptCode ?? null,
  };
}

async function getRecentTransactionPrices(params: {
  lawdCd: string;
  dealYmd: string;
}) {
  const serviceKey = process.env.PUBLIC_DATA_API_KEY;

  if (!serviceKey) {
    throw new Error("PUBLIC_DATA_API_KEY가 설정되지 않았습니다.");
  }

  const url = new URL(
    "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
  );

  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("LAWD_CD", params.lawdCd);
  url.searchParams.set("DEAL_YMD", params.dealYmd);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "30");

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`실거래 API 호출 실패: ${res.status}`);
  }

  const text = await res.text();

  console.log("TRANSACTION RAW:", text);

  return {
    raw: text.slice(0, 2000),
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

    let vworldRaw: any = null;
    let coordinates = null;
    let kaptData: any = null;
    let transactionData: any = null;

    let addressType: VWorldAddressType = roadAddress ? "road" : "parcel";

    try {
      vworldRaw = await getVWorldCoord(primaryAddress, addressType);
      coordinates = extractVWorldPoint(vworldRaw);

      if (!coordinates && jibunAddress && roadAddress) {
        addressType = "parcel";
        vworldRaw = await getVWorldCoord(jibunAddress, "parcel");
        coordinates = extractVWorldPoint(vworldRaw);
      }
    } catch (error) {
      console.error("VWORLD ERROR:", error);

      if (jibunAddress && roadAddress) {
        addressType = "parcel";
        vworldRaw = await getVWorldCoord(jibunAddress, "parcel");
        coordinates = extractVWorldPoint(vworldRaw);
      }
    }

    kaptData = await getKaptCode({
      roadAddress,
      jibunAddress,
      buildingName,
    });

    transactionData = await getRecentTransactionPrices({
      lawdCd: "11710",
      dealYmd: "202605",
    });

    return NextResponse.json({
      success: true,

      coordinates,

      publicData: {
        vworld: {
          matched: Boolean(coordinates),
          status: vworldRaw?.response?.status ?? null,
        },

        kapt: {
          matched: kaptData?.matched ?? false,
          kaptCode: kaptData?.kaptCode ?? null,
        },

        transactions: transactionData,
      },
    });
  } catch (error) {
    console.error("ROUTE ERROR:", error);

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
