async function fetchApartmentTradeApi(
  params: PublicTransactionApiParams
): Promise<TransactionItem[]> {
  try {
    if (!params.legalDongCode) {
      return [];
    }

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
