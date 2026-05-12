import type { PublicTransactionApiParams, TransactionItem } from "./types";
import type { ExtractedRegion } from "./extractRegion";
import { geocodeAddress } from "./geocodeApi";
import { calculateDistanceMeters } from "./distance";
import {
  findApartmentKaptCodeInLegalDong,
  fetchApartmentBasisInfo,
  fetchApartmentDetailInfo
} from "./apartmentBasisInfoApi";

interface FetchParams {
  buildingName?: string;
  exclusiveAreaM2?: number;
  region?: ExtractedRegion;
  legalDongCode?: string;
  targetFloor?: number;
  targetSubwayWalkMinutes?: number;
  targetCoordinate?: {
    latitude: number;
    longitude: number;
  };
  targetBuildYear?: number;
  targetHouseholdCount?: number;
  targetKaptCode?: string;
}

type ApartmentTradeApiParams = PublicTransactionApiParams & {
  region?: ExtractedRegion;
};

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

function getBuildYearSimilarityScore(params: {
  targetBuildYear?: number;
  transactionBuildYear?: number;
}) {
  const { targetBuildYear, transactionBuildYear } = params;

  if (!targetBuildYear || !transactionBuildYear) {
    return {
      score: 0,
      reason: undefined as string | undefined
    };
  }

  const difference = Math.abs(targetBuildYear - transactionBuildYear);

  if (difference <= 3) {
    return {
      score: 12,
      reason: "준공연도 유사(±3년)"
    };
  }

  if (difference <= 5) {
    return {
      score: 8,
      reason: "준공연도 유사(±5년)"
    };
  }

  if (difference <= 10) {
    return {
      score: 3,
      reason: `준공연도 차이 ${difference}년`
    };
  }

  return {
    score: -10,
    reason: `준공연도 차이 큼(${difference}년)`
  };
}

function getHouseholdScaleScore(params: {
  targetHouseholdCount?: number;
  transactionHouseholdCount?: number;
}) {
  const { targetHouseholdCount, transactionHouseholdCount } = params;

  if (!targetHouseholdCount || !transactionHouseholdCount) {
    return {
      score: 0,
      reason: undefined as string | undefined
    };
  }

  const ratio =
    Math.abs(targetHouseholdCount - transactionHouseholdCount) /
    targetHouseholdCount;

  if (ratio <= 0.2) {
    return {
      score: 8,
      reason: "세대수 규모 유사"
    };
  }

  if (ratio <= 0.5) {
    return {
      score: 3,
      reason: "세대수 규모 일부 유사"
    };
  }

  return {
    score: -6,
    reason: "세대수 규모 차이 큼"
  };
}

function getSubwayAccessibilityScore(params: {
  targetWalkMinutes?: number;
  transactionWalkMinutes?: number;
}) {
  const { targetWalkMinutes, transactionWalkMinutes } = params;

  if (
    targetWalkMinutes === undefined ||
    transactionWalkMinutes === undefined
  ) {
    return {
      score: 0,
      reason: undefined as string | undefined
    };
  }

  const difference = Math.abs(targetWalkMinutes - transactionWalkMinutes);

  if (difference <= 3) {
    return {
      score: 8,
      reason: "역세권 접근성 유사"
    };
  }

  if (difference <= 7) {
    return {
      score: 3,
      reason: "역 접근성 일부 유사"
    };
  }

  return {
    score: -6,
    reason: "역세권 차이 큼"
  };
}

