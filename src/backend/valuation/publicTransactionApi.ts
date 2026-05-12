import type { PublicTransactionApiParams, TransactionItem } from "./types";
import type { ExtractedRegion } from "./extractRegion";
import { geocodeAddress } from "./geocodeApi";
import { calculateDistanceMeters } from "./distance";

interface FetchParams {
  buildingName?: string;
  exclusiveAreaM2?: number;
  region?: ExtractedRegion;
  legalDongCode?: string;
  targetFloor?: number;
  targetCoordinate?: {
    latitude: number;
    longitude: number;
  };
}

interface FallbackRule {
  monthCount: number;
  areaToleranceM2: number;
  minimumComparableCount: number;
  label: string;
}

const FALLBACK_RULES: FallbackRule[] = [
  {
    monthCount: 12,
    areaToleranceM2: 3,
    minimumComparableCount: 3,
    label: "최근 12개월 · 전용면적 ±3㎡"
  },
  {
    monthCount: 24,
    areaToleranceM2: 5,
    minimumComparableCount: 3,
    label: "최근 24개월 · 전용면적 ±5㎡"
  },
  {
    monthCount: 36,
    areaToleranceM2: 10,
    minimumComparableCount: 2,
    label: "최근 36개월 · 전용면적 ±10㎡"
  }
];

function getRecentDealYearMonths(monthCount = 12): string[] {
  const result: string[] = [];
  const now = new Date();

  for (let i = 0; i < monthCount; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    result.push(`${year}${month}`);
  }

  return result;
}

function normalizeApartmentName(value?: string) {
  return value?.replace(/\s/g, "").trim() ?? "";
}

function getMonthsAgo(year: number, month: number, day: number) {
  const now = new Date();
  const dealDate = new Date(year, month - 1, day || 1);

  return (
    (now.getFullYear() - dealDate.getFullYear()) * 12 +
    (now.getMonth() - dealDate.getMonth())
  );
}

function buildApartmentSearchAddress(params: {
  region?: ExtractedRegion;
  apartmentName?: string;
}) {
  const parts = [
    params.region?.sido,
    params.region?.sigungu,
    params.region?.eupmyeondong,
    params.apartmentName
  ].filter(Boolean);

  return parts.join(" ");
}

function getFloorSimilarityScore(params: {
  targetFloor?: number;
  transactionFloor?: number;
}) {
  const { targetFloor, transactionFloor } = params;

  if (!targetFloor || !transactionFloor) {
    return {
      score: 0,
      reason: undefined as string | undefined
    };
  }

  const floorDifference = Math.abs(targetFloor - transactionFloor);

  if (floorDifference <= 2) {
    return {
      score: 14,
      reason: "유사층(±2층)"
    };
  }

  if (floorDifference <= 5) {
    return {
      score: 8,
      reason: "인접층(±5층)"
    };
  }

  if (floorDifference <= 10) {
    return {
      score: 3,
      reason: `층수 차이 ${floorDifference}층`
    };
  }

  return {
    score: -8,
    reason: `층수 차이 큼(${floorDifference}층)`
  };
}

function getFloorPenalty(floor?: number) {
  if (!floor) return 0;
  if (floor <= 2) return -8;
  return 0;
}

function transactionSort(a: TransactionItem, b: TransactionItem) {
  const sameA = a.isSameApartment ? 1 : 0;
  const sameB = b.isSameApartment ? 1 : 0;

  if (sameB !== sameA) return sameB - sameA;

  const tierPriority = (tx: TransactionItem) => {
    if (tx.isSameApartment) return 0;
    if ((tx.distanceMeters ?? 999999) <= 500) return 1;
    if ((tx.distanceMeters ?? 999999) <= 1000) return 2;
    return 3;
  };

  const tierA = tierPriority(a);
  const tierB = tierPriority(b);

  if (tierA !== tierB) return tierA - tierB;

  const scoreA = a.similarityScore ?? 0;
  const scoreB = b.similarityScore ?? 0;

  if (scoreB !== scoreA) return scoreB - scoreA;

  const dateA = a.dealYear * 10000 + a.dealMonth * 100 + a.dealDay;
  const dateB = b.dealYear * 10000 + b.dealMonth * 100 + b.dealDay;

  return dateB - dateA;
}

