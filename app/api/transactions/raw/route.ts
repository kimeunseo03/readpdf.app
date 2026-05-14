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

function getMatchTier(params: {
  isSameDong: boolean;
  isSameApartment: boolean;
  hasArea: boolean;
  hasFloor: boolean;
  daysAgo: number;
  areaDifferenceM2?: number;
  floorDifference?: number;
}) {
  const { isSameDong, isSameApartment, hasArea, hasFloor, daysAgo, areaDifferenceM2, floorDifference } = params;
  if (!isSameDong || !isSameApartment) return 999;

  const inOneMonth = daysAgo <= 31;
  const inThreeMonths = daysAgo <= 93;
  const sameArea = hasArea && areaDifferenceM2 !== undefined && areaDifferenceM2 <= 0.01;
  const sameFloor = hasFloor && floorDifference !== undefined && floorDifference === 0;
  const areaWithin3 = hasArea && areaDifferenceM2 !== undefined && areaDifferenceM2 <= 3;
  const areaWithin5 = hasArea && areaDifferenceM2 !== undefined && areaDifferenceM2 <= 5;
  const floorWithin3 = hasFloor && floorDifference !== undefined && floorDifference <= 3;

  if (hasArea && hasFloor) {
    if (inOneMonth && sameArea && sameFloor) return 1;
    if (inThreeMonths && sameArea && sameFloor) return 2;
    if (inOneMonth && sameArea && floorWithin3) return 3;
    if (inThreeMonths && sameArea && floorWithin3) return 4;
    if (inOneMonth && areaWithin3 && sameFloor) return 5;
    if (inThreeMonths && areaWithin3 && sameFloor) return 6;
    if (inOneMonth && areaWithin3 && floorWithin3) return 7;
    if (inThreeMonths && areaWithin5 && sameFloor) return 8;
    if (inOneMonth && areaWithin5 && floorWithin3) return 9;
    if (inThreeMonths && areaWithin5 && floorWithin3) return 10;
    return 999;
  }

  if (hasArea) {
    if (inOneMonth && sameArea) return 1;
    if (inThreeMonths && sameArea) return 2;
    if (inOneMonth && areaWithin3) return 3;
    if (inThreeMonths && areaWithin3) return 4;
    if (inOneMonth && areaWithin5) return 5;
    if (inThreeMonths && areaWithin5) return 6;
    return 999;
  }

  if (hasFloor) {
    if (inOneMonth && sameFloor) return 1;
    if (inThreeMonths && sameFloor) return 2;
    if (inOneMonth && floorWithin3) return 3;
    if (inThreeMonths && floorWithin3) return 4;
    return 999;
  }

  if (inOneMonth) return 1;
  if (inThreeMonths) return 2;
  return 999;
}

function getMatchLabel(tier: number, hasArea: boolean, hasFloor: boolean) {
  if (hasArea && hasFloor) {
    const labels: Record<number, string> = {
      1: "최근 한달 · 같은 동·같은 아파트·같은 면적·같은 층",
      2: "최근 3개월 · 같은 동·같은 아파트·같은 면적·같은 층",
      3: "최근 한달 · 같은 동·같은 아파트·같은 면적·층수 ±3층",
      4: "최근 3개월 · 같은 동·같은 아파트·같은 면적·층수 ±3층",
      5: "최근 한달 · 같은 동·같은 아파트·면적 ±3㎡·같은 층",
      6: "최근 3개월 · 같은 동·같은 아파트·면적 ±3㎡·같은 층",
      7: "최근 한달 · 같은 동·같은 아파트·면적 ±3㎡·층수 ±3층",
      8: "최근 3개월 · 같은 동·같은 아파트·면적 ±5㎡·같은 층",
      9: "최근 한달 · 같은 동·같은 아파트·면적 ±5㎡·층수 ±3층",
      10: "최근 3개월 · 같은 동·같은 아파트·면적 ±5㎡·층수 ±3층",
    };
    return labels[tier] ?? "조건 불일치";
  }
  if (hasArea) {
    const labels: Record<number, string> = {
      1: "최근 한달 · 같은 동·같은 아파트·같은 면적",
      2: "최근 3개월 · 같은 동·같은 아파트·같은 면적",
      3: "최근 한달 · 같은 동·같은 아파트·면적 ±3㎡",
      4: "최근 3개월 · 같은 동·같은 아파트·면적 ±3㎡",
      5: "최근 한달 · 같은 동·같은 아파트·면적 ±5㎡",
      6: "최근 3개월 · 같은 동·같은 아파트·면적 ±5㎡",
    };
    return labels[tier] ?? "조건 불일치";
  }
  if (hasFloor) {
    const labels: Record<number, string> = {
      1: "최근 한달 · 같은 동·같은 아파트·같은 층",
      2: "최근 3개월 · 같은 동·같은 아파트·같은 층",
      3: "최근 한달 · 같은 동·같은 아파트·층수 ±3층",
      4: "최근 3개월 · 같은 동·같은 아파트·층수 ±3층",
    };
    return labels[tier] ?? "조건 불일치";
  }
  return tier === 1 ? "최근 한달 · 같은 동·같은 아파트" : "최근 3개월 · 같은 동·같은 아파트";
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
        const daysAgo = getDaysAgo(dealYear, dealMonth, dealDay);
        const matchTier = getMatchTier({ isSameDong, isSameApartment, hasArea, hasFloor, daysAgo, areaDifferenceM2, floorDifference });
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
          daysAgo,
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

    return NextResponse.json({
      success: true,
      lookupType,
      inputLegalDongCode: legalDongCode,
      apiLawdCd: lawdCd,
      targetDong,
      resolvedAddress,
      note: "최근 1개월/3개월 기준으로 같은 동·같은 아파트 거래만 단계적으로 추출합니다. 화면에서 최신순·면적순·층수순 정렬을 전환할 수 있습니다.",
      transactions: ranked.slice(0, limit),
    });
  } catch (error) {
    console.error("raw_transaction_lookup_failed", error);
    return NextResponse.json({ success: false, message: "raw_transaction_lookup_failed" }, { status: 500 });
  }
}
