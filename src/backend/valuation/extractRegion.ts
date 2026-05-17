export interface ExtractedRegion {
  sido?: string;
  sigungu?: string;
  eupmyeondong?: string;
}

export function extractRegion(address?: string): ExtractedRegion {
  if (!address) {
    return {};
  }

  const cleaned = address.replace(/\s+/g, " ").trim();

  const parts = cleaned.split(" ");

  const sido = parts[0];

  let sigungu: string | undefined;
  let eupmyeondong: string | undefined;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    if (!sigungu && /(?:시|군|구)$/.test(part)) {
      sigungu = part;
      continue;
    }

    if (!eupmyeondong && /(?:읍|면|동|리)$/.test(part)) {
      eupmyeondong = part;
      break;
    }
  }

  return {
    sido,
    sigungu,
    eupmyeondong
  };
}