async function fetchApartmentTradeApi(
  params: PublicTransactionApiParams & {
    region?: ExtractedRegion;
    fallbackLabel?: string;
  }
): Promise<TransactionItem[]> {
  try {
    if (!params.legalDongCode) return [];

    const apiKey = process.env.PUBLIC_DATA_API_KEY;

    if (!apiKey) {
      console.warn("PUBLIC_DATA_API_KEY is missing.");
      return [];
    }

    const lawdCd = params.legalDongCode.slice(0, 5);

    const url = new URL(
      "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"
    );

    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("LAWD_CD", lawdCd);
    url.searchParams.set("DEAL_YMD", params.dealYearMonth);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "100");

    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    if (!res.ok) {
      console.warn("Public transaction API failed.", res.status);
      return [];
    }

    const xml = await res.text();
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const transactions: TransactionItem[] = [];
    const seenTransactionKeys = new Set<string>();

    for (const match of itemMatches) {
      const itemXml = match[1];

      const aptNm =
        itemXml.match(/<aptNm>(.*?)<\/aptNm>/)?.[1]?.trim() ?? "";

      const area = Number(
        itemXml.match(/<excluUseAr>(.*?)<\/excluUseAr>/)?.[1] ?? ""
      );

      const dealAmount = Number(
        (itemXml.match(/<dealAmount>(.*?)<\/dealAmount>/)?.[1] ?? "")
          .replace(/,/g, "")
          .trim()
      );

      const dealYear = Number(
        itemXml.match(/<dealYear>(.*?)<\/dealYear>/)?.[1] ?? 0
      );

      const dealMonth = Number(
        itemXml.match(/<dealMonth>(.*?)<\/dealMonth>/)?.[1] ?? 0
      );

      const dealDay = Number(
        itemXml.match(/<dealDay>(.*?)<\/dealDay>/)?.[1] ?? 0
      );

      const floor = Number(itemXml.match(/<floor>(.*?)<\/floor>/)?.[1] ?? 0);

      const buildYear = Number(
        itemXml.match(/<buildYear>(.*?)<\/buildYear>/)?.[1] ?? 0
      );

      const dealType =
        itemXml.match(/<dealingGbn>(.*?)<\/dealingGbn>/)?.[1]?.trim() ??
        itemXml.match(/<dealGbn>(.*?)<\/dealGbn>/)?.[1]?.trim() ??
        "";

      if (!dealAmount || !area || !dealYear || !dealMonth) continue;

      const areaToleranceM2 = params.areaToleranceM2 ?? 3;
      const areaDifferenceM2 = params.exclusiveAreaM2
        ? Math.abs(area - params.exclusiveAreaM2)
        : undefined;

      const isSimilarArea =
        areaDifferenceM2 === undefined || areaDifferenceM2 <= areaToleranceM2;

      if (!isSimilarArea) continue;

      const normalizedApiName = normalizeApartmentName(aptNm);
      const normalizedTargetName = normalizeApartmentName(params.buildingName);

      const isSameApartment =
        normalizedTargetName.length > 0 &&
        (normalizedApiName.includes(normalizedTargetName) ||
          normalizedTargetName.includes(normalizedApiName));

      const monthsAgo = getMonthsAgo(dealYear, dealMonth, dealDay);
      const allowedMonths = params.allowedMonths ?? 12;

      if (monthsAgo > allowedMonths) continue;

      const transactionCoordinate = await geocodeAddress(
        buildApartmentSearchAddress({
          region: params.region,
          apartmentName: aptNm
        })
      );

      const distanceMeters = calculateDistanceMeters(
        params.targetCoordinate,
        transactionCoordinate
      );

      let similarityScore = 35;
      let similarityReason = "동일 법정동 유사 면적";

      if (isSameApartment) {
        similarityScore += 45;
        similarityReason = "동일 단지";
      }

      if (areaDifferenceM2 !== undefined) {
        if (areaDifferenceM2 <= 1) similarityScore += 15;
        else if (areaDifferenceM2 <= 2) similarityScore += 8;
        else if (areaDifferenceM2 <= 5) similarityScore += 3;
        else similarityScore -= 5;
      }

      if (distanceMeters !== undefined) {
        if (distanceMeters <= 500) {
          similarityScore += 18;
          similarityReason += " · 반경 500m 이내";
        } else if (distanceMeters <= 1000) {
          similarityScore += 8;
          similarityReason += " · 반경 1km 이내";
        } else if (!isSameApartment) {
          similarityScore -= 20;
          similarityReason += " · 법정동 fallback";
        }
      }

      const floorSimilarity = getFloorSimilarityScore({
        targetFloor: params.targetFloor,
        transactionFloor: floor
      });

      similarityScore += floorSimilarity.score;
      similarityScore += getFloorPenalty(floor);

      if (buildYear > 0) {
        const currentYear = new Date().getFullYear();
        const buildingAge = currentYear - buildYear;

        if (buildingAge <= 10) {
          similarityScore += 10;
          similarityReason += " · 준공 10년 이하";
        } else if (buildingAge <= 20) {
          similarityScore += 5;
          similarityReason += " · 준공 20년 이하";
        } else if (buildingAge >= 35) {
          similarityScore -= 12;
          similarityReason += " · 준공 35년 이상";
        } else if (buildingAge >= 30) {
          similarityScore -= 7;
          similarityReason += " · 준공 30년 이상";
        }
      }

      if (floorSimilarity.reason) {
        similarityReason += ` · ${floorSimilarity.reason}`;
      }

      if (dealType.includes("직거래")) {
        similarityScore -= 8;
        similarityReason += " · 직거래 감점";
      }

      if ((params.allowedMonths ?? 12) > 12) {
        similarityScore -= 4;
        similarityReason += ` · 기간확장(${params.allowedMonths}개월)`;
      }

      if ((params.areaToleranceM2 ?? 3) > 3) {
        similarityScore -= 4;
        similarityReason += ` · 면적확장(±${params.areaToleranceM2}㎡)`;
      }

      similarityScore = Math.max(0, Math.min(100, similarityScore));

      const transactionKey = [
        dealAmount,
        dealYear,
        dealMonth,
        dealDay,
        area,
        floor,
        aptNm
      ].join("|");

      if (seenTransactionKeys.has(transactionKey)) continue;
      seenTransactionKeys.add(transactionKey);

      let reliabilityGrade: "A" | "B" | "C" = "C";

      if (similarityScore >= 85) reliabilityGrade = "A";
      else if (similarityScore >= 65) reliabilityGrade = "B";

      transactions.push({
        dealAmount,
        dealYear,
        dealMonth,
        dealDay,
        area,
        floor,
        buildYear,
        isSameApartment,
        areaDifferenceM2,
        monthsAgo,
        distanceMeters,
        similarityScore,
        similarityReason,
        reliabilityGrade,
        selectionReason: isSameApartment
          ? `동일 단지 거래 · ${params.fallbackLabel}`
          : distanceMeters !== undefined
            ? distanceMeters <= 500
              ? `반경 500m 유사 거래 · ${params.fallbackLabel}`
              : distanceMeters <= 1000
                ? `반경 1km 유사 거래 · ${params.fallbackLabel}`
                : `법정동 fallback 거래 · ${params.fallbackLabel}`
            : `법정동 fallback 거래 · ${params.fallbackLabel}`
      });
    }

    return transactions;
  } catch (error) {
    console.error("fetchApartmentTradeApi_error", error);
    return [];
  }
}

