// 등기부등본에서 개인정보에 해당하는 텍스트를 마스킹합니다.
// 마스킹 대상: 주민등록번호, 역할 키워드(소유자·채무자 등) 바로 뒤에 오는 2~4자 한글 이름
export function maskSensitiveText(input: string): string {
  return input
    // 주민등록번호: 000000-0000000
    .replace(/\d{6}\s*-\s*\d{7}/g, "******-*******")
    // 역할 키워드 뒤에 오는 이름만 마스킹 (오탐 방지)
    // 예: "소유자 홍길동" → "소유자 홍**"
    .replace(
      /(소유자|권리자|채무자|근저당권자|전세권자|임차권자)\s+([가-힣]{2,4})(?=\s|$)/g,
      (_, role: string, name: string) => `${role} ${name[0]}${"*".repeat(name.length - 1)}`
    );
}
