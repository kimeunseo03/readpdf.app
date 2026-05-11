import type { RegistryParseResult } from "@shared/types/registry";
import { maskSensitiveText } from "@backend/compliance/piiMasking";
import { detectOcrNeed } from "./detectOcrNeed";

type Evidence = RegistryParseResult["sourceEvidence"][number];

const SIDO_PATTERN = /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|충청북도|충청남도|전북특별자치도|전라남도|경상북도|경상남도|제주특별자치도)/;
const BUILDING_NAME_SUFFIX_PATTERN = /(아파트|오피스텔|빌라|맨션|타운|주공|에스-?클래스|리버시티|힐즈|캐슬|자이|푸르지오|래미안|아이파크|더샵|e편한세상|롯데캐슬)/;

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\[\s*집합건물\s*\]/g, "[집합건물]")
    .trim();
}

function findSnippet(text: string, regex: RegExp, before = 70, after = 180): string | undefined {
  const match = text.match(regex);
  if (!match) return undefined;
  const index = match.index ?? 0;
  return text
    .slice(Math.max(0, index - before), Math.min(text.length, index + after))
    .replace(/\s+/g, " ")
    .trim();
}

function addEvidence(evidence: Evidence[], field: string, textSnippet?: string, confidence = 0.7) {
  if (!textSnippet) return;
  evidence.push({ field, page: 1, textSnippet, confidence });
}

function extractPrimaryAddressSegment(text: string): string | undefined {
  const headerMatch = text.match(
    new RegExp(`\\[집합건물\\]\\s*(${SIDO_PATTERN.source}.{0,180}?제\\s*\\d{1,4}\\s*동\\s*제\\s*\\d{1,2}\\s*층\\s*제\\s*\\d{1,4}\\s*호)`)
  );

  if (headerMatch?.[1]) {
    return headerMatch[1].replace(/\s+/g, " ").trim();
  }

  const fallback = text.match(new RegExp(`(${SIDO_PATTERN.source}.{0,180}?제\\s*\\d{1,4}\\s*동\\s*제\\s*\\d{1,2}\\s*층\\s*제\\s*\\d{1,4}\\s*호)`));
  return fallback?.[1]?.replace(/\s+/g, " ").trim();
}

function parseAdministrativeArea(address?: string): Pick<RegistryParseResult["property"], "sido" | "sigungu" | "eupmyeondong"> {
  if (!address) return {};

  const sido = address.match(SIDO_PATTERN)?.[1];
  const afterSido = sido ? address.slice(address.indexOf(sido) + sido.length).trim() : address;

  const parts = afterSido.split(/\s+/).filter(Boolean);
  const sigunguParts: string[] = [];
  let eupmyeondong: string | undefined;

  for (const part of parts) {
    const clean = part.replace(/[(),]/g, "");
    if (/^(제?\d+동|제?\d+층|제?\d+호)$/.test(clean)) break;
    if (/\d/.test(clean) && !/[가-힣]/.test(clean)) continue;

    if (!eupmyeondong && /[가-힣0-9]+(?:읍|면|동|리)$/.test(clean)) {
      eupmyeondong = clean;
      break;
    }

    if (/[가-힣]+(?:시|군|구)$/.test(clean)) {
      sigunguParts.push(clean);
    }
  }

  return {
    sido,
    sigungu: sigunguParts.length ? sigunguParts.join(" ") : undefined,
    eupmyeondong
  };
}

function extractBuildingDong(address?: string): string | undefined {
  const match = address?.match(/제\s*(\d{1,4})\s*동/);
  return match ? `${match[1]}동` : undefined;
}

function extractFloor(address?: string): number | undefined {
  const match = address?.match(/제\s*(\d{1,2})\s*층/);
  return match ? Number(match[1]) : undefined;
}

function extractUnitNumber(address?: string): string | undefined {
  const match = address?.match(/제\s*(\d{1,4})\s*호/);
  return match ? `${match[1]}호` : undefined;
}

