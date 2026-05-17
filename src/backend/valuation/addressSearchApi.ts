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

async function searchLegalDongByCoordinate(params: {
  longitude?: number;
  latitude?: number;
  apiKey: string;
}): Promise<Partial<KakaoAddressResult> | undefined> {
  try {
    if (!params.longitude || !params.latitude) return undefined;

    const url = new URL("https://dapi.kakao.com/v2/local/geo/coord2regioncode.json");
    url.searchParams.set("x", String(params.longitude));
    url.searchParams.set("y", String(params.latitude));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `KakaoAK ${params.apiKey}` },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("kakao_coord_region_failed", { status: response.status });
      return undefined;
    }

    const json = await response.json();
    const legalDong = json?.documents?.find((doc: any) => doc?.region_type === "B") ?? json?.documents?.[0];
    if (!legalDong?.code) return undefined;

    return {
      sido: legalDong.region_1depth_name,
      sigungu: legalDong.region_2depth_name,
      eupmyeondong: legalDong.region_3depth_name,
      legalDongCode: legalDong.code,
    };
  } catch (error) {
    console.error("searchLegalDongByCoordinate_error", error);
    return undefined;
  }
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
    const longitude = doc.x ? Number(doc.x) : undefined;
    const latitude = doc.y ? Number(doc.y) : undefined;
    const coordinateRegion = !address?.b_code
      ? await searchLegalDongByCoordinate({ longitude, latitude, apiKey })
      : undefined;

    // b_code는 법정동코드, zone_no는 우편번호라 법정동코드로 사용하지 않음.
    // 도로명 검색에서 address.b_code가 없으면 좌표→법정동 역조회로 보완.
    const legalDongCode = address?.b_code ?? coordinateRegion?.legalDongCode;

    console.log("kakao_address_result", {
      rawAddress,
      legalDongCode,
      sido: address?.region_1depth_name ?? coordinateRegion?.sido,
      sigungu: address?.region_2depth_name ?? coordinateRegion?.sigungu,
      eupmyeondong: address?.region_3depth_name ?? coordinateRegion?.eupmyeondong,
      roadAddress: roadAddress?.address_name,
      zoneNo: roadAddress?.zone_no,
    });

    return {
      sido: address?.region_1depth_name ?? roadAddress?.region_1depth_name ?? coordinateRegion?.sido,
      sigungu: address?.region_2depth_name ?? roadAddress?.region_2depth_name ?? coordinateRegion?.sigungu,
      eupmyeondong: address?.region_3depth_name ?? roadAddress?.region_3depth_name ?? coordinateRegion?.eupmyeondong,
      jibunAddress: address?.address_name,
      roadAddress: roadAddress?.address_name,
      buildingName: roadAddress?.building_name,
      legalDongCode,
      longitude,
      latitude,
    };
  } catch (error) {
    console.error("searchAddressByKakao_error", error);
    return undefined;
  }
}
