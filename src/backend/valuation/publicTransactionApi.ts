import type { PublicTransactionApiParams, TransactionItem } from "./types";
import type { ExtractedRegion } from "./extractRegion";
import { isApartmentNameMatch } from "./normalizeApartmentName";

interface FetchParams {
  buildingName?: string;
  exclusiveAreaM2?: number;
  region?: ExtractedRegion;
  legalDongCode?: string;
  targetFloor?: number;
  targetBuildYear?: number;
  targetHouseholdCount?: number;
  targetSubwayWalkMinutes?: number;
  targetCoordinate?: { latitude: number; longitude: number };
  targetKaptCode?: string;
}

type ApartmentTradeApiParams = PublicTransactionApiParams & {
  region?: ExtractedRegion;
  floorTolerance?: number;
};

function getRecentDealYearMonths(monthCount = 24): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < monthCount; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}


function getMonthsAgo(year: number, month: number, day: number): number {
  const now = new Date();
  const dealDate = new Date(year, month - 1, day || 1);
  return (
    (now.getFullYear() - dealDate.getFullYear()) * 12 +
    (now.getMonth() - dealDate.getMonth())
  );
}

function getRecencyScore(monthsAgo?: number): { score: number; reason?: string } {
  if (monthsAgo === undefined) return { score: 0 };
  if (monthsAgo <= 3) return { score: 15, reason: "3개월 이내 거래" };
  if (monthsAgo <= 6) return { score: 8, reason: "6개월 이내 거래" };
  if (monthsAgo <= 12) return { score: 3, reason: "12개월 이내 거래" };
  return { score: -5, reason: "12개월 초과 거래" };
}

function getFloorSimilarityScore(params: { targetFloor?: number; transactionFloor?: number }) {
  const { targetFloor, transactionFloor } = params;
  if (!targetFloor || !transactionFloor) return { score: 0, reason: undefined as string | undefined };
  const diff = Math.abs(targetFloor - transactionFloor);
  if (diff <= 2) return { score: 12, reason: "유사층(±2층)" };
  if (diff <= 5) return { score: 6, reason: "인접층(±5층)" };
  if (diff <= 10) return { score: 2, reason: `층수 차이 ${diff}층` };
  return { score: -8, reason: `층수 차이 큼(${diff}층)` };
}

function getFloorPenalty(floor?: number): number {
  if (!floor) return 0;
  return floor <= 2 ? -8 : 0;
}

function getBuildYearSimilarityScore(params: { targetBuildYear?: number; transactionBuildYear?: number }) {
  const { targetBuildYear, transactionBuildYear } = params;
  if (!targetBuildYear || !transactionBuildYear) return { score: 0, reason: undefined as string | undefined };
  const diff = Math.abs(targetBuildYear - transactionBuildYear);
  if (diff <= 3) return { score: 10, reason: "준공연도 유사(±3년)" };
  if (diff <= 5) return { score: 6, reason: "준공연도 유사(±5년)" };
  if (diff <= 10) return { score: 2, reason: `준공연도 차이 ${diff}년` };
  return { score: -10, reason: `준공연도 차이 큼(${diff}년)` };
}

function applyGeneralBuildYearScore(params: { buildYear?: number; similarityScore: number; similarityReason: string }) {
  let { similarityScore, similarityReason } = params;
  const { buildYear } = params;
  if ((buildYear ?? 0) > 0) {
    const age = new Date().getFullYear() - (buildYear ?? 0);
    if (age <= 10) { similarityScore += 10; similarityReason += " · 준공 10년 이하"; }
    else if (age <= 20) { similarityScore += 5; similarityReason += " · 준공 20년 이하"; }
    else if (age >= 35) { similarityScore -= 12; similarityReason += " · 준공 35년 이상"; }
    else if (age >= 30) { similarityScore -= 7; similarityReason += " · 준공 30년 이상"; }
  }
  return { similarityScore, similarityReason };
}

function getFloorToleranceLabel(floorTolerance?: number) {
  return floorTolerance === undefined ? "층수 조건 완화" : `층수 ±${floorTolerance}층`;
}

