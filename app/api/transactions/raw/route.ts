/**
 * POST /api/transactions/raw
 * ─────────────────────────────────────────────────
 * 국토부 실거래 공공데이터 API 다단계 조회
 *
 * 처리 순서:
 *   1. 주소 → 카카오 API → 법정동코드(lawdCd) 변환
 *   2. STEPS 순서대로 조회 (기간↑ / 면적허용 범위↑):
 *      단계 1~N 중 동일단지 3건↑ 확보되면 조기 종료
 *   3. 동일단지 0건이면 동일 읍면동 유사단지 폴백
 *   4. 거래일·면적차·층수차 계산 후 반환
 *
 * 환경변수:
 *   PUBLIC_DATA_API_KEY : 국토부 공공데이터포털 API 키 (서버 전용)
 *   KAKAO_REST_API_KEY  : 카카오 주소 검색 API 키 (서버 전용)
 * ─────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from "next/server";
import { searchAddressByKakao } from "../../../../src/backend/valuation/addressSearchApi";
import { isApartmentNameMatch } from "../../../../src/backend/valuation/normalizeApartmentName";

function getRecentDealYearMonths(monthCount = 12): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < monthCount; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function pickTag(source: string, tag: string): string {
  return source.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1]?.trim() ?? "";
}

function getDaysAgo(dealYear: number, dealMonth: number, dealDay: number): number {
  const now = new Date();
  const dealDate = new Date(dealYear, dealMonth - 1, dealDay || 1);
  return Math.max(0, Math.floor((now.getTime() - dealDate.getTime()) / 86400000));
}


type RawRow = {
  dealDate: string;
  dealDateKey: number;
  aptNm: string;
  dong: string;
  jibun: string;
  area: number;
  floor: number;
  dealAmount: number;
  buildYear: number;
  areaDifferenceM2: number;
  floorDifference: number;
  daysAgo: number;
  isSameApartment: boolean;
  isDirect: boolean;
  matchType: "same_apartment" | "same_dong_fallback";
};

// 단계 정의: 기간 짧고 면적·층수 오차 작은 순으로 우선 시도 (최대 12개월)
const STEPS = [
  { months: 1,  maxDaysAgo: 30,  areaToleranceM2: 1, maxFloorDiff: 2  }, // 1개월  ±1㎡  ±2층
  { months: 3,  maxDaysAgo: 90,  areaToleranceM2: 1, maxFloorDiff: 2  }, // 3개월  ±1㎡  ±2층
  { months: 1,  maxDaysAgo: 30,  areaToleranceM2: 3, maxFloorDiff: 3  }, // 1개월  ±3㎡  ±3층
  { months: 3,  maxDaysAgo: 90,  areaToleranceM2: 3, maxFloorDiff: 3  }, // 3개월  ±3㎡  ±3층
  { months: 6,  maxDaysAgo: 180, areaToleranceM2: 5, maxFloorDiff: 5  }, // 6개월  ±5㎡  ±5층
  { months: 12, maxDaysAgo: 365, areaToleranceM2: 5, maxFloorDiff: 10 }, // 12개월 ±5㎡ ±10층
] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lookupType = String(body.lookupType ?? "legalDongCode");
    const addressQuery = String(body.addressQuery ?? "").trim();
    let legalDongCode = String(body.legalDongCode ?? "").replace(/[^0-9]/g, "");
    let resolvedAddress: Awaited<ReturnType<typeof searchAddressByKakao>> | undefined;

    if (lookupType === "jibun" || lookupType === "road") {
      resolvedAddress = await searchAddressByKakao(addressQuery);
      if (!resolvedAddress) {
        return NextResponse.json(
          { success: false, message: "주소를 찾을 수 없습니다. 더 구체적인 주소로 다시 시도해 주세요." },
          { status: 400 }
        );
      }
      legalDongCode = resolvedAddress.legalDongCode?.replace(/[^0-9]/g, "") ?? "";
    }

    const buildingName = String(body.buildingName ?? "").trim();
    const exclusiveAreaM2 = body.exclusiveAreaM2 ? Number(body.exclusiveAreaM2) : undefined;
    const targetFloor = body.targetFloor ? Number(body.targetFloor) : undefined;
    const limit = Math.min(Math.max(Number(body.limit ?? 10), 1), 30);

    if (![5, 10].includes(legalDongCode.length)) {
      return NextResponse.json(
        { success: false, message: "법정동코드를 확인하지 못했습니다. 주소를 더 구체적으로 입력하거나 5자리/10자리 법정동코드로 조회하세요." },
        { status: 400 }
      );
    }
    if (!buildingName) {
      return NextResponse.json(
        { success: false, message: "동일단지 우선 조회를 위해 단지명을 입력하세요." },
        { status: 400 }
      );
    }
    if (exclusiveAreaM2 === undefined || targetFloor === undefined) {
      return NextResponse.json(
        { success: false, message: "면적과 층수를 입력해야 유사 거래를 조회할 수 있습니다." },
        { status: 400 }
      );
    }

    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "PUBLIC_DATA_API_KEY가 없습니다." }, { status: 500 });
    }

    const lawdCd = legalDongCode.slice(0, 5);
    const targetDong = resolvedAddress?.eupmyeondong;

    // 누적 저장소: 이미 fetch한 달은 재요청하지 않음
    const seen = new Set<string>();
    const allRows: RawRow[] = [];
    let fetchedMonths = 0;

    const expandData = async (targetMonths: number) => {
      if (fetchedMonths >= targetMonths) return;

      const allMonthKeys = getRecentDealYearMonths(targetMonths);
      const newMonthKeys = allMonthKeys.slice(fetchedMonths);

      for (const dealYearMonth of newMonthKeys) {
        const url = new URL("https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade");
        url.searchParams.set("serviceKey", apiKey);
        url.searchParams.set("LAWD_CD", lawdCd);
        url.searchParams.set("DEAL_YMD", dealYearMonth);
        url.searchParams.set("pageNo", "1");
        url.searchParams.set("numOfRows", "200");

        try {
          const res = await fetch(url.toString(), {
            method: "GET",
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) continue;

          const xml = await res.text();

          for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
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
            // 해제(취소) 거래 제외 — cdealType 필드가 있으면 취소 거래
            const cdealType = pickTag(x, "cdealType");
            if (cdealType) continue;
            if (targetDong && dong !== targetDong) continue;

            const key = [dealAmount, dealYear, dealMonth, dealDay, area, floor, aptNm, jibun].join("|");
            if (seen.has(key)) continue;
            seen.add(key);

            const isSameApartment = isApartmentNameMatch(aptNm, buildingName);
            const dealingGbn = pickTag(x, "dealingGbn").trim();
            const isDirect = dealingGbn === "직거래";

            allRows.push({
              dealDate: `${dealYear}.${String(dealMonth).padStart(2, "0")}.${String(dealDay).padStart(2, "0")}`,
              dealDateKey: dealYear * 10000 + dealMonth * 100 + dealDay,
              aptNm,
              dong,
              jibun,
              area,
              floor,
              dealAmount,
              buildYear,
              areaDifferenceM2: Math.abs(area - exclusiveAreaM2),
              floorDifference: Math.abs(floor - targetFloor),
              daysAgo: getDaysAgo(dealYear, dealMonth, dealDay),
              isSameApartment,
              isDirect,
              matchType: isSameApartment ? "same_apartment" : "same_dong_fallback",
            });
          }
        } catch {
          continue;
        }
      }

      fetchedMonths = targetMonths;
    };

    // 동일단지 우선 단계별 조회
    // limit 이상 확보되면 즉시 중단, 아니면 다음 단계로 확장
    let sameApartmentRows: RawRow[] = [];
    let usedStep: (typeof STEPS)[number] = STEPS[STEPS.length - 1];

    for (const step of STEPS) {
      await expandData(step.months);

      const filtered = allRows.filter(
        (row) =>
          row.isSameApartment &&
          row.daysAgo <= step.maxDaysAgo &&
          row.areaDifferenceM2 <= step.areaToleranceM2 &&
          row.floorDifference <= step.maxFloorDiff
      );

      sameApartmentRows = filtered;
      usedStep = step;

      if (filtered.length >= limit) break;
    }

    // 동일단지 최신순 정렬
    sameApartmentRows.sort((a, b) => b.dealDateKey - a.dealDateKey);

    let finalRows: RawRow[];

    if (sameApartmentRows.length >= limit) {
      // 동일단지만으로 충분 → 유사단지 섞지 않음
      finalRows = sameApartmentRows.slice(0, limit);
    } else {
      // 동일단지 0건이면 ±3㎡·6개월로 제한 — ±5㎡보다 타이트하게 유사단지 필터
      // 동일단지 일부 있으면 usedStep(이미 넓혀진 기준) 그대로 사용
      const fallbackStep = sameApartmentRows.length === 0
        ? { maxDaysAgo: 180, areaToleranceM2: 3, maxFloorDiff: 5 } // 6개월 ±3㎡
        : usedStep;
      const fallbackRows = allRows
        .filter(
          (row) =>
            !row.isSameApartment &&
            row.daysAgo <= fallbackStep.maxDaysAgo &&
            row.areaDifferenceM2 <= fallbackStep.areaToleranceM2 &&
            row.floorDifference <= fallbackStep.maxFloorDiff
        )
        .sort((a, b) => b.dealDateKey - a.dealDateKey);

      finalRows = [
        ...sameApartmentRows,
        ...fallbackRows.slice(0, limit - sameApartmentRows.length),
      ];
    }

    const noteMonths =
      usedStep.maxDaysAgo <= 30  ? "1개월"  :
      usedStep.maxDaysAgo <= 90  ? "3개월"  :
      usedStep.maxDaysAgo <= 180 ? "6개월"  : "12개월";

    const sameCount = sameApartmentRows.length;
    const fallbackCount = finalRows.length - sameCount;

    return NextResponse.json({
      success: true,
      lookupType,
      inputLegalDongCode: legalDongCode,
      apiLawdCd: lawdCd,
      targetDong,
      resolvedAddress,
      searchMonths: usedStep.months,
      note: `${noteMonths} 이내 ±${usedStep.areaToleranceM2}㎡ 기준. 동일단지 ${sameCount}건, 유사단지 ${fallbackCount}건.`,
      transactions: finalRows,
    });
  } catch (error) {
    console.error("raw_transaction_lookup_failed", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
