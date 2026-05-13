export interface KakaoAddressResult {
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
  jibunAddress?: string;
  roadAddress?: string;
  buildingName?: string;
  legalDongCode?: string;  // 카카오 b_code (법정동코드 10자리)
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
      console.warn("kakao_address_search_failed", {
        status: response.status,
        body: await response.text(),
      });
      return undefined;
    }

    const json = await response.json();
    const document = json?.documents?.[0];
    if (!document) return undefined;

    const address = document.address;
    const roadAddress = document.road_address;

    return {
      sido: address?.region_1depth_name,
      sigungu: address?.region_2depth_name,
      eupmyeondong: address?.region_3depth_name,
      jibunAddress: address?.address_name,
      roadAddress: roadAddress?.address_name,
      buildingName: roadAddress?.building_name,
      legalDongCode: address?.b_code,  // 법정동코드 10자리
      longitude: document.x ? Number(document.x) : undefined,
      latitude: document.y ? Number(document.y) : undefined,
    };
  } catch (error) {
    console.error("searchAddressByKakao_error", error);
    return undefined;
  }
}
