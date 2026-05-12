import { NextRequest, NextResponse } from "next/server";

type Req = {
  roadAddress?: string;
};

/* ---------------------------
  VWorld 좌표
---------------------------- */
async function getCoord(address: string) {
  const key = process.env.VWORLD_API_KEY!;

  const url = new URL("https://api.vworld.kr/req/address");

  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getCoord");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("format", "json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  return res.json();
}

/* ---------------------------
  법정동 코드 추출 (핵심)
---------------------------- */
function extractLawdCd(vworld: any) {
  return (
    vworld?.response?.result?.structure?.admCode ||
    vworld?.response?.result?.admCode ||
    null
  );
}

/* ---------------------------
  실거래 API
---------------------------- */
async function fetchTrade(lawdCd: string, dealYmd: string) {
  const key = process.env.PUBLIC_DATA_API_KEY!;

  const url = new URL(
    "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
  );

  url.searchParams.set("serviceKey", decodeURIComponent(key));
  url.searchParams.set("LAWD_CD", lawdCd);
  url.searchParams.set("DEAL_YMD", dealYmd);

  const res = await fetch(url.toString());
  return res.text();
}

/* ---------------------------
  XML 파싱
---------------------------- */
function parse(xml: string) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

  return items.map((i) => {
    const b = i[1];

    return {
      dealAmount: Number(
        (b.match(/거래금액>(.*?)</)?.[1] || "0").replace(/,/g, "")
      ),
      floor: Number(b.match(/층>(.*?)</)?.[1] || 0),
      area: Number(b.match(/전용면적>(.*?)</)?.[1] || 0),
      date:
        (b.match(/년>(.*?)</)?.[1] || "") +
        "-" +
        (b.match(/월>(.*?)</)?.[1] || "") +
        "-" +
        (b.match(/일>(.*?)</)?.[1] || ""),
    };
  });
}

/* ---------------------------
  평균 계산
---------------------------- */
function analyze(list: any[]) {
  if (!list.length) return null;

  const valid = list.filter((x) => x.dealAmount > 1000);

  const sorted = valid.sort((a, b) => a.dealAmount - b.dealAmount);

  const trimmed = sorted.slice(
    Math.floor(sorted.length * 0.1),
    Math.ceil(sorted.length * 0.9)
  );

  const avg =
    trimmed.reduce((s, v) => s + v.dealAmount, 0) / trimmed.length;

  return {
    avg,
    min: trimmed[0]?.dealAmount,
    max: trimmed[trimmed.length - 1]?.dealAmount,
    count: trimmed.length,
  };
}

/* ---------------------------
  MAIN API
---------------------------- */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Req;

    const address = body.roadAddress;

    if (!address) {
      return NextResponse.json({ error: "no address" }, { status: 400 });
    }

    /* 1. 좌표 */
    const vworld = await getCoord(address);

    /* 2. 법정동 */
    const lawdCd = extractLawdCd(vworld);

    if (!lawdCd) {
      return NextResponse.json({
        error: "lawdCd fail",
        debug: vworld,
      });
    }

    /* 3. 거래 */
    const ymd = new Date();
    const dealYmd =
      ymd.getFullYear() + String(ymd.getMonth() + 1).padStart(2, "0");

    const raw = await fetchTrade(lawdCd, dealYmd);

    const parsed = parse(raw);
    const analysis = analyze(parsed);

    return NextResponse.json({
      success: true,
      lawdCd,
      parsed,
      analysis,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