function applyGeneralBuildYearScore(params: {
  buildYear?: number;
  similarityScore: number;
  similarityReason: string;
}) {
  const { buildYear } = params;
  let { similarityScore, similarityReason } = params;

  if ((buildYear ?? 0) > 0) {
    const currentYear = new Date().getFullYear();
    const buildingAge = currentYear - (buildYear ?? 0);

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

  return {
    similarityScore,
    similarityReason
  };
}

async function fetchApartmentTradeApi(
  params: ApartmentTradeApiParams
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
        areaDifferenceM2 === undefined ||
        areaDifferenceM2 <= areaToleranceM2;

      if (!isSimilarArea) continue;

      const normalizedApiName = normalizeApartmentName(aptNm);
      const normalizedTargetName = normalizeApartmentName(params.buildingName);
      
      const transactionKaptCode = await findApartmentKaptCodeInLegalDong({
        legalDongCode: params.legalDongCode,
        apartmentName: aptNm
      });

      const transactionBasisInfo = transactionKaptCode
        ? await fetchApartmentBasisInfo(transactionKaptCode)
        : undefined;
      
      const transactionDetailInfo = transactionKaptCode
        ? await fetchApartmentDetailInfo(transactionKaptCode)
        : undefined;
            
      const transactionWalkMinutes =
        transactionDetailInfo?.subwayWalkingMinutes;
            
      const isSameApartmentByKaptCode =
        !!params.targetKaptCode &&
        !!transactionKaptCode &&
        params.targetKaptCode === transactionKaptCode;
      
      const isSameApartmentByName =
        normalizedTargetName.length > 0 &&
        (normalizedApiName.includes(normalizedTargetName) ||
    normalizedTargetName.includes(normalizedApiName));

const isSameApartment = isSameApartmentByKaptCode || isSameApartmentByName;

      const monthsAgo = getMonthsAgo(dealYear, dealMonth, dealDay);

      if (monthsAgo > 12) continue;

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
        similarityReason = isSameApartmentByKaptCode
          ? "동일 단지(kaptCode 일치)"
          : "동일 단지(단지명 일치)";
      }

      if (areaDifferenceM2 !== undefined) {
        if (areaDifferenceM2 <= 1) {
          similarityScore += 15;
          similarityReason += " · 면적 차이 1㎡ 이하";
        } else if (areaDifferenceM2 <= 2) {
          similarityScore += 8;
          similarityReason += " · 면적 차이 2㎡ 이하";
        } else {
          similarityScore += 3;
          similarityReason += ` · 면적 차이 ${areaDifferenceM2.toFixed(2)}㎡`;
        }
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
          similarityReason += " · fallback 비교";
        }
      }

      const floorSimilarity = getFloorSimilarityScore({
        targetFloor: params.targetFloor,
        transactionFloor: floor
      });

      similarityScore += floorSimilarity.score;
      similarityScore += getFloorPenalty(floor);

      if (floorSimilarity.reason) {
        similarityReason += ` · ${floorSimilarity.reason}`;
      }

      const buildYearSimilarity = getBuildYearSimilarityScore({
        targetBuildYear: params.targetBuildYear,
        transactionBuildYear: buildYear
      });

      if (buildYearSimilarity.reason) {
        similarityScore += buildYearSimilarity.score;
        similarityReason += ` · ${buildYearSimilarity.reason}`;
      } else {
        const generalBuildYear = applyGeneralBuildYearScore({
          buildYear,
          similarityScore,
          similarityReason
        });

        similarityScore = generalBuildYear.similarityScore;
        similarityReason = generalBuildYear.similarityReason;
      }

      const householdScale = getHouseholdScaleScore({
        targetHouseholdCount: params.targetHouseholdCount,
        transactionHouseholdCount: transactionBasisInfo?.householdCount
      });

      if (householdScale.reason) {
        similarityScore += householdScale.score;
        similarityReason += ` · ${householdScale.reason}`;
      }

      const subwayAccessibility = getSubwayAccessibilityScore({
        targetWalkMinutes: params.targetSubwayWalkMinutes,
        transactionWalkMinutes
      });
      
      if (subwayAccessibility.reason) {
        similarityScore += subwayAccessibility.score;
        similarityReason += ` · ${subwayAccessibility.reason}`;
      }

      if (dealType.includes("직거래")) {
        similarityScore -= 8;
        similarityReason += " · 직거래 감점";
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

      if (similarityScore >= 85) {
        reliabilityGrade = "A";
      } else if (similarityScore >= 65) {
        reliabilityGrade = "B";
      }

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
          ? "동일 단지 거래"
          : distanceMeters !== undefined
            ? distanceMeters <= 500
              ? `반경 500m 유사 거래(±${areaToleranceM2}㎡)`
              : distanceMeters <= 1000
                ? `반경 1km 유사 거래(±${areaToleranceM2}㎡)`
                : `법정동 fallback 거래(±${areaToleranceM2}㎡)`
            : `법정동 fallback 거래(±${areaToleranceM2}㎡)`
      });
    }

    console.log("filtered_transaction_count", transactions.length);

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

  const recentMonths = getRecentDealYearMonths(12);
  const areaTolerances = [3, 5];

  for (const areaToleranceM2 of areaTolerances) {
    const apiTransactions: TransactionItem[] = [];

    for (const dealYearMonth of recentMonths) {
      const monthlyTransactions = await fetchApartmentTradeApi({
        legalDongCode: params.legalDongCode,
        dealYearMonth,
        buildingName: params.buildingName,
        exclusiveAreaM2: params.exclusiveAreaM2,
        areaToleranceM2,
        targetFloor: params.targetFloor,
        targetCoordinate: params.targetCoordinate,
        targetBuildYear: params.targetBuildYear,
        targetHouseholdCount: params.targetHouseholdCount,
        targetSubwayWalkMinutes: params.targetSubwayWalkMinutes,
        targetKaptCode: params.targetKaptCode,
        region: params.region
      });

      apiTransactions.push(...monthlyTransactions);

      const sameApartmentCount = apiTransactions.filter(
        (tx) => tx.isSameApartment
      ).length;

      if (sameApartmentCount >= 3 || apiTransactions.length >= 5) {
        break;
      }
    }

    if (apiTransactions.length > 0) {
      return apiTransactions
        .sort((a, b) => {
          const sameA = a.isSameApartment ? 1 : 0;
          const sameB = b.isSameApartment ? 1 : 0;

          if (sameB !== sameA) {
            return sameB - sameA;
          }

          const tierPriority = (tx: TransactionItem) => {
            if (tx.isSameApartment) return 0;

            if ((tx.distanceMeters ?? 999999) <= 500) {
              return 1;
            }

            if ((tx.distanceMeters ?? 999999) <= 1000) {
              return 2;
            }

            return 3;
          };

          const tierA = tierPriority(a);
          const tierB = tierPriority(b);

          if (tierA !== tierB) {
            return tierA - tierB;
          }

          const scoreA = a.similarityScore ?? 0;
          const scoreB = b.similarityScore ?? 0;

          if (scoreB !== scoreA) {
            return scoreB - scoreA;
          }

          const dateA = a.dealYear * 10000 + a.dealMonth * 100 + a.dealDay;
          const dateB = b.dealYear * 10000 + b.dealMonth * 100 + b.dealDay;

          return dateB - dateA;
        })
        .slice(0, 5);
    }
  }

  return [];
}
