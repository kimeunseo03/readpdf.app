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
      "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"
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

    console.log("public_transaction_api_response_preview", xml.slice(0, 300));

    return [];
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

  const baseArea = params.exclusiveAreaM2 ?? 84;

  const apiTransactions = await fetchApartmentTradeApi({
    legalDongCode: params.legalDongCode,
    dealYearMonth: "202603",
    buildingName: params.buildingName,
    exclusiveAreaM2: params.exclusiveAreaM2
  });

  if (apiTransactions.length > 0) {
    return apiTransactions;
  }

  return [
    {
      dealAmount: 51000,
      dealYear: 2026,
      dealMonth: 3,
      dealDay: 12,
      area: baseArea,
      floor: 15
    },
    {
      dealAmount: 53000,
      dealYear: 2026,
      dealMonth: 2,
      dealDay: 2,
      area: baseArea,
      floor: 18
    },
    {
      dealAmount: 52000,
      dealYear: 2026,
      dealMonth: 1,
      dealDay: 21,
      area: baseArea,
      floor: 11
    }
  ];
}
