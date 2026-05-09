import type { ValuationInput } from "@shared/types/valuation";

export function createValuationPlaceholder(input: ValuationInput | null) {
  if (!input) {
    return {
      isReady: false,
      message: "가치평가 입력값이 부족합니다. PDF 판독 결과를 먼저 수동 검토하세요."
    };
  }

  return {
    isReady: true,
    message: "가치평가 계산 모듈 연결 준비 완료. 현재 단계에서는 가격 산출을 수행하지 않습니다.",
    input
  };
}
