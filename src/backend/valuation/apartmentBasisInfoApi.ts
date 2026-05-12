//*기본정보+상세정보 조화 함수 준비 파일*//
export interface ApartmentBasisInfo {
  kaptCode?: string;
  kaptName?: string;
  kaptAddr?: string;
  doroJuso?: string;
  bjdCode?: string;

  householdCount?: number;
  usedate?: string;
  buildYear?: number;

  dongCount?: number;
  topFloor?: number;
  baseFloor?: number;

  totalArea?: number;
  privateArea?: number;
}

export interface ApartmentDetailInfo {
  kaptCode?: string;
  kaptName?: string;

  subwayLine?: string;
  subwayStation?: string;
  subwayWalkingTimeText?: string;
  subwayWalkingMinutes?: number;

  parkingCount?: number;
  parkingCountUnderground?: number;
  elevatorCount?: number;

  welfareFacility?: string;
  educationFacility?: string;
  convenientFacility?: string;
}

export interface ApartmentMetaInfo {
  basis?: ApartmentBasisInfo;
  detail?: ApartmentDetailInfo;
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(String(value).replace(/[^0-9.]/g, ""));

  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractBuildYear(value?: string): number | undefined {
  if (!value) return undefined;

  const match = value.match(/(\d{4})/);
  const year = match ? Number(match[1]) : undefined;

  if (!year || year < 1900 || year > new Date().getFullYear() + 1) {
    return undefined;
  }

  return year;
}

function parseWalkingMinutes(value?: string): number | undefined {
  if (!value) return undefined;

  const match = value.match(/(\d+)/);
  const minutes = match ? Number(match[1]) : undefined;

  return Number.isFinite(minutes) ? minutes : undefined;
}

async function requestPublicDataItem<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<T | undefined> {
  try {
    const apiKey = process.env.PUBLIC_DATA_API_KEY;

    if (!apiKey) {
      console.warn("PUBLIC_DATA_API_KEY is missing.");
      return undefined;
    }

    const url = new URL(endpoint);

    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("_type", "json");

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      console.warn("apartment_basis_api_failed", response.status);
      return undefined;
    }

const json = await response.json();

const body = json?.response?.body ?? json?.body;
const item =
  body?.item ??
  body?.items?.item ??
  body?.items;

if (!item) {
  console.log("apartment_item_empty_response", {
    endpoint,
    params,
    resultCode:
      json?.response?.header?.resultCode ??
      json?.header?.resultCode,
    resultMsg:
      json?.response?.header?.resultMsg ??
      json?.header?.resultMsg,
    bodyKeys: Object.keys(body ?? {}),
    sampleBody: JSON.stringify(body ?? {}).slice(0, 500)
  });

  return undefined;
}

return Array.isArray(item) ? (item[0] as T) : (item as T);
  } catch (error) {
    console.error("requestPublicDataItem_error", error);
    return undefined;
  }
}

/**
 * 공동주택 기본 정보조회
 *
 * endpoint 예:
 * https://apis.data.go.kr/1611000/AptBasisInfoService/getAphusBassInfo
 */
export async function fetchApartmentBasisInfo(
  kaptCode: string
): Promise<ApartmentBasisInfo | undefined> {
  const item = await requestPublicDataItem<Record<string, unknown>>(
    "https://apis.data.go.kr/1611000/AptBasisInfoService/getAphusBassInfo",
    {
      kaptCode
    }
  );

  if (!item) return undefined;

  const usedate = String(item.kaptUsedate ?? "") || undefined;

  return {
    kaptCode: String(item.kaptCode ?? "") || undefined,
    kaptName: String(item.kaptName ?? "") || undefined,
    kaptAddr: String(item.kaptAddr ?? "") || undefined,
    doroJuso: String(item.doroJuso ?? "") || undefined,
    bjdCode: String(item.bjdCode ?? "") || undefined,

    householdCount: toNumber(item.kaptdaCnt),
    usedate,
    buildYear: extractBuildYear(usedate),

    dongCount: toNumber(item.kaptDongCnt),
    topFloor: toNumber(item.kaptTopFloor),
    baseFloor: toNumber(item.kaptBaseFloor),

    totalArea: toNumber(item.kaptTarea),
    privateArea: toNumber(item.privArea)
  };
}

/**
 * 공동주택 상세 정보조회
 *
 * endpoint 예:
 * https://apis.data.go.kr/1611000/AptBasisInfoService/getAphusDtlInfo
 */
export async function fetchApartmentDetailInfo(
  kaptCode: string
): Promise<ApartmentDetailInfo | undefined> {
  const item = await requestPublicDataItem<Record<string, unknown>>(
    "https://apis.data.go.kr/1611000/AptBasisInfoService/getAphusDtlInfo",
    {
      kaptCode
    }
  );

  if (!item) return undefined;

  const subwayWalkingTimeText =
    String(item.kaptdWtimesub ?? "") || undefined;

  return {
    kaptCode: String(item.kaptCode ?? "") || undefined,
    kaptName: String(item.kaptName ?? "") || undefined,

    subwayLine: String(item.subwayLine ?? "") || undefined,
    subwayStation: String(item.subwayStation ?? "") || undefined,
    subwayWalkingTimeText,
    subwayWalkingMinutes: parseWalkingMinutes(subwayWalkingTimeText),

    parkingCount: toNumber(item.kaptdPcnt),
    parkingCountUnderground: toNumber(item.kaptdPcntu),
    elevatorCount: toNumber(item.kaptdEcnt),

    welfareFacility: String(item.welfareFacility ?? "") || undefined,
    educationFacility: String(item.educationFacility ?? "") || undefined,
    convenientFacility: String(item.convenientFacility ?? "") || undefined
  };
}