function extractBuildingNameFromAddress(address?: string, buildingDong?: string): string | undefined {
  if (!address || !buildingDong) return undefined;

  const beforeDong = address.split(new RegExp(`제\\s*${buildingDong.replace("동", "")}\\s*동`))[0]?.trim();
  if (!beforeDong) return undefined;

  const tokens = beforeDong.split(/\s+/).filter(Boolean);
  const lastToken = tokens[tokens.length - 1]?.replace(/[(),]/g, "");

  if (!lastToken || /^\d/.test(lastToken)) return undefined;
  if (!BUILDING_NAME_SUFFIX_PATTERN.test(lastToken)) return undefined;

  return lastToken;
}

function extractBuildingNameFromRoadAddress(text: string, buildingDong?: string, unitNumber?: string): string | undefined {
  if (!buildingDong || !unitNumber) return undefined;

  const dongNo = buildingDong.replace("동", "");
  const unitNo = unitNumber.replace("호", "");
  const sameUnitPattern = new RegExp(`${dongNo}\\s*동\\s*${unitNo}\\s*호\\s*\\([^)]*,\\s*([^)]*${BUILDING_NAME_SUFFIX_PATTERN.source}[^)]*)\\)`);
  const match = text.match(sameUnitPattern);

  return match?.[1]?.replace(/\s+/g, "").trim();
}

function extractExclusiveAreaM2(text: string, floor?: number, unitNumber?: string): number | undefined {
  const sectionStart = text.search(/【\s*표\s*제\s*부\s*】.{0,80}\(\s*전유부분의 건물의 표시\s*\)/);
  const section = sectionStart >= 0 ? text.slice(sectionStart, sectionStart + 1200) : text;

  const unitNo = unitNumber?.replace("호", "");
  const floorSpecificPattern = floor && unitNo
    ? new RegExp(`제\\s*${floor}\\s*층\\s*제\\s*${unitNo}\\s*호.{0,180}?(\\d{1,3}(?:\\.\\d+)?)\\s*(?:㎡|제곱미터|m2)`, "i")
    : undefined;

  const specificMatch = floorSpecificPattern ? section.match(floorSpecificPattern) : undefined;
  const fallbackMatch = section.match(/건\s*물\s*내\s*역.{0,260}?(\d{1,3}(?:\.\d+)?)\s*(?:㎡|제곱미터|m2)/i)
    || section.match(/제\s*\d{1,2}\s*층\s*제\s*\d{1,4}\s*호.{0,180}?(\d{1,3}(?:\.\d+)?)\s*(?:㎡|제곱미터|m2)/i);

  const value = Number((specificMatch || fallbackMatch)?.[1]);
  if (!Number.isFinite(value)) return undefined;

  // 집합건물 전유면적에서 500㎡ 초과는 대부분 전체 건물/층 면적 오탐이므로 수동 검토로 넘긴다.
  if (value <= 0 || value > 500) return undefined;
  return value;
}

function extractLandRightRatio(text: string): string | undefined {
  const sectionStart = text.search(/\(\s*대지권의 표시\s*\)/);
  const section = sectionStart >= 0 ? text.slice(sectionStart, sectionStart + 700) : text;

  const directMatch = section.match(
    /소유권대지권\s+(\d+(?:\.\d+)?)분의\s+(\d+(?:\.\d+)?)/
  );

  if (directMatch && !/^\d{4}$/.test(directMatch[2])) {
    return `${directMatch[1]}분의${directMatch[2]}`;
  }

  const distortedMatch = section.match(
    /소유권대지권\s+(\d+(?:\.\d+)?)분의[\s\S]{0,80}?대지권\s+(\d+(?:\.\d+)?)/
  );

  if (distortedMatch) {
    return `${distortedMatch[1]}분의${distortedMatch[2]}`;
  }

  return undefined;
}

type MortgageEntry = {
  rank: number;
  creditor: string;
  amount: number; // 원 단위
};

