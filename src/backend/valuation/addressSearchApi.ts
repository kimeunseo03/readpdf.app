export interface KakaoAddressResult {
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
  jibunAddress?: string;
  roadAddress?: string;
  buildingName?: string;
  legalDongCode?: string;
  longitude?: number;
  latitude?: number;
}

export async function searchAddressByKakao(
  rawAddress?: string
): Promise<KakaoAddressResult | undefined> {
  try {
    if (!rawAddress?.trim()) return undefined;
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) {
      console.warn("KAKAO_REST_API_KEY is missing.");
      return undefined;
    }

    const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
    url.searchParams.set("query", rawAddress);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `KakaoAK ${apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("kakao_address_search_failed", { status: response.status });
      return undefined;
    }

    const json = await response.json();
    const doc = json?.documents?.[0];
    if (!doc) {
      console.warn("kakao_address_no_result", { rawAddress });
      return undefined;
    }

    const address = doc.address;
    const roadAddress = doc.road_address;

    // b_code는 법정동코드, zone_no는 우편번호라 법정동코드로 사용하지 않음.
    const legalDongCode = address?.b_code ?? undefined;

    console.log("kakao_address_result", {
      rawAddress,
      legalDongCode,
      sido: address?.region_1depth_name,
      sigungu: address?.region_2depth_name,
      eupmyeondong: address?.region_3depth_name,
      roadAddress: roadAddress?.address_name,
      zoneNo: roadAddress?.zone_no,
    });

    return {
      sido: address?.region_1depth_name ?? roadAddress?.region_1depth_name,
      sigungu: address?.region_2depth_name ?? roadAddress?.region_2depth_name,
      eupmyeondong: address?.region_3depth_name ?? roadAddress?.region_3depth_name,
      jibunAddress: address?.address_name,
      roadAddress: roadAddress?.address_name,
      buildingName: roadAddress?.building_name,
      legalDongCode,
      longitude: doc.x ? Number(doc.x) : undefined,
      latitude: doc.y ? Number(doc.y) : undefined,
    };
  } catch (error) {
    console.error("searchAddressByKakao_error", error);
    return undefined;
  }
}
