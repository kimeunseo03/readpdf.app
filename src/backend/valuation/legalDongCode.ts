import type { ExtractedRegion } from "./extractRegion";

// ─── 폴백용 하드코딩 ─────────────────────────────────────────────────────────
const LEGAL_DONG_CODES: Record<string, string> = {
  "서울특별시 동대문구 답십리동": "1123010500",
  "경기도 용인시 기흥구 보정동": "4146311800",
  "전라남도 나주시 남평읍": "4617025000",
  "전라남도 순천시 해룡면": "4615031000",
  "서울특별시 강남구 역삼동": "1168010100",
  "서울특별시 강남구 압구정동": "1168010600",
  "서울특별시 강남구 대치동": "1168010700",
  "서울특별시 강남구 개포동": "1168010800",
  "서울특별시 강남구 청담동": "1168010900",
  "서울특별시 강남구 삼성동": "1168011000",
  "서울특별시 강남구 도곡동": "1168011100",
  "서울특별시 강남구 일원동": "1168011500",
  "서울특별시 강남구 수서동": "1168011600",
  "서울특별시 서초구 서초동": "1165010100",
  "서울특별시 서초구 반포동": "1165010200",
  "서울특별시 서초구 잠원동": "1165010300",
  "서울특별시 서초구 방배동": "1165010500",
  "서울특별시 서초구 양재동": "1165010600",
  "서울특별시 송파구 잠실동": "1171010100",
  "서울특별시 송파구 신천동": "1171010200",
  "서울특별시 송파구 풍납동": "1171010300",
  "서울특별시 송파구 방이동": "1171010700",
  "서울특별시 송파구 오금동": "1171010800",
  "서울특별시 송파구 가락동": "1171010900",
  "서울특별시 송파구 문정동": "1171011000",
  "서울특별시 마포구 아현동": "1144010100",
  "서울특별시 마포구 공덕동": "1144010400",
  "서울특별시 마포구 상암동": "1144010900",
  "서울특별시 용산구 이태원동": "1117010400",
  "서울특별시 용산구 한남동": "1117010900",
  "서울특별시 성동구 성수동1가": "1120010100",
  "서울특별시 성동구 성수동2가": "1120010200",
  "서울특별시 성동구 옥수동": "1120011600",
  "서울특별시 성동구 금호동1가": "1120011700",
  "서울특별시 광진구 자양동": "1121510800",
  "서울특별시 광진구 광장동": "1121511100",
  "서울특별시 영등포구 여의도동": "1156010100",
  "서울특별시 영등포구 당산동": "1156010600",
  "서울특별시 동작구 흑석동": "1159010100",
  "서울특별시 동작구 사당동": "1159010500",
  "서울특별시 관악구 봉천동": "1162010100",
  "서울특별시 노원구 상계동": "1135010100",
  "서울특별시 노원구 중계동": "1135010400",
  "서울특별시 노원구 하계동": "1135010500",
  "서울특별시 은평구 불광동": "1138010100",
  "서울특별시 서대문구 홍제동": "1141010100",
  "경기도 성남시 분당구 판교동": "4113511000",
  "경기도 성남시 분당구 정자동": "4113511500",
  "경기도 성남시 분당구 수내동": "4113511800",
  "경기도 성남시 분당구 서현동": "4113512100",
  "경기도 성남시 분당구 야탑동": "4113512400",
  "경기도 성남시 분당구 이매동": "4113512700",
  "경기도 성남시 수정구 신흥동": "4113110100",
  "경기도 수원시 영통구 영통동": "4111166000",
  "경기도 수원시 영통구 망포동": "4111166400",
  "경기도 수원시 팔달구 인계동": "4111453000",
  "경기도 용인시 수지구 풍덕천동": "4146311600",
  "경기도 용인시 수지구 상현동": "4146312800",
  "경기도 용인시 수지구 성복동": "4146313100",
  "경기도 용인시 기흥구 구갈동": "4146311900",
  "경기도 화성시 동탄면": "4159025700",
  "경기도 화성시 반월동": "4159053500",
  "경기도 하남시 미사동": "4145010800",
  "경기도 하남시 감일동": "4145011200",
  "경기도 고양시 일산동구 장항동": "4128110700",
  "경기도 고양시 일산서구 탄현동": "4128210300",
  "경기도 고양시 덕양구 화정동": "4128010400",
  "경기도 남양주시 다산동": "4136013500",
  "경기도 안양시 동안구 평촌동": "4117161000",
  "경기도 안양시 만안구 안양동": "4117110100",
  "경기도 부천시 중동": "4119010300",
  "경기도 김포시 장기동": "4157010900",
  "경기도 광명시 하안동": "4121010500",
  "경기도 시흥시 배곧동": "4137013500",
  "인천광역시 연수구 송도동": "2817710100",
  "인천광역시 연수구 청학동": "2817710200",
  "인천광역시 남동구 구월동": "2818510100",
  "인천광역시 서구 청라동": "2823710300",
  "부산광역시 해운대구 우동": "2635010100",
  "부산광역시 해운대구 중동": "2635010200",
  "부산광역시 해운대구 좌동": "2635010300",
  "부산광역시 수영구 광안동": "2650010200",
  "부산광역시 연제구 거제동": "2644010100",
  "부산광역시 동래구 온천동": "2638010400",
  "대구광역시 수성구 범어동": "2726010100",
  "대구광역시 수성구 만촌동": "2726010400",
  "대구광역시 달서구 죽전동": "2729010100",
  "대전광역시 유성구 봉명동": "3023010100",
  "대전광역시 서구 둔산동": "3017010800",
};

// ─── 행정안전부 법정동코드 API로 조회 ────────────────────────────────────────
async function fetchLegalDongCodeFromApi(
  region: ExtractedRegion
): Promise<string | undefined> {
  try {
    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    if (!apiKey) return undefined;

    const sido = region.sido ?? "";
    const sigungu = region.sigungu ?? "";
    const eupmyeondong = region.eupmyeondong ?? "";
    if (!eupmyeondong) return undefined;

    const fullAddr = `${sido} ${sigungu} ${eupmyeondong}`.trim();

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
    if (!res.ok) return undefined;

    const json = await res.json();
    const rows: Record<string, string>[] = json?.StanReginCd?.[1]?.row ?? [];
    if (!rows.length) return undefined;

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

// ─── 하드코딩 맵 텍스트 매칭 ────────────────────────────────────────────────
function lookupFromText(text: string): string | undefined {
  const sorted = Object.keys(LEGAL_DONG_CODES).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (text.includes(key) || key.split(" ").every((part) => text.includes(part))) {
      return LEGAL_DONG_CODES[key];
    }
  }
  return undefined;
}

// ─── public: 하드코딩 → 행정안전부 API 순으로 시도 ──────────────────────────
export async function findLegalDongCode(
  region?: ExtractedRegion
): Promise<string | undefined> {
  if (!region?.sido || !region?.sigungu || !region?.eupmyeondong) {
    return undefined;
  }

  const key = getLegalDongCodeKey(region);
  if (!key) return undefined;

  // 1. 하드코딩 맵 즉시 반환
  const hardCoded = LEGAL_DONG_CODES[key];
  if (hardCoded) {
    console.log("legal_dong_code_hardcoded", { key, code: hardCoded });
    return hardCoded;
  }

  // 2. 행정안전부 법정동코드 API
  const apiCode = await fetchLegalDongCodeFromApi(region);
  if (apiCode) return apiCode;

  console.warn("legal_dong_code_not_found", { key });
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