async function fetchApartmentTradeApi(params: ApartmentTradeApiParams): Promise<TransactionItem[]> {
  try {
    if (!params.legalDongCode) return [];
    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    if (!apiKey) { console.warn("PUBLIC_DATA_API_KEY is missing."); return []; }

    const lawdCd = params.legalDongCode.slice(0, 5);
    const url = new URL("https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade");
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("LAWD_CD", lawdCd);
    url.searchParams.set("DEAL_YMD", params.dealYearMonth);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "100");

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    if (!res.ok) { console.warn("transaction_api_failed", res.status); return []; }

    const xml = await res.text();
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const transactions: TransactionItem[] = [];
    const seenKeys = new Set<string>();

    for (const match of itemMatches) {
      const x = match[1];
      const aptNm = x.match(/<aptNm>(.*?)<\/aptNm>/)?.[1]?.trim() ?? "";
      const area = Number(x.match(/<excluUseAr>(.*?)<\/excluUseAr>/)?.[1] ?? "");
      const dealAmount = Number((x.match(/<dealAmount>(.*?)<\/dealAmount>/)?.[1] ?? "").replace(/,/g, "").trim());
      const dealYear = Number(x.match(/<dealYear>(.*?)<\/dealYear>/)?.[1] ?? 0);
      const dealMonth = Number(x.match(/<dealMonth>(.*?)<\/dealMonth>/)?.[1] ?? 0);
      const dealDay = Number(x.match(/<dealDay>(.*?)<\/dealDay>/)?.[1] ?? 0);
      const floor = Number(x.match(/<floor>(.*?)<\/floor>/)?.[1] ?? 0);
      const buildYear = Number(x.match(/<buildYear>(.*?)<\/buildYear>/)?.[1] ?? 0);
      const dealType = x.match(/<dealingGbn>(.*?)<\/dealingGbn>/)?.[1]?.trim() ?? x.match(/<dealGbn>(.*?)<\/dealGbn>/)?.[1]?.trim() ?? "";

      if (!dealAmount || !area || !dealYear || !dealMonth) continue;

      const areaToleranceM2 = params.areaToleranceM2 ?? 3;
      const areaDifferenceM2 = params.exclusiveAreaM2 ? Math.abs(area - params.exclusiveAreaM2) : undefined;
      if (areaDifferenceM2 !== undefined && areaDifferenceM2 > areaToleranceM2) continue;

      if (params.targetFloor && floor && params.floorTolerance !== undefined) {
        const floorDifference = Math.abs(floor - params.targetFloor);
        if (floorDifference > params.floorTolerance) continue;
      }

      const monthsAgo = getMonthsAgo(dealYear, dealMonth, dealDay);
      if (monthsAgo > 24) continue;

      const isSameApartment = isApartmentNameMatch(aptNm, params.buildingName ?? "");

      let similarityScore = 20;
      let similarityReason = "동일 지역 유사 면적";

      if (isSameApartment) {
        similarityScore += 35;
        similarityReason = "동일 단지(단지명 일치)";
      }

      if (areaDifferenceM2 !== undefined) {
        if (areaDifferenceM2 <= 1) { similarityScore += 15; similarityReason += " · 면적 차이 1㎡ 이하"; }
        else if (areaDifferenceM2 <= 2) { similarityScore += 8; similarityReason += " · 면적 차이 2㎡ 이하"; }
        else { similarityScore += 3; similarityReason += ` · 면적 차이 ${areaDifferenceM2.toFixed(2)}㎡`; }
      }

      const recency = getRecencyScore(monthsAgo);
      similarityScore += recency.score;
      if (recency.reason) similarityReason += ` · ${recency.reason}`;

      const floorSim = getFloorSimilarityScore({ targetFloor: params.targetFloor, transactionFloor: floor });
      similarityScore += floorSim.score + getFloorPenalty(floor);
      if (floorSim.reason) similarityReason += ` · ${floorSim.reason}`;

      const buildYearSim = getBuildYearSimilarityScore({ targetBuildYear: params.targetBuildYear, transactionBuildYear: buildYear });
      if (buildYearSim.reason) {
        similarityScore += buildYearSim.score;
        similarityReason += ` · ${buildYearSim.reason}`;
      } else {
        const general = applyGeneralBuildYearScore({ buildYear, similarityScore, similarityReason });
        similarityScore = general.similarityScore;
        similarityReason = general.similarityReason;
      }

      if (dealType.includes("직거래")) {
        similarityScore -= 15;
        similarityReason += " · 직거래 감점";
      }

      similarityScore = Math.max(0, Math.min(100, similarityScore));

      const key = [dealAmount, dealYear, dealMonth, dealDay, area, floor, aptNm].join("|");
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      let reliabilityGrade: "A" | "B" | "C" = "C";
      if (similarityScore >= 85) reliabilityGrade = "A";
      else if (similarityScore >= 65) reliabilityGrade = "B";

      const floorLabel = getFloorToleranceLabel(params.floorTolerance);

      transactions.push({
        dealAmount, dealYear, dealMonth, dealDay,
        area, floor, buildYear,
        isSameApartment, areaDifferenceM2, monthsAgo,
        distanceMeters: undefined,
        similarityScore, similarityReason, reliabilityGrade,
        selectionReason: isSameApartment
          ? `동일 단지 거래 · 면적 ±${areaToleranceM2}㎡ · ${floorLabel}`
          : `동일 지역 유사 거래 · 면적 ±${areaToleranceM2}㎡ · ${floorLabel}`,
      });
    }

    console.log("filtered_transaction_count", transactions.length);
    return transactions;
  } catch (error) {
    console.error("fetchApartmentTradeApi_error", error);
    return [];
  }
}