export async function fetchPublicTransactions(
  params: FetchParams
): Promise<TransactionItem[]> {
  console.log("valuation_region_json", JSON.stringify(params.region));
  console.log("valuation_legalDongCode", params.legalDongCode ?? "undefined");

  const seenGlobalKeys = new Set<string>();

  for (const rule of FALLBACK_RULES) {
    const recentMonths = getRecentDealYearMonths(rule.monthCount);
    const apiTransactions: TransactionItem[] = [];

    for (const dealYearMonth of recentMonths) {
      const monthlyTransactions = await fetchApartmentTradeApi({
        legalDongCode: params.legalDongCode,
        dealYearMonth,
        buildingName: params.buildingName,
        exclusiveAreaM2: params.exclusiveAreaM2,
        areaToleranceM2: rule.areaToleranceM2,
        allowedMonths: rule.monthCount,
        targetFloor: params.targetFloor,
        targetCoordinate: params.targetCoordinate,
        region: params.region,
        fallbackLabel: rule.label
      });

      for (const tx of monthlyTransactions) {
        const key = [
          tx.dealAmount,
          tx.dealYear,
          tx.dealMonth,
          tx.dealDay,
          tx.area,
          tx.floor,
          tx.selectionReason
        ].join("|");

        if (seenGlobalKeys.has(key)) continue;
        seenGlobalKeys.add(key);
        apiTransactions.push(tx);
      }

      const sameApartmentCount = apiTransactions.filter(
        (tx) => tx.isSameApartment
      ).length;

      if (
        sameApartmentCount >= rule.minimumComparableCount ||
        apiTransactions.length >= 5
      ) {
        break;
      }
    }

    if (apiTransactions.length >= rule.minimumComparableCount) {
      return apiTransactions.sort(transactionSort).slice(0, 5);
    }

    if (rule === FALLBACK_RULES[FALLBACK_RULES.length - 1] && apiTransactions.length > 0) {
      return apiTransactions.sort(transactionSort).slice(0, 5);
    }
  }

  return [];
}