function parseWonAmount(value?: string): number {
  if (!value) return 0;

  const numeric = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatWon(value: number): string {
  return `${value.toLocaleString()}원`;
}

function cleanMortgageCreditor(value?: string): string {
  if (!value) return "확인 필요";

  return value
    .replace(/\s+/g, " ")
    .replace(
      /\s+(공동담보|채무자|채권최고액|등기목적|접수|말소|해지|목록|부기등기).*$/g,
      ""
    )
    .trim() || "확인 필요";
}

function cleanSummaryCreditor(value?: string): string {
  if (!value) return "확인 필요";

  return value
    .replace(/\s+/g, " ")
    .replace(
      /\s+(?:\d{1,3}\s+근저당권설정|채권최고액|대상소유자|제\d+호|말소|해지|변경|이전|$).*$/g,
      ""
    )
    .trim() || "확인 필요";
}

function extractActiveMortgagesFromSummary(text: string): MortgageEntry[] {
  const summaryStart = text.indexOf("주요 등기사항 요약");
  if (summaryStart < 0) return [];

  const summaryText = text.slice(summaryStart);

  const sectionMatch = summaryText.match(
    /3\.\s*\(근\)저당권 및 전세권 등\s*\(\s*을구\s*\)([\s\S]*?)(?:\[ 참 고 사 항 \]|출력일시|$)/
  );

  const section = sectionMatch?.[1] ?? "";
  if (!section) return [];

  const results: MortgageEntry[] = [];
  const seen = new Set<string>();

  const rowStartRegex =
    /(?:^|\s)(\d{1,3})\s+근저당권설정\s+\d{4}년\d{1,2}월\d{1,2}일/g;

  const starts = Array.from(section.matchAll(rowStartRegex));

  starts.forEach((startMatch, index) => {
    const startIndex = startMatch.index ?? 0;
    const nextIndex =
      index + 1 < starts.length
        ? starts[index + 1].index ?? section.length
        : section.length;

    const row = section.slice(startIndex, nextIndex);

    const amountMatch = row.match(
      /채권최고액\s*(?:금)?\s*([0-9][0-9,]{4,})\s*원/
    );

    const creditorMatch = row.match(
      /근저당권자\s+(.+?)(?=\s+\d{1,3}\s+근저당권설정|$)/
    );

    const rank = Number(startMatch[1]);
    const amount = parseWonAmount(amountMatch?.[1]);
    const creditor = cleanSummaryCreditor(creditorMatch?.[1]);

    if (!rank || !amount) return;

    const key = `${rank}-${creditor}-${amount}`;
    if (seen.has(key)) return;

    seen.add(key);
    results.push({
      rank,
      creditor,
      amount
    });
  });

  return results.sort((a, b) => a.rank - b.rank);
}

function extractMortgagesFromBody(text: string): MortgageEntry[] {
  const eulguStart = text.indexOf("【 을 구 】");
  if (eulguStart < 0) return [];

  const source = text.slice(eulguStart);
  const results: MortgageEntry[] = [];
  const seen = new Set<string>();

  const blockStartRegex =
    /(?:^|\s)(\d{1,3})\s+근저당권설정\s+\d{4}년\d{1,2}월\d{1,2}일/g;

  const starts = Array.from(source.matchAll(blockStartRegex));

  starts.forEach((startMatch, index) => {
    const rank = Number(startMatch[1]);
    const startIndex = startMatch.index ?? 0;
    const nextIndex =
      index + 1 < starts.length
        ? starts[index + 1].index ?? source.length
        : source.length;

    const block = source.slice(startIndex, nextIndex);

    const cancellationRegex = new RegExp(
      `${rank}\\s*번\\s*근저당권설정등?\\s*기?말소|${rank}\\s*번근저당권설정등\\s*기말소`
    );

    if (cancellationRegex.test(source)) return;

    const amountMatch = block.match(
      /채권최고액\s*(?:금)?\s*([0-9][0-9,]{4,})\s*원/
    );

    const creditorMatch = block.match(
      /근저당권자\s+(.+?)(?=\s+(?:[0-9]{6}-|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|전라|전북|전남|경상|경북|경남|제주|채무자|채권최고액|공동담보|목록|접수|등기원인|-- 이 하 여 백 --|$))/
    );

    const amount = parseWonAmount(amountMatch?.[1]);
    const creditor = cleanSummaryCreditor(creditorMatch?.[1]);

    if (!rank || !amount) return;

    const key = `${rank}-${creditor}-${amount}`;
    if (seen.has(key)) return;

    seen.add(key);
    results.push({
      rank,
      creditor,
      amount
    });
  });

  return results.sort((a, b) => a.rank - b.rank);
}

function normalizeMortgageRanks(mortgages: MortgageEntry[]): MortgageEntry[] {
  return mortgages.map((mortgage, index) => ({
    ...mortgage,
    rank: index + 1
  }));
}

function extractMortgages(text: string): MortgageEntry[] {
  const summaryMortgages = extractActiveMortgagesFromSummary(text);

  if (summaryMortgages.length > 0) {
    return normalizeMortgageRanks(summaryMortgages);
  }

  return normalizeMortgageRanks(extractMortgagesFromBody(text));
}

export function parseRegistryText(params: {
  fileId: string;
  originalFileName: string;
  text: string;
  pageCount: number;
}): RegistryParseResult {
  const compactText = normalizeText(params.text);
  const evidence: Evidence[] = [];
  const ocrDecision = detectOcrNeed(compactText, params.pageCount);

  const documentTypeConfidence = /(등기사항전부증명서|등기부등본)/.test(compactText) ? 0.9 : 0.45;
  const registryType = /집합건물/.test(compactText) ? "collective_building" : "unknown";

  const addressRaw = extractPrimaryAddressSegment(compactText);
  addEvidence(evidence, "property.addressRaw", addressRaw, addressRaw ? 0.9 : 0.25);

  const { sido, sigungu, eupmyeondong } = parseAdministrativeArea(addressRaw);

  const buildingDong = extractBuildingDong(addressRaw);
  addEvidence(evidence, "property.buildingDong", addressRaw, buildingDong ? 0.9 : 0.2);

  const floor = extractFloor(addressRaw);

  const unitNumber = extractUnitNumber(addressRaw);
  addEvidence(evidence, "property.unitNumber", addressRaw, unitNumber ? 0.9 : 0.2);

  const buildingName = extractBuildingNameFromAddress(addressRaw, buildingDong)
    || extractBuildingNameFromRoadAddress(compactText, buildingDong, unitNumber);
  addEvidence(
    evidence,
    "property.buildingName",
    buildingName ? findSnippet(compactText, new RegExp(buildingName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) : undefined,
    buildingName ? 0.82 : 0.25
  );

  const exclusiveAreaM2 = extractExclusiveAreaM2(compactText, floor, unitNumber);
  addEvidence(
    evidence,
    "property.exclusiveAreaM2",
    findSnippet(compactText, /전유부분의 건물의 표시|제\s*\d{1,2}\s*층\s*제\s*\d{1,4}\s*호.{0,140}?\d+(?:\.\d+)?\s*㎡/),
    exclusiveAreaM2 ? 0.84 : 0.25
  );

  const landRightRatio = extractLandRightRatio(compactText);
  addEvidence(evidence, "property.landRightRatio", findSnippet(compactText, /소유권대지권.{0,180}/), landRightRatio ? 0.82 : 0.2);

  const mortgages = extractMortgages(compactText);
  const totalMortgageAmount = mortgages.reduce(
    (sum, mortgage) => sum + mortgage.amount,
    0
  );

  const fallbackMortgageAmountMatch = compactText.match(
    /채권최고액\s*(?:금)?\s*([0-9][0-9,]{4,})\s*원?/
  );

  const mortgageAmountText = totalMortgageAmount
    ? formatWon(totalMortgageAmount)
    : fallbackMortgageAmountMatch?.[1]
      ? formatWon(parseWonAmount(fallbackMortgageAmountMatch[1]))
      : undefined;

  const rightsRisk = {
    hasMortgage: /근저당권/.test(compactText),
    hasSeizure: /(^|[^가])압류/.test(compactText),
    hasProvisionalSeizure: /가압류/.test(compactText),
    hasLeaseholdRight: /전세권|임차권/.test(compactText),
    hasTrust: /신탁/.test(compactText),
    coOwnerCount: undefined as number | undefined,
    riskFlags: [] as string[],
    riskLevel: "SAFE" as "SAFE" | "CAUTION" | "DANGER",
    riskScore: 0,
    summary: "",
    mortgageAmountText,
    mortgages,
    hasCancellationKeyword: /말소|해지|말소등기/.test(compactText),
    riskDetails: [] as {
      type: string;
      label: string;
      severity: "LOW" | "MEDIUM" | "HIGH";
      description: string;
    }[]
  };

  if (rightsRisk.hasMortgage) {
    rightsRisk.riskFlags.push("mortgage_detected");
    rightsRisk.riskScore += 25;

    rightsRisk.riskDetails.push({
      type: "mortgage",
      label: "근저당",
      severity: "MEDIUM",
      description: rightsRisk.mortgages.length
        ? `근저당권 ${rightsRisk.mortgages.length}건, 채권최고액 합계 ${rightsRisk.mortgageAmountText}이 확인되었습니다.`
        : rightsRisk.mortgageAmountText
          ? `근저당권 및 채권최고액 ${rightsRisk.mortgageAmountText}이 확인되었습니다.`
          : "근저당권 설정 문구가 확인되었습니다."
    });
  }

  if (rightsRisk.hasLeaseholdRight) {
    rightsRisk.riskFlags.push("leasehold_or_tenant_right_detected");
    rightsRisk.riskScore += 20;

    rightsRisk.riskDetails.push({
      type: "leasehold",
      label: "전세권/임차권",
      severity: "MEDIUM",
      description: "전세권 또는 임차권 관련 문구가 확인되었습니다."
    });
  }

  if (rightsRisk.hasSeizure) {
    rightsRisk.riskFlags.push("seizure_detected");
    rightsRisk.riskScore += 45;

    rightsRisk.riskDetails.push({
      type: "seizure",
      label: "압류",
      severity: "HIGH",
      description: "압류 관련 문구가 확인되어 고위험 권리관계 검토가 필요합니다."
    });
  }

  if (rightsRisk.hasProvisionalSeizure) {
    rightsRisk.riskFlags.push("provisional_seizure_detected");
    rightsRisk.riskScore += 45;

    rightsRisk.riskDetails.push({
      type: "provisional_seizure",
      label: "가압류",
      severity: "HIGH",
      description: "가압류 관련 문구가 확인되어 고위험 권리관계 검토가 필요합니다."
    });
  }

  if (rightsRisk.hasTrust) {
    rightsRisk.riskFlags.push("trust_detected");
    rightsRisk.riskScore += 40;

    rightsRisk.riskDetails.push({
      type: "trust",
      label: "신탁",
      severity: "HIGH",
      description: "신탁 관련 문구가 확인되어 소유권 및 처분 제한 검토가 필요합니다."
    });
  }

  if (rightsRisk.hasCancellationKeyword) {
    rightsRisk.riskScore = Math.max(0, rightsRisk.riskScore - 15);

    rightsRisk.riskDetails.push({
      type: "cancellation_keyword",
      label: "말소/해지 문구",
      severity: "LOW",
      description:
        "말소 또는 해지 관련 문구가 확인되었습니다. 실제 유효 여부는 원문 확인이 필요합니다."
    });
  }

  rightsRisk.riskScore = Math.min(100, rightsRisk.riskScore);

  if (rightsRisk.riskScore >= 60) {
    rightsRisk.riskLevel = "DANGER";
  } else if (rightsRisk.riskScore >= 25) {
    rightsRisk.riskLevel = "CAUTION";
  } else {
    rightsRisk.riskLevel = "SAFE";
  }

  const riskLabels = rightsRisk.riskDetails
    .filter((detail) => detail.type !== "cancellation_keyword")
    .map((detail) => detail.label);

  if (riskLabels.length === 0) {
    rightsRisk.summary =
      "특이 권리관계는 발견되지 않았습니다.";
  } else {
    rightsRisk.summary =
      `${riskLabels.join(", ")} 관련 권리관계가 확인되었습니다. 등기부 원문 기준의 추가 검토가 필요합니다.`;
  }

  addEvidence(
    evidence,
    "rightsRisk",
    findSnippet(compactText, /(근저당권|가압류|압류|전세권|임차권|신탁).{0,100}/),
    rightsRisk.riskFlags.length ? 0.74 : 0.65
  );

  const missingRequiredFields: string[] = [];

  if (!addressRaw) missingRequiredFields.push("addressRaw");
  if (!buildingDong) missingRequiredFields.push("buildingDong");
  if (!unitNumber) missingRequiredFields.push("unitNumber");
  if (!exclusiveAreaM2) missingRequiredFields.push("exclusiveAreaM2");

  const confidence = {
    documentType: documentTypeConfidence,
    address: addressRaw ? 0.9 : 0.25,
    area: exclusiveAreaM2 ? 0.84 : 0.25,
    rightsRisk: rightsRisk.riskFlags.length ? 0.74 : 0.65,
    overall: 0
  };

  confidence.overall = Number(
    (
      (
        confidence.documentType +
        confidence.address +
        confidence.area +
        confidence.rightsRisk +
        ocrDecision.confidence
      ) / 5
    ).toFixed(2)
  );

  const reasons = [
    ...ocrDecision.reasons,
    ...(documentTypeConfidence < 0.75
      ? ["등본 문서 여부 신뢰도가 낮습니다."]
      : []),
    ...(missingRequiredFields.length
      ? ["가치평가 입력 필수 필드가 누락되었습니다."]
      : []),
    ...(rightsRisk.riskFlags.length
      ? ["권리관계 리스크 키워드가 탐지되었습니다. 법률 판단이 아닌 내부 검토 플래그입니다."]
      : [])
  ];

  return {
    document: {
      fileId: params.fileId,
      originalFileName: params.originalFileName,
      pageCount: params.pageCount,
      documentType:
        documentTypeConfidence >= 0.75
          ? "real_estate_registry"
          : "unknown",
      registryType,
      textExtractionMethod: "native_pdf_text",
      parsedAt: new Date().toISOString()
    },

    property: {
      addressRaw,
      sido,
      sigungu,
      eupmyeondong,
      buildingName,
      buildingDong,
      unitNumber,
      exclusiveAreaM2,
      landRightRatio,
      floor
    },

    rightsRisk,

    confidence,

    review: {
      manualReviewRequired: reasons.length > 0 || confidence.overall < 0.75,
      reasons,
      missingRequiredFields
    },

    sourceEvidence: evidence,

    meta: {
      ocrRequired: ocrDecision.ocrRequired,
      maskedTextPreview: maskSensitiveText(compactText).slice(0, 1200),
      warnings: [
        "원본 PDF는 현재 구현에서 저장하지 않습니다.",
        "OCR은 1차 구현에서 필요 여부만 판단하며 실제 OCR 처리는 후속 구현 대상입니다.",
        "건물명은 우선 상단 [집합건물] 주소 라인에서만 추출하며, 권리자/소유자 주소의 다른 아파트명은 배제합니다.",
        "전유면적은 전유부분의 건물의 표시 섹션에서만 추출합니다.",
        "KB부동산 등 유료 서비스 및 무단 크롤링 데이터는 사용하지 않습니다."
      ]
    }
  };
}