export async function fetchPublicTransactions(params: FetchParams): Promise<TransactionItem[]> {
  console.log("valuation_legalDongCode", params.legalDongCode ?? "undefined");
  if (!params.legalDongCode) return [];

  const recentMonths = getRecentDealYearMonths(24);
  const searchStages = [
    { areaToleranceM2: 3, floorTolerance: 5 },
    { areaToleranceM2: 3, floorTolerance: 10 },
    { areaToleranceM2: 3, floorTolerance: undefined },
    { areaToleranceM2: 5, floorTolerance: 10 },
    { areaToleranceM2: 5, floorTolerance: undefined },
  ];

  for (const stage of searchStages) {
    const allTransactions: TransactionItem[] = [];

    for (const dealYearMonth of recentMonths) {
      const monthly = await fetchApartmentTradeApi({
        legalDongCode: params.legalDongCode,
        dealYearMonth,
        buildingName: params.buildingName,
        exclusiveAreaM2: params.exclusiveAreaM2,
        areaToleranceM2: stage.areaToleranceM2,
        floorTolerance: stage.floorTolerance,
        targetFloor: params.targetFloor,
        targetBuildYear: params.targetBuildYear,
        targetHouseholdCount: params.targetHouseholdCount,
        targetSubwayWalkMinutes: params.targetSubwayWalkMinutes,
        targetKaptCode: params.targetKaptCode,
        region: params.region,
      });
      allTransactions.push(...monthly);

      const sameCount = allTransactions.filter((tx) => tx.isSameApartment).length;
      if (sameCount >= 3 || allTransactions.length >= 5) break;
    }

    if (allTransactions.length > 0) {
      return allTransactions
        .sort((a, b) => {
          if (b.isSameApartment !== a.isSameApartment) return (b.isSameApartment ? 1 : 0) - (a.isSameApartment ? 1 : 0);
          if ((b.similarityScore ?? 0) !== (a.similarityScore ?? 0)) return (b.similarityScore ?? 0) - (a.similarityScore ?? 0);
          const dateA = a.dealYear * 10000 + a.dealMonth * 100 + a.dealDay;
          const dateB = b.dealYear * 10000 + b.dealMonth * 100 + b.dealDay;
          return dateB - dateA;
        })
        .slice(0, 5);
    }
  }

  return [];
}
