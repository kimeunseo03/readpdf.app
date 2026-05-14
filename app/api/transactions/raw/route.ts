import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const legalDongCode = String(body.legalDongCode ?? "").replace(/[^0-9]/g, "");
    const buildingName = String(body.buildingName ?? "").trim();
    const exclusiveAreaM2 = body.exclusiveAreaM2 ? Number(body.exclusiveAreaM2) : undefined;
    const targetFloor = body.targetFloor ? Number(body.targetFloor) : undefined;
    const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 30);

    if (![5, 10].includes(legalDongCode.length)) {
      return NextResponse.json({ success: false, message: "법정동코드는 5자리 또는 10자리로 입력하세요." }, { status: 400 });
    }

    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "PUBLIC_DATA_API_KEY가 없습니다." }, { status: 500 });
    }

    const lawdCd = legalDongCode.slice(0, 5);
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
        const dong = pickTag(x, "umdNm") || pickTag(x, "umdNm");
        const dealType = pickTag(x, "dealingGbn") || pickTag(x, "dealGbn");
        if (!aptNm || !dealAmount || !dealYear || !dealMonth) continue;

        const normalizedApiName = normalizeApartmentName(aptNm);
        const isSameApartment = Boolean(
          normalizedTargetName &&
          (normalizedApiName.includes(normalizedTargetName) || normalizedTargetName.includes(normalizedApiName))
        );
        const areaDifferenceM2 = exclusiveAreaM2 && area ? Math.abs(area - exclusiveAreaM2) : undefined;
        const floorDifference = targetFloor && floor ? Math.abs(floor - targetFloor) : undefined;
        const key = [dealAmount, dealYear, dealMonth, dealDay, area, floor, aptNm, jibun].join("|");
        if (seen.has(key)) continue;
        seen.add(key);

        rows.push({
          dealDate: `${dealYear}.${String(dealMonth).padStart(2, "0")}.${String(dealDay).padStart(2, "0")}`,
          aptNm,
          dong,
          jibun,
          area,
          floor,
          dealAmount,
          buildYear,
          dealType,
          isSameApartment,
          areaDifferenceM2,
          floorDifference,
        });
      }

      if (rows.length >= limit * 3) break;
    }

    const sorted = rows.sort((a, b) => {
      if (b.isSameApartment !== a.isSameApartment) return Number(b.isSameApartment) - Number(a.isSameApartment);
      if (a.areaDifferenceM2 !== undefined && b.areaDifferenceM2 !== undefined && a.areaDifferenceM2 !== b.areaDifferenceM2) return a.areaDifferenceM2 - b.areaDifferenceM2;
      if (a.floorDifference !== undefined && b.floorDifference !== undefined && a.floorDifference !== b.floorDifference) return a.floorDifference - b.floorDifference;
      return b.dealDate.localeCompare(a.dealDate);
    });

    return NextResponse.json({
      success: true,
      inputLegalDongCode: legalDongCode,
      apiLawdCd: lawdCd,
      note: "실거래 API는 5자리 시군구 코드로 조회하고, 단지명/면적/층수는 조회 후 검증용으로 표시합니다.",
      transactions: sorted.slice(0, limit),
    });
  } catch (error) {
    console.error("raw_transaction_lookup_failed", error);
    return NextResponse.json({ success: false, message: "raw_transaction_lookup_failed" }, { status: 500 });
  }
}
