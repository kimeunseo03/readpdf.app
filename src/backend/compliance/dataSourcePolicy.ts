export const prohibitedDataPractices = [
  "KB부동산 등 유료 서비스의 무단 데이터 사용",
  "로그인 우회 또는 세션 자동화 기반 수집",
  "약관 위반 크롤링",
  "robots.txt 위반 크롤링",
  "타사 화면 캡처 자동화",
  "개인정보 목적 외 저장",
  "출처 불명 시세 데이터 사용"
] as const;

export function getCompliancePolicy() {
  return {
    usesOnlyPermittedSources: true,
    externalDataSources: [],
    prohibitedCrawlingDetected: false,
    paidServiceDependency: false,
    prohibitedDataPractices
  };
}
