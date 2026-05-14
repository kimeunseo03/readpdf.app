import { NextRequest, NextResponse } from "next/server";
import { searchAddressByKakao } from "../../../../src/backend/valuation/addressSearchApi";

function getRecentDealYearMonths(monthCount = 3): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < monthCount; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function pickTag(source: string, tag: string) {
  return source.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1]?.trim() ?? "";
}

function normalizeApartmentName(value?: string) {
  return value
    ?.replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .replace(/에스-?클래스/g, "s클래스")
    .replace(/S-?클래스/gi, "s클래스")
    .replace(/이편한세상/g, "e편한세상")
    .replace(/[0-9]+단지/g, "")
    .replace(/[가-힣]?동$/g, "")
    .trim() ?? "";
}

function parseDealDateKey(value: { dealYear: number; dealMonth: number; dealDay: number }) {
  return value.dealYear * 10000 + value.dealMonth * 100 + value.dealDay;
}

function getDaysAgo(dealYear: number, dealMonth: number, dealDay: number) {
  const now = new Date();
  const dealDate = new Date(dealYear, dealMonth - 1, dealDay || 1);
  const diff = now.getTime() - dealDate.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function isApartmentNameMatch(apiName: string, targetName: string) {
  const normalizedApiName = normalizeApartmentName(apiName);
  const normalizedTargetName = normalizeApartmentName(targetName);
  return Boolean(
    normalizedTargetName &&
    (normalizedApiName.includes(normalizedTargetName) || normalizedTargetName.includes(normalizedApiName))
  );
}

function getMatchTier(params: {
  isSameDong: boolean;
  isSameApartment: boolean;
  daysAgo: number;
  areaDifferenceM2?: number;
  floorDifference?: number;
}) {
  const { isSameDong, isSameApartment, daysAgo, areaDifferenceM2, floorDifference } = params;
  if (!isSameDong || !isSameApartment || daysAgo > 93) return 999;

  const sameArea = areaDifferenceM2 !== undefined && areaDifferenceM2 <= 0.01;
  const sameFloor = floorDifference !== undefined && floorDifference === 0;
  const floorWithin3 = floorDifference !== undefined && floorDifference <= 3;
  const areaWithin3 = areaDifferenceM2 !== undefined && areaDifferenceM2 <= 3;

  if (sameArea && sameFloor) return 1;
  if (sameArea && floorWithin3) return 2;
  if (sameArea) return 3;
  if (areaWithin3) return 4;
  return 999;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lookupType = String(body.lookupType ?? "legalDongCode");
    const addressQuery = String(body.addressQuery ?? "").trim();
    let legalDongCode = String(body.legalDongCode ?? "").replace(/[^0-9]/g, "");
    let resolvedAddress: Awaited<ReturnType<typeof searchAddressByKakao>> | undefined;

    if (lookupType === "jibun" || lookupType === "road") {
      resolvedAddress = await searchAddressByKakao(addressQuery);
      legalDongCode = resolvedAddress?.legalDongCode?.replace(/[^0-9]/g, "") ?? "";
    }

    const buildingName = String(body.buildingName ?? "").trim();
    const exclusiveAreaM2 = body.exclusiveAreaM2 ? Number(body.exclusiveAreaM2) : undefined;
    const targetFloor = body.targetFloor ? Number(body.targetFloor) : undefined;
    const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 30);

    if (![5, 10].includes(legalDongCode.length)) {
      return NextResponse.json({ success: false, message: "법정동코드를 확인하지 못했습니다. 주소를 더 구체적으로 입력하거나 5자리/10자리 법정동코드로 조회하세요." }, { status: 400 });
    }

    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "PUBLIC_DATA_API_KEY가 없습니다." }, { status: 500 });
    }

    const lawdCd = legalDongCode.slice(0, 5);
    const targetDong = resolvedAddress?.eupmyeondong;
    const rows: any[] = [];
    const seen = new Set<string>();

    for (const dealYearMonth of getRecentDealYearMonths(3)) {
      const url = new URL("https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade");
      url.searchParams.set("serviceKey", apiKey);
      url.searchParams.set("LAWD_CD", lawdCd);
      url.searchParams.set("DEAL_YMD", dealYearMonth);
      url.searchParams.set("pageNo", "1");
      url.searchParams.set("numOfRows", "200");

      const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
      if (!res.ok) continue;

      const xml = await res.text();
      const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

      for (const match of itemMatches) {
        const x = match[1];
        const aptNm = pickTag(x, "aptNm");
        const area = Number(pickTag(x, "excluUseAr"));
        const dealAmount = Number(pickTag(x, "dealAmount").replace(/,/g, ""));
        const dealYear = Number(pickTag(x, "dealYear"));
        const dealMonth = Number(pickTag(x, "dealMonth"));
        const dealDay = Number(pickTag(x, "dealDay"));
        const floor = Number(pickTag(x, "floor"));
        const buildYear = Number(pickTag(x, "buildYear"));
        const jibun = pickTag(x, "jibun");
        const dong = pickTag(x, "umdNm");
        if (!aptNm || !dealAmount || !dealYear || !dealMonth) continue;

        const isSameApartment = isApartmentNameMatch(aptNm, buildingName);
        const isSameDong = targetDong ? dong === targetDong : true;
        const areaDifferenceM2 = exclusiveAreaM2 && area ? Math.abs(area - exclusiveAreaM2) : undefined;
        const floorDifference = targetFloor && floor ? Math.abs(floor - targetFloor) : undefined;
        const daysAgo = getDaysAgo(dealYear, dealMonth, dealDay);
        const matchTier = getMatchTier({
          isSameDong,
          isSameApartment,
          daysAgo,
          areaDifferenceM2,
          floorDifference,
        });

        if (matchTier === 999) continue;

        const key = [dealAmount, dealYear, dealMonth, dealDay, area, floor, aptNm, jibun].join("|");
        if (seen.has(key)) continue;
        seen.add(key);

        rows.push({
          dealDate: `${dealYear}.${String(dealMonth).padStart(2, "0")}.${String(dealDay).padStart(2, "0")}`,
          dealDateKey: parseDealDateKey({ dealYear, dealMonth, dealDay }),
          aptNm,
          dong,
          jibun,
          area,
          floor,
          dealAmount,
          buildYear,
          areaDifferenceM2,
          floorDifference,
          matchTier,
        });
      }
    }

    const ranked = rows.sort((a, b) => {
      if (a.matchTier !== b.matchTier) return a.matchTier - b.matchTier;
      if ((a.areaDifferenceM2 ?? 999) !== (b.areaDifferenceM2 ?? 999)) {
        return (a.areaDifferenceM2 ?? 999) - (b.areaDifferenceM2 ?? 999);
      }
      if ((a.floorDifference ?? 999) !== (b.floorDifference ?? 999)) {
        return (a.floorDifference ?? 999) - (b.floorDifference ?? 999);
      }
      return b.dealDateKey - a.dealDateKey;
    });

    return NextResponse.json({
      success: true,
      lookupType,
      inputLegalDongCode: legalDongCode,
      apiLawdCd: lawdCd,
      targetDong,
      resolvedAddress,
      note: "같은 동·같은 아파트 거래만 사용하며 최근 3개월 내 같은 면적·같은 층을 우선 비교합니다.",
      transactions: ranked.slice(0, limit),
    });
  } catch (error) {
    console.error("raw_transaction_lookup_failed", error);
    return NextResponse.json({ success: false, message: "raw_transaction_lookup_failed" }, { status: 500 });
  }
}
