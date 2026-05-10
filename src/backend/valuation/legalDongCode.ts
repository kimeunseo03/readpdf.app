import type { ExtractedRegion } from "./extractRegion";

const LEGAL_DONG_CODES: Record<string, string> = {
  "서울특별시 동대문구 답십리동": "1123010500",
  "경기도 용인시 기흥구 보정동": "4146311800",
  "전라남도 나주시 남평읍": "4617025000",
  "전라남도 순천시 해룡면": "4615031000"
};

export function findLegalDongCode(region?: ExtractedRegion): string | undefined {
  if (!region?.sido || !region?.sigungu || !region?.eupmyeondong) {
    return undefined;
  }

  const key = getLegalDongCodeKey(region);

if (!key) {
  return undefined;
}

return LEGAL_DONG_CODES[key];
}

export function getLegalDongCodeKey(region: {
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
}) {
  if (!region.sido || !region.sigungu || !region.eupmyeondong) {
    return undefined;
  }

  return `${region.sido} ${region.sigungu} ${region.eupmyeondong}`;
}
