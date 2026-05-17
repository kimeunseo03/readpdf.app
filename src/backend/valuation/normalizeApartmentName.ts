/**
 * 아파트 단지명 정규화 — 동일단지 매칭에 사용
 *
 * 규칙:
 *  - 공백·괄호 제거
 *  - 브랜드 표기 통일 (에스클래스, 이편한세상 등)
 *  - "아파트" / "APT" 접미사 제거 ("OO아파트" = "OO")
 *  - 단지 번호는 유지 ("퍼스트클래스1단지" ≠ "퍼스트클래스2단지")
 *  - 소문자 통일
 */
export function normalizeApartmentName(value?: string): string {
  return (
    value
      ?.replace(/\s+/g, "")
      .replace(/[()（）]/g, "")
      .replace(/에스-?클래스/g, "s클래스")
      .replace(/S-?클래스/gi, "s클래스")
      .replace(/이편한세상/g, "e편한세상")
      .replace(/[가-힣]?동$/g, "")
      .replace(/아파트$/g, "")
      .replace(/apt$/gi, "")
      .toLowerCase()
      .trim() ?? ""
  );
}

/**
 * 두 단지명이 같은 아파트인지 판별
 *
 * - 정규화 후 완전 일치 → true
 * - 한쪽이 다른 쪽을 포함하고 길이 비율 80% 이상 → true
 *   (단, 뒤에 오는 나머지가 단지/차/지 구분자이면 별개 단지로 판정)
 */
export function isApartmentNameMatch(apiName: string, targetName: string): boolean {
  const a = normalizeApartmentName(apiName);
  const b = normalizeApartmentName(targetName);
  if (!b || !a) return false;
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer  = a.length <= b.length ? b : a;
  if (!longer.includes(shorter)) return false;

  const remainder = longer.slice(shorter.length).trim();
  if (/^[0-9]*[단차지]$/.test(remainder) || /^[0-9]+$/.test(remainder)) return false;

  return shorter.length / longer.length >= 0.8;
}
