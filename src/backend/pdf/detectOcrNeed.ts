export type OcrDecision = {
  ocrRequired: boolean;
  confidence: number;
  reasons: string[];
};

export function detectOcrNeed(text: string, pageCount: number): OcrDecision {
  const normalized = text.replace(/\s+/g, " ").trim();
  const textLengthPerPage = pageCount > 0 ? normalized.length / pageCount : 0;
  const hasRegistryKeywords = /(등기사항전부증명서|집합건물|표제부|갑구|을구|전유부분|대지권)/.test(normalized);
  const hasAddressLikeText = /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|전라|경상|제주).{0,40}(구|군|시)/.test(normalized);

  const reasons: string[] = [];
  if (textLengthPerPage < 300) reasons.push("페이지당 추출 텍스트 길이가 짧습니다.");
  if (!hasRegistryKeywords) reasons.push("등본 핵심 키워드가 충분히 탐지되지 않았습니다.");
  if (!hasAddressLikeText) reasons.push("주소형 텍스트가 명확히 탐지되지 않았습니다.");

  const ocrRequired = textLengthPerPage < 300 || (!hasRegistryKeywords && normalized.length < 1000);
  const confidence = ocrRequired ? 0.45 : 0.88;

  return { ocrRequired, confidence, reasons };
}
