import { NextRequest, NextResponse } from "next/server";
import { searchAddressByKakao } from "../../../../src/backend/valuation/addressSearchApi";

function getRecentDealYearMonths(monthCount = 12): string[] {
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

function isComparable(params: {
  daysAgo: number;
  areaDifferenceM2?: number;
  floorDifference?: number;
}) {
  return (
    params.daysAgo <= 365 &&
    params.areaDifferenceM2 !== undefined &&
    params.floorDifference !== undefined &&
    params.areaDifferenceM2 <= 5 &&
    params.floorDifference <= 5
  );
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
    if (!buildingName) {
      return NextResponse.json({ success: false, message: "같은 아파트명 우선 조회를 위해 단지명을 입력하세요." }, { status: 400 });
    }
    if (exclusiveAreaM2 === undefined || targetFloor === undefined) {
      return NextResponse.json({ success: false, message: "면적과 층수를 입력해야 유사 거래를 조회할 수 있습니다." }, { status: 400 });
    }

    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "PUBLIC_DATA_API_KEY가 없습니다." }, { status: 500 });
    }

    const lawdCd = legalDongCode.slice(0, 5);
    const targetDong = resolvedAddress?.eupmyeondong;
    const sameApartmentRows: any[] = [];
    const fallbackRows: any[] = [];
    const seen = new Set<string>();

    for (const dealYearMonth of getRecentDealYearMonths(12)) {
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
        if (!aptNm || !dealAmount || !dealYear || !dealMonth || !area || !floor) continue;

        const isSameDong = targetDong ? dong === targetDong : true;
        if (!isSameDong) continue;

        const areaDifferenceM2 = Math.abs(area - exclusiveAreaM2);
        const floorDifference = Math.abs(floor - targetFloor);
        const daysAgo = getDaysAgo(dealYear, dealMonth, dealDay);
        if (!isComparable({ daysAgo, areaDifferenceM2, floorDifference })) continue;

        const key = [dealAmount, dealYear, dealMonth, dealDay, area, floor, aptNm, jibun].join("|");
        if (seen.has(key)) continue;
        seen.add(key);

        const isSameApartment = isApartmentNameMatch(aptNm, buildingName);
        const row = {
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
          daysAgo,
          isSameApartment,
          matchType: isSameApartment ? "same_apartment" : "same_dong_fallback",
        };

        if (isSameApartment) sameApartmentRows.push(row);
        else fallbackRows.push(row);
      }
    }

    const sortRecent = (a: any, b: any) => b.dealDateKey - a.dealDateKey;
    const sameApartmentSelected = sameApartmentRows.sort(sortRecent).slice(0, limit);
    const needed = Math.max(0, limit - sameApartmentSelected.length);
    const fallbackSelected = fallbackRows.sort(sortRecent).slice(0, needed);
    const selected = [...sameApartmentSelected, ...fallbackSelected].sort(sortRecent);

    return NextResponse.json({
      success: true,
      lookupType,
      inputLegalDongCode: legalDongCode,
      apiLawdCd: lawdCd,
      targetDong,
      resolvedAddress,
      note: "최근 12개월 내 같은 동·같은 아파트에서 면적 ±5㎡, 층수 ±5층 거래를 최신순으로 먼저 10건 선정합니다. 부족하면 같은 동 다른 아파트의 유사 면적·층수 거래로 채웁니다.",
      transactions: selected,
    });
  } catch (error) {
    console.error("raw_transaction_lookup_failed", error);
    return NextResponse.json({ success: false, message: "raw_transaction_lookup_failed" }, { status: 500 });
  }
}
