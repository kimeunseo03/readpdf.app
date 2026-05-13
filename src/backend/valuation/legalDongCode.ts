import type { ExtractedRegion } from "./extractRegion";
import { searchAddressByKakao } from "./addressSearchApi";

// ─── 카카오 주소검색으로 법정동코드 조회 (1순위) ─────────────────────────────
async function fetchLegalDongCodeFromKakao(
  addressRaw: string
): Promise<string | undefined> {
  try {
    const result = await searchAddressByKakao(addressRaw);
    if (!result?.legalDongCode) return undefined;
    console.log("legal_dong_kakao_found", {
      addressRaw,
      code: result.legalDongCode,
    });
    return result.legalDongCode;
  } catch (e) {
    console.warn("legal_dong_kakao_error", e);
    return undefined;
  }
}

// ─── 행정안전부 법정동코드 API (2순위) ───────────────────────────────────────
async function fetchLegalDongCodeFromApi(
  region: ExtractedRegion
): Promise<string | undefined> {
  try {
    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    if (!apiKey) {
      console.warn("legal_dong_api_no_key");
      return undefined;
    }
    const sido = region.sido ?? "";
    const sigungu = region.sigungu ?? "";
    const eupmyeondong = region.eupmyeondong ?? "";
    if (!eupmyeondong) return undefined;

    const fullAddr = `${sido} ${sigungu} ${eupmyeondong}`.trim();
    console.log("legal_dong_api_requesting", { fullAddr });

    const url = new URL("https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList");
    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("type", "json");
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "10");
    url.searchParams.set("flag", "Y");
    url.searchParams.set("locatadd_nm", fullAddr);

    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.warn("legal_dong_api_http_error", { status: res.status });
      return undefined;
    }

    const json = await res.json();
    const rows: Record<string, string>[] = json?.StanReginCd?.[1]?.row ?? [];
    if (!rows.length) {
      console.warn("legal_dong_api_no_rows", { fullAddr });
      return undefined;
    }

    const dongRow = rows.find(
      (r) => r.umd_cd && r.umd_cd !== "000" && r.ri_cd === "00"
    ) ?? rows[0];

    const code = dongRow?.region_cd ?? "";
    if (!code) return undefined;

    console.log("legal_dong_api_found", {
      fullAddr,
      matched: dongRow?.locatadd_nm,
      code,
    });
    return code;
  } catch (e) {
    console.warn("legal_dong_api_error", e);
    return undefined;
  }
}

// ─── public: 카카오 → 행정안전부 API 순으로 시도 ─────────────────────────────
export async function findLegalDongCode(
  region?: ExtractedRegion,
  addressRaw?: string
): Promise<string | undefined> {

  // 1. 카카오 주소검색 (addressRaw 있을 때)
  if (addressRaw?.trim()) {
    const kakaoCode = await fetchLegalDongCodeFromKakao(addressRaw);
    if (kakaoCode) return kakaoCode;
  }

  // 2. 행정안전부 API (region 파싱값으로 시도)
  if (region?.sido && region?.sigungu && region?.eupmyeondong) {
    const apiCode = await fetchLegalDongCodeFromApi(region);
    if (apiCode) return apiCode;
  }

  console.warn("legal_dong_code_not_found", { addressRaw, region });
  return undefined;
}

export function getLegalDongCodeKey(region: {
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
}) {
  if (!region.sido || !region.sigungu || !region.eupmyeondong) return undefined;
  return `${region.sido} ${region.sigungu} ${region.eupmyeondong}`;
}
