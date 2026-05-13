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

export interface ApartmentListItem {
  kaptCode?: string;
  kaptName?: string;
  kaptAddr?: string;
  doroJuso?: string;
  bjdCode?: string;
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

function normalizeName(value?: string) {
  return (
    value
      ?.replace(/\s+/g, "")
      .replace(/[()]/g, "")
      .replace(/에스-?클래스/g, "s클래스")
      .replace(/S-?클래스/gi, "s클래스")
      .replace(/이편한세상/g, "e편한세상")
      .trim() ?? ""
  );
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

function getApiKey() {
  return process.env.PUBLIC_DATA_API_KEY;
}

function createPublicDataUrl(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  options?: {
    json?: boolean;
  }
) {
  const apiKey = getApiKey();

  if (!apiKey) return undefined;

  const url = new URL(endpoint);

  url.search = options?.json
    ? `?serviceKey=${apiKey}&_type=json`
    : `?serviceKey=${apiKey}`;

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

async function requestPublicDataItem<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<T | undefined> {
  try {
    const url = createPublicDataUrl(endpoint, params, { json: true });

    if (!url) {
      console.warn("PUBLIC_DATA_API_KEY is missing.");
      return undefined;
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();

      console.warn("apartment_item_api_failed", {
        status: response.status,
        url: url.toString(),
        body: body.slice(0, 500)
      });

      return undefined;
    }

    const json = await response.json();
    const body = json?.response?.body ?? json?.body;
    const item = body?.item ?? body?.items?.item ?? body?.items;

    if (!item) {
      console.log("apartment_item_empty_response", {
        endpoint,
        params,
        resultCode:
          json?.response?.header?.resultCode ?? json?.header?.resultCode,
        resultMsg:
          json?.response?.header?.resultMsg ?? json?.header?.resultMsg,
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

export async function fetchApartmentBasisInfo(
  kaptCode: string
): Promise<ApartmentBasisInfo | undefined> {
  const item = await requestPublicDataItem<Record<string, unknown>>(
    "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfo",
    { kaptCode }
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

export async function fetchApartmentDetailInfo(
  kaptCode: string
): Promise<ApartmentDetailInfo | undefined> {
  const item = await requestPublicDataItem<Record<string, unknown>>(
    "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfo",
    { kaptCode }
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

  return { basis, detail };
}

export async function fetchLegalDongApartmentList(params: {
  legalDongCode?: string;
}): Promise<ApartmentListItem[]> {
  try {
    if (!params.legalDongCode) return [];

    const url = createPublicDataUrl(
      "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getLegaldongAptList",
      {
        bjdCode: params.legalDongCode
      },
      { json: false }
    );

    if (!url) {
      console.warn("PUBLIC_DATA_API_KEY is missing.");
      return [];
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store"
    });

    const xml = await response.text();

    if (!response.ok) {
      console.warn("apartment_list_api_failed", {
        status: response.status,
        url: url.toString(),
        body: xml.slice(0, 500)
      });

      return [];
    }

    console.log("apartment_legal_dong_raw", {
      status: response.status,
      legalDongCode: params.legalDongCode,
      sample: xml.slice(0, 300)
    });

    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    return itemMatches.map((match) => {
      const itemXml = match[1];

      return {
        kaptCode:
          itemXml.match(/<kaptCode>(.*?)<\/kaptCode>/)?.[1]?.trim() ||
          undefined,

        kaptName:
          itemXml.match(/<kaptName>(.*?)<\/kaptName>/)?.[1]?.trim() ||
          undefined,

        kaptAddr:
          itemXml.match(/<kaptAddr>(.*?)<\/kaptAddr>/)?.[1]?.trim() ||
          undefined,

        doroJuso:
          itemXml.match(/<doroJuso>(.*?)<\/doroJuso>/)?.[1]?.trim() ||
          undefined,

        bjdCode:
          itemXml.match(/<bjdCode>(.*?)<\/bjdCode>/)?.[1]?.trim() ||
          undefined
      };
    });
  } catch (error) {
    console.error("fetchLegalDongApartmentList_error", error);
    return [];
  }
}

export async function findApartmentKaptCode(params: {
  legalDongCode?: string;
  buildingName?: string;
}): Promise<string | undefined> {
  const candidates = await fetchLegalDongApartmentList({
    legalDongCode: params.legalDongCode
  });

  console.log("kapt_target_lookup_input", {
    legalDongCode: params.legalDongCode,
    buildingName: params.buildingName,
    candidateCount: candidates.length
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

  console.log(
    "kapt_target_lookup_candidates",
    scored.slice(0, 5).map((item) => ({
      score: item.score,
      kaptCode: item.candidate.kaptCode,
      kaptName: item.candidate.kaptName,
      kaptAddr: item.candidate.kaptAddr,
      bjdCode: item.candidate.bjdCode
    }))
  );

  const best = scored[0];

  if (!best || best.score < 60) return undefined;

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

function calculateApartmentSimilarity(params: {
  targetName?: string;
  candidateName?: string;
  targetBuildYear?: number;
  candidateBuildYear?: number;
  targetHouseholdCount?: number;
  candidateHouseholdCount?: number;
}) {
  let score = calculateNameSimilarity(
    params.targetName,
    params.candidateName
  );

  if (
    params.targetBuildYear &&
    params.candidateBuildYear
  ) {
    const diff = Math.abs(
      params.targetBuildYear -
      params.candidateBuildYear
    );

    if (diff <= 1) {
      score += 15;
    } else if (diff <= 3) {
      score += 8;
    } else if (diff >= 10) {
      score -= 10;
    }
  }

  if (
    params.targetHouseholdCount &&
    params.candidateHouseholdCount
  ) {
    const ratio =
      Math.abs(
        params.targetHouseholdCount -
        params.candidateHouseholdCount
      ) / params.targetHouseholdCount;

    if (ratio <= 0.2) {
      score += 10;
    } else if (ratio >= 0.8) {
      score -= 8;
    }
  }

  return Math.max(0, Math.min(100, score));
}


export async function findApartmentKaptCodeInLegalDong(params: {
  legalDongCode?: string;
  apartmentName?: string;
}): Promise<string | undefined> {
  const candidates = await fetchLegalDongApartmentList({
    legalDongCode: params.legalDongCode
  });

  console.log("kapt_transaction_lookup_input", {
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
    "kapt_transaction_lookup_candidates",
    scored.slice(0, 5).map((item) => ({
      score: item.score,
      kaptCode: item.candidate.kaptCode,
      kaptName: item.candidate.kaptName,
      kaptAddr: item.candidate.kaptAddr,
      bjdCode: item.candidate.bjdCode
    }))
  );

  const best = scored[0];

  if (!best || best.score < 60) return undefined;

  return best.candidate.kaptCode;
}
