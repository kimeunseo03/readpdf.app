import { NextRequest, NextResponse } from "next/server";
import { searchAddressByKakao } from "../../../../src/backend/valuation/addressSearchApi";

function getRecentDealYearMonths(monthCount = 24): string[] {
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

function getMatchTier(params: {
  isSameDong: boolean;
  isSameApartment: boolean;
  hasArea: boolean;
  hasFloor: boolean;
  areaDifferenceM2?: number;
  floorDifference?: number;
}) {
  const { isSameDong, isSameApartment, hasArea, hasFloor, areaDifferenceM2, floorDifference } = params;
  if (!isSameDong || !isSameApartment) return 999;

  const sameArea = hasArea && areaDifferenceM2 !== undefined && areaDifferenceM2 <= 0.01;
  const sameFloor = hasFloor && floorDifference !== undefined && floorDifference === 0;
  const areaWithin3 = hasArea && areaDifferenceM2 !== undefined && areaDifferenceM2 <= 3;
  const floorWithin3 = hasFloor && floorDifference !== undefined && floorDifference <= 3;

  if (hasArea && hasFloor) {
    if (sameArea && sameFloor) return 1;
    if (sameArea && floorWithin3) return 2;
    if (areaWithin3 && floorWithin3) return 3;
    return 999;
  }

  if (hasArea) {
    if (sameArea) return 1;
    if (areaWithin3) return 2;
    return 999;
  }

  if (hasFloor) {
    if (sameFloor) return 1;
    if (floorWithin3) return 2;
    return 999;
  }

  return 1;
}

function getMatchLabel(tier: number, hasArea: boolean, hasFloor: boolean) {
  if (hasArea && hasFloor) {
    if (tier === 1) return "같은 동·같은 아파트·같은 면적·같은 층";
    if (tier === 2) return "같은 동·같은 아파트·같은 면적·층수 ±3층";
    if (tier === 3) return "같은 동·같은 아파트·면적 ±3㎡·층수 ±3층";
  }
  if (hasArea) {
    if (tier === 1) return "같은 동·같은 아파트·같은 면적";
    if (tier === 2) return "같은 동·같은 아파트·면적 ±3㎡";
  }
  if (hasFloor) {
    if (tier === 1) return "같은 동·같은 아파트·같은 층";
    if (tier === 2) return "같은 동·같은 아파트·층수 ±3층";
  }
  return "같은 동·같은 아파트";
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
    const hasArea = exclusiveAreaM2 !== undefined;
    const hasFloor = targetFloor !== undefined;
    const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 30);

    if (![5, 10].includes(legalDongCode.length)) {
      return NextResponse.json({ success: false, message: "법정동코드 조회에 실패했습니다. 법정동코드는 5자리 또는 10자리여야 합니다." }, { status: 400 });
    }
    if (!buildingName) {
      return NextResponse.json({ success: false, message: "같은 아파트명 기준 조회를 위해 단지명을 입력하세요." }, { status: 400 });
    }

    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "PUBLIC_DATA_API_KEY가 없습니다." }, { status: 500 });
    }

    const lawdCd = legalDongCode.slice(0, 5);
    const targetDong = resolvedAddress?.eupmyeondong;
    const normalizedTargetName = normalizeApartmentName(buildingName);
    const rows: any[] = [];
    const seen = new Set<string>();

    for (const dealYearMonth of getRecentDealYearMonths(24)) {
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
        const dealType = pickTag(x, "dealingGbn") || pickTag(x, "dealGbn");
        if (!aptNm || !dealAmount || !dealYear || !dealMonth) continue;

        const normalizedApiName = normalizeApartmentName(aptNm);
        const isSameApartment = Boolean(
          normalizedTargetName &&
          (normalizedApiName.includes(normalizedTargetName) || normalizedTargetName.includes(normalizedApiName))
        );
        const isSameDong = targetDong ? dong === targetDong : true;
        const areaDifferenceM2 = exclusiveAreaM2 && area ? Math.abs(area - exclusiveAreaM2) : undefined;
        const floorDifference = targetFloor && floor ? Math.abs(floor - targetFloor) : undefined;
        const matchTier = getMatchTier({ isSameDong, isSameApartment, hasArea, hasFloor, areaDifferenceM2, floorDifference });
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
          dealType,
          isSameApartment,
          isSameDong,
          areaDifferenceM2,
          floorDifference,
          matchTier,
          matchLabel: getMatchLabel(matchTier, hasArea, hasFloor),
        });
      }
    }

    const ranked = rows.sort((a, b) => {
      if (a.matchTier !== b.matchTier) return a.matchTier - b.matchTier;
      if (a.areaDifferenceM2 !== undefined && b.areaDifferenceM2 !== undefined && a.areaDifferenceM2 !== b.areaDifferenceM2) return a.areaDifferenceM2 - b.areaDifferenceM2;
      if (a.floorDifference !== undefined && b.floorDifference !== undefined && a.floorDifference !== b.floorDifference) return a.floorDifference - b.floorDifference;
      return b.dealDateKey - a.dealDateKey;
    });

    const selected = ranked.slice(0, limit).sort((a, b) => b.dealDateKey - a.dealDateKey);

    return NextResponse.json({
      success: true,
      lookupType,
      inputLegalDongCode: legalDongCode,
      apiLawdCd: lawdCd,
      targetDong,
      resolvedAddress,
      note: "같은 동·같은 아파트를 기본 조건으로 하고, 면적/층수 입력 시 같은 면적+같은 층 → 같은 면적+층수 ±3층 → 면적 ±3㎡+층수 ±3층 순으로 10건을 추출합니다. 목록은 화면에서 최신순·면적순·층수순으로 전환할 수 있습니다.",
      transactions: selected,
    });
  } catch (error) {
    console.error("raw_transaction_lookup_failed", error);
    return NextResponse.json({ success: false, message: "raw_transaction_lookup_failed" }, { status: 500 });
  }
}
