import { NextRequest, NextResponse } from "next/server";

type PublicDataRequest = {
  jibunAddress?: string;
  roadAddress?: string;
  buildingName?: string;
  exclusiveAreaM2?: number;
};

type VWorldAddressType = "road" | "parcel";

/**
 * VWorld 좌표 조회
 */
async function getVWorldCoord(address: string, type: VWorldAddressType) {
  const key = process.env.VWORLD_API_KEY;

  if (!key) throw new Error("VWORLD_API_KEY missing");

  const url = new URL("https://api.vworld.kr/req/address");

  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getCoord");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("format", "json");
  url.searchParams.set("crs", "epsg:4326");
  url.searchParams.set("type", type);
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { cache: "no-store" });

  const json = await res.json();

  return json;
}

function extractCoord(data: any) {
  const point = data?.response?.result?.point;

  if (!point) return null;

  return {
    lat: Number(point.y),
    lng: Number(point.x),
  };
}

/**
 * 🔥 핵심: VWorld에서 법정동 코드 추출 (admcode 기반)
 * - API 응답 구조 다르면 fallback 필요
 */
function extractLawdCd(vworld: any): string | null {
  try {
    return (
      vworld?.response?.result?.structure?.admCode ||
      vworld?.response?.result?.admCode ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * 실거래 API
 */
async function getTransactions(lawdCd: string, dealYmd: string) {
  const key = process.env.PUBLIC_DATA_API_KEY;

  if (!key) throw new Error("PUBLIC_DATA_API_KEY missing");

  const url = new URL(
    "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
  );

  url.searchParams.set("serviceKey", decodeURIComponent(key));
  url.searchParams.set("LAWD_CD", lawdCd);
  url.searchParams.set("DEAL_YMD", dealYmd);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "50");

  const res = await fetch(url.toString(), { cache: "no-store" });
  const text = await res.text();

  return text;
}

/**
 * 🔥 실거래 파싱
 */
function parseTransactions(raw: string) {
  const items = [...raw.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  return items.map((item) => {
    const b = item[1];

    const dealAmount =
      b.match(/거래금액>(.*?)</)?.[1]?.replace(/,/g, "") || "0";
    const floor = b.match(/층>(.*?)</)?.[1] || "0";
    const area = b.match(/전용면적>(.*?)</)?.[1] || "0";

    const year = b.match(/년>(.*?)</)?.[1] || "";
    const month = b.match(/월>(.*?)</)?.[1] || "";
    const day = b.match(/일>(.*?)</)?.[1] || "";

    return {
      dealAmount: Number(dealAmount),
      floor: Number(floor),
      exclusiveAreaM2: Number(area),
      dealDate: `${year}-${month}-${day}`,
    };
  });
}

/**
 * 평균 + 이상치 제거
 */
function analyze(prices: any[]) {
  if (!prices.length) return null;

  const valid = prices.filter((p) => p.dealAmount > 1000);

  const sorted = valid.sort((a, b) => a.dealAmount - b.dealAmount);

  // 이상치 제거 (상/하 10%)
  const cut = Math.floor(sorted.length * 0.1);
  const trimmed = sorted.slice(cut, sorted.length - cut || undefined);

  const avg =
    trimmed.reduce((s, v) => s + v.dealAmount, 0) / trimmed.length;

  return {
    avg,
    min: trimmed[0]?.dealAmount,
    max: trimmed[trimmed.length - 1]?.dealAmount,
    count: trimmed.length,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PublicDataRequest;

    const address = body.roadAddress || body.jibunAddress;

    if (!address) {
      return NextResponse.json(
        { success: false, error: "주소 없음" },
        { status: 400 }
      );
    }

    /**
     * 1. VWorld 좌표
     */
    const vworld = await getVWorldCoord(address, "road");
    const coord = extractCoord(vworld);

    /**
     * 2. 법정동 코드 (핵심 수정)
     */
    const lawdCd = extractLawdCd(vworld);

    if (!lawdCd) {
      return NextResponse.json({
        success: false,
        error: "법정동 코드 추출 실패 (VWorld 구조 확인 필요)",
        debug: vworld,
      });
    }

    /**
     * 3. 실거래 조회 (최근 1개월)
     */
    const now = new Date();
    const dealYmd = `${now.getFullYear()}${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    const raw = await getTransactions(lawdCd, dealYmd);

    const parsed = parseTransactions(raw);
    const analysis = analyze(parsed);

    return NextResponse.json({
      success: true,

      coordinates: coord,

      publicData: {
        lawdCd,
        dealYmd,

        transactions: {
          raw,
          parsed,
          analysis,
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
