import type {
  PublicTransactionApiParams,
  TransactionItem
} from "./types";

import type { ExtractedRegion } from "./extractRegion";

interface FetchParams {
  buildingName?: string;
  exclusiveAreaM2?: number;
  region?: ExtractedRegion;
  legalDongCode?: string;
}

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

async function fetchApartmentTradeApi(
  params: PublicTransactionApiParams
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

      const floor = Number(
        itemXml.match(/<floor>(.*?)<\/floor>/)?.[1] ?? 0
      );

      const buildYear = Number(
        itemXml.match(/<buildYear>(.*?)<\/buildYear>/)?.[1] ?? 0
      );

      if (!dealAmount || !area) continue;

      const isSimilarArea =
        !params.exclusiveAreaM2 ||
        Math.abs(area - params.exclusiveAreaM2) <= 3;

      if (!isSimilarArea) continue;

      const normalizedApiName = aptNm.replace(/\s/g, "");
      const normalizedTargetName =
        params.buildingName?.replace(/\s/g, "") ?? "";

      const isSameApartment =
        normalizedTargetName.length > 0 &&
        (
          normalizedApiName.includes(normalizedTargetName) ||
          normalizedTargetName.includes(normalizedApiName)
        );

     const areaDifferenceM2 = params.exclusiveAreaM2
      ? Math.abs(area - params.exclusiveAreaM2)
      : undefined;
    
    let similarityScore = 35;
    let similarityReason = "동일 법정동 유사 면적";
    
    if (isSameApartment) {
      similarityScore += 45;
      similarityReason = "동일 단지";
    }
    
    if (areaDifferenceM2 !== undefined) {
      if (areaDifferenceM2 <= 1) {
        similarityScore += 15;
      } else if (areaDifferenceM2 <= 2) {
        similarityScore += 8;
      } else {
        similarityScore += 3;
      }
    }
    
    const now = new Date();
    const dealDate = new Date(dealYear, dealMonth - 1, dealDay);
    const monthsAgo =
      (now.getFullYear() - dealDate.getFullYear()) * 12 +
      (now.getMonth() - dealDate.getMonth());
    
    if (monthsAgo <= 3) {
      similarityScore += 15;
    } else if (monthsAgo <= 6) {
      similarityScore += 8;
    } else if (monthsAgo <= 12) {
      similarityScore += 3;
    }
    
    if (floor >= 10) {
      similarityScore += 8;
    } else if (floor >= 6) {
      similarityScore += 4;
    } else if (floor <= 2) {
      similarityScore -= 8;
    }
    
    if (buildYear > 0) {
      const currentYear = new Date().getFullYear();
      const buildingAge = currentYear - buildYear;
    
      if (buildingAge <= 10) {
        similarityScore += 10;
      } else if (buildingAge <= 20) {
        similarityScore += 5;
      } else if (buildingAge >= 30) {
        similarityScore -= 5;
      }
    }
    
    similarityScore = Math.max(0, Math.min(100, similarityScore));
      
      const transactionKey = [
        dealAmount,
        dealYear,
        dealMonth,
        dealDay,
        area,
        floor
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
        similarityScore,
        similarityReason,
        reliabilityGrade
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
  const apiTransactions: TransactionItem[] = [];

  for (const dealYearMonth of recentMonths) {
    const monthlyTransactions = await fetchApartmentTradeApi({
      legalDongCode: params.legalDongCode,
      dealYearMonth,
      buildingName: params.buildingName,
      exclusiveAreaM2: params.exclusiveAreaM2
    });

    apiTransactions.push(...monthlyTransactions);

    if (apiTransactions.length >= 5) break;
  }

  if (apiTransactions.length > 0) {
  return apiTransactions
    .sort((a, b) => {
      const scoreA = a.similarityScore ?? 0;
      const scoreB = b.similarityScore ?? 0;

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      const gradeRank = {
        A: 3,
        B: 2,
        C: 1
      };

      const gradeA = a.reliabilityGrade
        ? gradeRank[a.reliabilityGrade]
        : 0;

      const gradeB = b.reliabilityGrade
        ? gradeRank[b.reliabilityGrade]
        : 0;

      if (gradeB !== gradeA) {
        return gradeB - gradeA;
      }

      const dateA = a.dealYear * 10000 + a.dealMonth * 100 + a.dealDay;
      const dateB = b.dealYear * 10000 + b.dealMonth * 100 + b.dealDay;

      return dateB - dateA;
    })
    .slice(0, 5);
}

  return [];
}