export async function fetchApartmentMetaInfo(
  kaptCode?: string
): Promise<ApartmentMetaInfo | undefined> {
  if (!kaptCode) return undefined;

  const [basis, detail] = await Promise.all([
    fetchApartmentBasisInfo(kaptCode),
    fetchApartmentDetailInfo(kaptCode)
  ]);

  if (!basis && !detail) return undefined;

  return {
    basis,
    detail
  };
}

export interface ApartmentListItem {
  kaptCode?: string;
  kaptName?: string;
  kaptAddr?: string;
  doroJuso?: string;
  bjdCode?: string;
}

function normalizeName(value?: string) {
  return value
    ?.replace(/\s+/g, "")
    .replace(/[()]/g, "")
    .trim()
    ?? "";
}

function calculateNameSimilarity(target?: string, candidate?: string) {
  const targetName = normalizeName(target);
  const candidateName = normalizeName(candidate);

  if (!targetName || !candidateName) return 0;

  if (targetName === candidateName) return 100;

  if (
    targetName.includes(candidateName) ||
    candidateName.includes(targetName)
  ) {
    return 85;
  }

  let score = 0;

  for (const char of targetName) {
    if (candidateName.includes(char)) {
      score += 1;
    }
  }

  return Math.round((score / targetName.length) * 70);
}

function normalizeItems<T>(item: T | T[] | undefined): T[] {
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

async function requestPublicDataItems<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<T[]> {
  try {
    const apiKey = process.env.PUBLIC_DATA_API_KEY;

    if (!apiKey) {
      console.warn("PUBLIC_DATA_API_KEY is missing.");
      return [];
    }

    const url = new URL(endpoint);

    url.searchParams.set("serviceKey", apiKey);
    url.searchParams.set("_type", "json");

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      console.warn("apartment_list_api_failed", response.status);
      return [];
    }

const json = await response.json();

console.log("apartment_list_raw_response", {
  endpoint,
  params,
  resultCode:
    json?.response?.header?.resultCode ??
    json?.header?.resultCode,
  resultMsg:
    json?.response?.header?.resultMsg ??
    json?.header?.resultMsg,
  bodyKeys: Object.keys(json?.response?.body ?? json?.body ?? {}),
  sampleBody: JSON.stringify(json?.response?.body ?? json?.body ?? {}).slice(
    0,
    500
  )
});

const body = json?.response?.body ?? json?.body;
const item =
  body?.items?.item ??
  body?.item ??
  body?.items;

return normalizeItems<T>(item);
  } catch (error) {
    console.error("requestPublicDataItems_error", error);
    return [];
  }
}

/**
 * 법정동 기준 공동주택 목록 조회
 *
 * endpoint 예:
 * https://apis.data.go.kr/1611000/AptBasisInfoService/getLegaldongAptList3
 */
export async function fetchLegalDongApartmentList(params: {
  legalDongCode?: string;
}): Promise<ApartmentListItem[]> {
  if (!params.legalDongCode) return [];

  const items = await requestPublicDataItems<Record<string, unknown>>(
    "https://apis.data.go.kr/1611000/AptBasisInfoService/getLegaldongAptList3",
    {
      bjdCode: params.legalDongCode
    }
  );

  return items.map((item) => ({
    kaptCode: String(item.kaptCode ?? "") || undefined,
    kaptName: String(item.kaptName ?? "") || undefined,
    kaptAddr: String(item.kaptAddr ?? "") || undefined,
    doroJuso: String(item.doroJuso ?? "") || undefined,
    bjdCode: String(item.bjdCode ?? "") || undefined
  }));
}

export async function findApartmentKaptCode(params: {
  legalDongCode?: string;
  buildingName?: string;
}): Promise<string | undefined> {
  const candidates = await fetchLegalDongApartmentList({
    legalDongCode: params.legalDongCode
  });

  if (!candidates.length) return undefined;

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: calculateNameSimilarity(
        params.buildingName,
        candidate.kaptName
      )
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  if (!best || best.score < 60) {
    return undefined;
  }

  return best.candidate.kaptCode;
}

export async function fetchApartmentMetaInfoByLegalDong(params: {
  legalDongCode?: string;
  buildingName?: string;
}): Promise<ApartmentMetaInfo | undefined> {
  const kaptCode = await findApartmentKaptCode({
    legalDongCode: params.legalDongCode,
    buildingName: params.buildingName
  });

  if (!kaptCode) return undefined;

  return fetchApartmentMetaInfo(kaptCode);
}

export async function findApartmentKaptCodeInLegalDong(params: {
  legalDongCode?: string;
  apartmentName?: string;
}): Promise<string | undefined> {
  const candidates = await fetchLegalDongApartmentList({
    legalDongCode: params.legalDongCode
  });

  console.log("kapt_lookup_input", {
    legalDongCode: params.legalDongCode,
    apartmentName: params.apartmentName,
    candidateCount: candidates.length
  });

  if (!candidates.length) return undefined;

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: calculateNameSimilarity(
        params.apartmentName,
        candidate.kaptName
      )
    }))
    .sort((a, b) => b.score - a.score);

  console.log(
    "kapt_lookup_candidates",
    scored.slice(0, 5).map((item) => ({
      score: item.score,
      kaptCode: item.candidate.kaptCode,
      kaptName: item.candidate.kaptName,
      kaptAddr: item.candidate.kaptAddr,
      bjdCode: item.candidate.bjdCode
    }))
  );

  const best = scored[0];

  if (!best || best.score < 60) {
    return undefined;
  }

  return best.candidate.kaptCode;
}
