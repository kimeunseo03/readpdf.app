import type { RegistryParseResult } from "@shared/types/registry";
import { maskSensitiveText } from "@backend/compliance/piiMasking";
import { detectOcrNeed } from "./detectOcrNeed";

type Evidence = RegistryParseResult["sourceEvidence"][number];

const SIDO_PATTERN = /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|충청북도|충청남도|전북특별자치도|전라남도|경상북도|경상남도|제주특별자치도)/;

function findSnippet(text: string, regex: RegExp): string | undefined {
  const match = text.match(regex);
  if (!match?.index) return match?.[0]?.slice(0, 180);
  return text.slice(Math.max(0, match.index - 50), Math.min(text.length, match.index + 160)).replace(/\s+/g, " ").trim();
}

function addEvidence(evidence: Evidence[], field: string, textSnippet?: string, confidence = 0.7) {
  if (!textSnippet) return;
  evidence.push({ field, page: 1, textSnippet, confidence });
}

export function parseRegistryText(params: {
  fileId: string;
  originalFileName: string;
  text: string;
  pageCount: number;
}): RegistryParseResult {
  const compactText = params.text.replace(/\s+/g, " ").trim();
  const evidence: Evidence[] = [];
  const ocrDecision = detectOcrNeed(compactText, params.pageCount);

  const documentTypeConfidence = /(등기사항전부증명서|등기부등본)/.test(compactText) ? 0.9 : 0.45;
  const registryType = /집합건물/.test(compactText) ? "collective_building" : "unknown";

  const addressSnippet = findSnippet(compactText, new RegExp(`${SIDO_PATTERN.source}.{0,120}`));
  const addressRaw = addressSnippet?.replace(/(표제부|갑구|을구|전유부분|대지권).*$/, "").trim();
  addEvidence(evidence, "property.addressRaw", addressSnippet, addressRaw ? 0.78 : 0.3);

  const sido = compactText.match(SIDO_PATTERN)?.[0];
  const sigungu = compactText.match(/([가-힣]+(?:시|군|구))/)?.[1];
  const eupmyeondong = compactText.match(/([가-힣0-9]+(?:동|읍|면|리))/)?.[1];

  const buildingDong = compactText.match(/(\d{1,4}\s*동)/)?.[1]?.replace(/\s+/g, "");
  addEvidence(evidence, "property.buildingDong", findSnippet(compactText, /\d{1,4}\s*동/), buildingDong ? 0.72 : 0.2);

  const unitNumber = compactText.match(/(\d{1,4}\s*호)/)?.[1]?.replace(/\s+/g, "");
  addEvidence(evidence, "property.unitNumber", findSnippet(compactText, /\d{1,4}\s*호/), unitNumber ? 0.72 : 0.2);

  const exclusiveAreaMatch = compactText.match(/(?:전유부분|전유면적|건물의 표시).{0,80}?(\d{1,4}(?:\.\d+)?)\s*(?:㎡|제곱미터|m2)/i)
    || compactText.match(/(\d{1,4}(?:\.\d+)?)\s*(?:㎡|제곱미터|m2)/i);
  const exclusiveAreaM2 = exclusiveAreaMatch ? Number(exclusiveAreaMatch[1]) : undefined;
  addEvidence(evidence, "property.exclusiveAreaM2", findSnippet(compactText, /(?:전유부분|전유면적|건물의 표시).{0,80}?(\d{1,4}(?:\.\d+)?)\s*(?:㎡|제곱미터|m2)/i), exclusiveAreaM2 ? 0.76 : 0.25);

  const landRightRatio = compactText.match(/\d+(?:\.\d+)?\s*분의\s*\d+(?:\.\d+)?/)?.[0]?.replace(/\s+/g, "");
  addEvidence(evidence, "property.landRightRatio", findSnippet(compactText, /\d+(?:\.\d+)?\s*분의\s*\d+(?:\.\d+)?/), landRightRatio ? 0.7 : 0.2);

  const buildingName = compactText.match(/([가-힣A-Za-z0-9]+(?:아파트|빌라|오피스텔|맨션|타운|주공))/)?.[1];
  addEvidence(evidence, "property.buildingName", findSnippet(compactText, /[가-힣A-Za-z0-9]+(?:아파트|빌라|오피스텔|맨션|타운|주공)/), buildingName ? 0.66 : 0.2);

  const rightsRisk = {
    hasMortgage: /근저당권/.test(compactText),
    hasSeizure: /[^가]압류/.test(compactText),
    hasProvisionalSeizure: /가압류/.test(compactText),
    hasLeaseholdRight: /전세권|임차권/.test(compactText),
    hasTrust: /신탁/.test(compactText),
    coOwnerCount: undefined as number | undefined,
    riskFlags: [] as string[]
  };

  if (rightsRisk.hasMortgage) rightsRisk.riskFlags.push("mortgage_detected");
  if (rightsRisk.hasSeizure) rightsRisk.riskFlags.push("seizure_detected");
  if (rightsRisk.hasProvisionalSeizure) rightsRisk.riskFlags.push("provisional_seizure_detected");
  if (rightsRisk.hasLeaseholdRight) rightsRisk.riskFlags.push("leasehold_or_tenant_right_detected");
  if (rightsRisk.hasTrust) rightsRisk.riskFlags.push("trust_detected");

  addEvidence(evidence, "rightsRisk", findSnippet(compactText, /(근저당권|가압류|압류|전세권|임차권|신탁).{0,100}/), rightsRisk.riskFlags.length ? 0.74 : 0.65);

  const missingRequiredFields: string[] = [];
  if (!addressRaw) missingRequiredFields.push("addressRaw");
  if (!buildingName) missingRequiredFields.push("buildingName");
  if (!buildingDong) missingRequiredFields.push("buildingDong");
  if (!unitNumber) missingRequiredFields.push("unitNumber");
  if (!exclusiveAreaM2) missingRequiredFields.push("exclusiveAreaM2");

  const confidence = {
    documentType: documentTypeConfidence,
    address: addressRaw ? 0.78 : 0.3,
    area: exclusiveAreaM2 ? 0.76 : 0.25,
    rightsRisk: rightsRisk.riskFlags.length ? 0.74 : 0.65,
    overall: 0
  };

  confidence.overall = Number(((confidence.documentType + confidence.address + confidence.area + confidence.rightsRisk + ocrDecision.confidence) / 5).toFixed(2));

  const reasons = [
    ...ocrDecision.reasons,
    ...(documentTypeConfidence < 0.75 ? ["등본 문서 여부 신뢰도가 낮습니다."] : []),
    ...(missingRequiredFields.length ? ["가치평가 입력 필수 필드가 누락되었습니다."] : []),
    ...(rightsRisk.riskFlags.length ? ["권리관계 리스크 키워드가 탐지되었습니다. 법률 판단이 아닌 내부 검토 플래그입니다."] : [])
  ];

  return {
    document: {
      fileId: params.fileId,
      originalFileName: params.originalFileName,
      pageCount: params.pageCount,
      documentType: documentTypeConfidence >= 0.75 ? "real_estate_registry" : "unknown",
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
      landRightRatio
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
        "KB부동산 등 유료 서비스 및 무단 크롤링 데이터는 사용하지 않습니다."
      ]
    }
  };
}
