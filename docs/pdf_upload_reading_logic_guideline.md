# 내부용 등본 PDF 업로드·판독 로직 가이드라인

## 1. 목적

이 문서는 회사 내부용 웹사이트에서 **등본 PDF 업로드를 안정적으로 읽고 구조화하는 1차 모듈**을 설계하기 위한 가이드라인이다. 향후 아파트 가치평가 계산 모듈을 붙일 수 있도록, PDF 판독 결과를 표준 JSON 형태로 정규화하는 것을 목표로 한다.

본 문서는 서비스 출시용 설계서가 아니며, 내부 검증·업무 보조·프로토타입 개발을 전제로 한다.

---

## 2. 범위

### 포함 범위

- PDF 업로드
- PDF 파일 무결성 검사
- 텍스트 추출
- OCR 필요 여부 판단
- 등본 유형 및 문서 구조 식별
- 주소·건물명·동·호수·면적·소유권·권리관계 등 핵심 필드 추출
- 추출 신뢰도 산정
- 사람이 검토해야 할 항목 분리
- 향후 가치평가 계산 모듈에 전달할 표준 데이터 생성

### 제외 범위

- KB부동산 등 유료 서비스 연동
- 무단 크롤링 또는 약관 위반 가능성이 있는 외부 데이터 수집
- 자동 감정평가 결과의 대외 제공
- 법률적 권리관계 최종 판단
- 금융기관 제출용 감정평가서 생성

---

## 3. 기본 원칙

1. **PDF 판독과 가치평가 계산을 분리한다.**
   - PDF 모듈은 사실 정보 추출까지만 담당한다.
   - 가격 추정, 보정, 비교 사례 분석은 별도 모듈에서 처리한다.

2. **원문 근거를 보존한다.**
   - 추출된 모든 필드는 가능하면 원문 페이지, 문단, 좌표, 텍스트 스니펫을 함께 저장한다.

3. **신뢰도 낮은 항목은 자동 확정하지 않는다.**
   - OCR 결과, 충돌 정보, 누락 정보는 검토 필요 상태로 넘긴다.

4. **합법적 데이터만 사용한다.**
   - 내부 보유 데이터, 사용 허가된 공공데이터, 정식 API, 사용자가 직접 업로드한 문서만 사용한다.

5. **개인정보와 등기정보는 최소 보관한다.**
   - 내부 검증 목적에 필요한 필드만 저장한다.
   - 주민등록번호, 상세 소유자 정보 등 민감 정보는 마스킹 또는 저장 제외를 기본값으로 한다.

---

## 4. 권장 파일 구조

```txt
real-estate-valuation-internal/
  app/
    upload/
      page.tsx
    api/
      documents/
        upload/route.ts
        parse/route.ts
  lib/
    pdf/
      validatePdf.ts
      extractText.ts
      detectOcrNeed.ts
      parseRegistryPdf.ts
      normalizeRegistryData.ts
      confidence.ts
    valuation/
      valuationInputSchema.ts
      placeholderValuationEngine.ts
    compliance/
      dataSourcePolicy.ts
      piiMasking.ts
  types/
    registry.ts
    valuation.ts
  docs/
    pdf_upload_reading_logic_guideline.md
```

---

## 5. 멀티 페르소나 로직

PDF 업로드·판독 로직은 하나의 거대한 파서로 만들지 말고, 여러 역할의 판단 단계를 거치는 구조로 설계한다.

### Persona A. 문서 접수 담당자

**역할:** 업로드된 파일이 처리 가능한 PDF인지 확인한다.

#### 판단 기준

- 파일 확장자가 `.pdf`인지 확인
- MIME type 확인
- 파일 크기 제한 확인
- 암호화 PDF 여부 확인
- 페이지 수 제한 확인
- 손상된 PDF 여부 확인

#### 주요 출력

```json
{
  "isValidPdf": true,
  "fileSizeMb": 3.2,
  "pageCount": 6,
  "isEncrypted": false,
  "requiresManualReview": false
}
```

#### 실패 처리

- 암호화 PDF: 사용자에게 비밀번호 해제본 업로드 요청
- 손상 파일: 재업로드 요청
- 과대 용량: 압축 또는 분할 업로드 요청

---

### Persona B. 문서 판독 담당자

**역할:** PDF에서 텍스트를 추출하고 OCR 필요 여부를 판단한다.

#### 판단 기준

- 페이지별 텍스트 길이
- 한글·숫자·주소 패턴 존재 여부
- 이미지 기반 스캔 문서 여부
- 표 구조 유지 여부

#### OCR 필요 조건 예시

```txt
- 전체 페이지 중 50% 이상에서 추출 텍스트가 거의 없음
- 주소, 지번, 건물명, 전유부분 키워드가 전혀 없음
- 텍스트 좌표 정보가 비정상적으로 누락됨
```

#### 주요 출력

```json
{
  "textExtractionMethod": "native_pdf_text",
  "ocrRequired": false,
  "pages": [
    {
      "page": 1,
      "textLength": 2380,
      "hasAddressLikeText": true,
      "confidence": 0.92
    }
  ]
}
```

---

### Persona C. 등본 구조 분석가

**역할:** 문서가 부동산 등본인지, 어떤 구조를 가지는지 식별한다.

#### 탐지 키워드 예시

- 등기사항전부증명서
- 집합건물
- 표제부
- 갑구
- 을구
- 전유부분
- 대지권
- 소유권
- 근저당권
- 압류
- 가압류
- 전세권

#### 주요 출력

```json
{
  "documentType": "real_estate_registry",
  "registryType": "collective_building",
  "sectionsDetected": {
    "titleSection": true,
    "ownershipSection": true,
    "mortgageSection": true
  },
  "confidence": 0.88
}
```

---

### Persona D. 주소·물건 정보 추출가

**역할:** 가치평가 입력값으로 사용할 물건 기본 정보를 추출한다.

#### 추출 대상

- 시·도
- 시·군·구
- 읍·면·동
- 지번 또는 도로명 주소
- 아파트명 또는 건물명
- 동
- 호수
- 전유면적
- 대지권 비율
- 건물 구조
- 층수
- 사용승인일 또는 관련 연도 정보가 있다면 추출

#### 주요 출력

```json
{
  "property": {
    "addressRaw": "서울특별시 ...",
    "sido": "서울특별시",
    "sigungu": "강남구",
    "eupmyeondong": "대치동",
    "buildingName": "예시아파트",
    "buildingDong": "101동",
    "unitNumber": "1203호",
    "exclusiveAreaM2": 84.97,
    "landRightRatio": "12345.6분의 45.7"
  },
  "confidence": 0.84
}
```

---

### Persona E. 권리관계 리스크 검토자

**역할:** 가치평가 계산에 영향을 줄 수 있는 권리관계 리스크 신호를 분류한다.

#### 추출 대상

- 소유권 보존·이전
- 공유자 수
- 근저당권
- 전세권
- 임차권등기
- 가압류
- 압류
- 가처분
- 경매개시결정
- 신탁

#### 주의

이 단계는 법률 판단이 아니라 **리스크 플래그 분류**만 수행한다.

#### 주요 출력

```json
{
  "rightsRisk": {
    "hasMortgage": true,
    "hasSeizure": false,
    "hasProvisionalSeizure": false,
    "hasLeaseholdRight": false,
    "hasTrust": false,
    "coOwnerCount": 1,
    "riskFlags": ["mortgage_detected"]
  },
  "requiresLegalReview": false,
  "confidence": 0.79
}
```

---

### Persona F. 개인정보 보호 담당자

**역할:** 저장·표시·로그에 남길 수 없는 정보를 마스킹한다.

#### 기본 정책

- 주민등록번호: 저장 금지 또는 전체 마스킹
- 소유자 이름: 내부 업무상 필요 없으면 마스킹
- 상세 권리자 정보: 최소 저장
- 원본 PDF: 가능하면 단기 보관 후 삭제
- 로그에는 원문 전체를 남기지 않음

#### 마스킹 예시

```json
{
  "ownerNameMasked": "김**",
  "residentNumberMasked": "******-*******",
  "rawOwnerNameStored": false
}
```

---

### Persona G. 가치평가 입력 검수자

**역할:** 향후 가치평가 계산에 필요한 최소 입력값이 준비됐는지 확인한다.

#### 필수 입력값

```txt
- 주소
- 아파트명 또는 건물명
- 동/호수
- 전유면적
- 문서 유형
- 추출 신뢰도
```

#### 선택 입력값

```txt
- 대지권 비율
- 층수
- 권리관계 리스크 플래그
- 사용승인일
- 건물 구조
```

#### 주요 출력

```json
{
  "valuationReadiness": {
    "isReady": true,
    "missingRequiredFields": [],
    "missingOptionalFields": ["approvalDate", "floor"],
    "manualReviewRecommended": false
  }
}
```

---

### Persona H. 컴플라이언스 검토자

**역할:** 데이터 수집·외부 연동 방식이 내부 정책과 합법 범위에 맞는지 확인한다.

#### 허용

- 사용자가 직접 업로드한 등본 PDF
- 회사가 적법하게 보유한 내부 거래 사례 데이터
- 사용 허가된 공공데이터 API
- 라이선스가 명확한 데이터셋
- 수동 입력 데이터

#### 금지

- KB부동산 등 유료 서비스 데이터 무단 사용
- 로그인 우회, 봇 탐지 회피, 세션 탈취성 수집
- robots.txt 또는 약관을 위반하는 크롤링
- 타사 화면 캡처 기반 데이터 수집 자동화
- 개인정보 목적 외 보관

#### 주요 출력

```json
{
  "compliance": {
    "usesOnlyPermittedSources": true,
    "externalDataSources": [],
    "prohibitedCrawlingDetected": false,
    "paidServiceDependency": false
  }
}
```

---

## 6. 전체 파이프라인

```txt
1. PDF 업로드
2. 파일 유효성 검사
3. 원문 텍스트 추출
4. OCR 필요 여부 판단
5. OCR 또는 native text 결과 통합
6. 등본 여부 및 문서 구조 탐지
7. 핵심 필드 추출
8. 개인정보 마스킹
9. 권리관계 리스크 플래그 생성
10. 가치평가 입력값 정규화
11. 신뢰도 산정
12. 수동 검토 필요 여부 결정
13. 표준 JSON 저장 또는 다음 모듈로 전달
```

---

## 7. 표준 JSON 스키마 초안

```ts
export type RegistryParseResult = {
  document: {
    fileId: string;
    originalFileName: string;
    pageCount: number;
    documentType: "real_estate_registry" | "unknown";
    registryType?: "collective_building" | "land" | "building" | "unknown";
    textExtractionMethod: "native_pdf_text" | "ocr" | "hybrid";
    parsedAt: string;
  };

  property: {
    addressRaw?: string;
    sido?: string;
    sigungu?: string;
    eupmyeondong?: string;
    roadAddress?: string;
    lotNumberAddress?: string;
    buildingName?: string;
    buildingDong?: string;
    unitNumber?: string;
    exclusiveAreaM2?: number;
    landRightRatio?: string;
    floor?: number;
    approvalDate?: string;
  };

  rightsRisk: {
    hasMortgage?: boolean;
    hasSeizure?: boolean;
    hasProvisionalSeizure?: boolean;
    hasLeaseholdRight?: boolean;
    hasTrust?: boolean;
    coOwnerCount?: number;
    riskFlags: string[];
  };

  confidence: {
    overall: number;
    documentType: number;
    address: number;
    area: number;
    rightsRisk: number;
  };

  review: {
    manualReviewRequired: boolean;
    reasons: string[];
    missingRequiredFields: string[];
  };

  sourceEvidence: Array<{
    field: string;
    page: number;
    textSnippet: string;
    confidence: number;
  }>;
};
```

---

## 8. 신뢰도 산정 기준

### 예시 점수 체계

```txt
0.90 이상: 자동 처리 가능
0.75 ~ 0.89: 자동 처리 가능하나 주요 필드는 UI에서 표시
0.60 ~ 0.74: 수동 검토 권장
0.60 미만: 자동 확정 금지
```

### 감점 요인

- OCR 기반 추출
- 주소 후보가 2개 이상 충돌
- 면적 값이 여러 개 존재하지만 문맥 구분 실패
- 갑구/을구 섹션 탐지 실패
- 권리관계 키워드는 있으나 문맥 파싱 실패
- 페이지 일부가 누락되거나 회전됨

---

## 9. 수동 검토 트리거

아래 조건 중 하나라도 해당하면 `manualReviewRequired = true`로 설정한다.

```txt
- 등본 문서 여부 신뢰도 < 0.75
- 주소 추출 신뢰도 < 0.75
- 전유면적 추출 실패
- 동/호수 추출 실패
- 권리관계 리스크 키워드가 있으나 세부 파싱 실패
- OCR 사용 페이지 비율 > 50%
- 원문 페이지 수가 비정상적으로 적거나 많음
- 개인정보 마스킹 실패 가능성 있음
```

---

## 10. UI 요구사항

### 업로드 화면

- PDF만 업로드 가능
- 최대 용량 표시
- 내부용 시스템임을 명시
- 민감정보 포함 가능성 안내
- 외부 유료 서비스나 무단 크롤링을 사용하지 않는다는 내부 정책 표시

### 판독 결과 화면

- 추출된 주소
- 아파트명/동/호수
- 전유면적
- 권리관계 리스크 플래그
- 누락 필드
- 신뢰도
- 원문 근거 페이지
- 수동 수정 입력란

### 검토 화면

- 자동 추출값과 원문 스니펫 병렬 표시
- 사용자가 필드를 수정하면 수정 이력 저장
- 최종 확정 버튼 제공

---

## 11. 향후 가치평가 모듈 연계 방식

PDF 판독 모듈은 아래와 같은 최소 입력값만 넘긴다.

```ts
export type ValuationInput = {
  addressRaw: string;
  buildingName?: string;
  buildingDong?: string;
  unitNumber?: string;
  exclusiveAreaM2: number;
  floor?: number;
  approvalDate?: string;
  rightsRiskFlags: string[];
  parseConfidence: number;
};
```

가치평가 모듈은 이 입력값을 기반으로 내부 보유 데이터 또는 허가된 공공데이터와 결합한다.

```txt
PDF 판독 결과
   ↓
ValuationInput 정규화
   ↓
내부 거래 사례 / 허가된 공공데이터 매칭
   ↓
가격 추정 로직
   ↓
검토용 내부 리포트 생성
```

---

## 12. 금지 데이터 소스 정책

아래 항목은 명시적으로 금지한다.

```ts
export const prohibitedDataPractices = [
  "KB부동산 등 유료 서비스의 무단 데이터 사용",
  "로그인 우회 또는 세션 자동화 기반 수집",
  "약관 위반 크롤링",
  "robots.txt 위반 크롤링",
  "타사 화면 캡처 자동화",
  "개인정보 목적 외 저장",
  "출처 불명 시세 데이터 사용"
];
```

---

## 13. 개발 우선순위

### 1단계: PDF 판독 MVP

- PDF 업로드
- 텍스트 추출
- OCR 필요 여부 판단
- 주소·면적·동호수 추출
- JSON 결과 반환

### 2단계: 검토 UI

- 원문 스니펫 표시
- 필드별 신뢰도 표시
- 수동 수정
- 수정 이력 저장

### 3단계: 권리관계 리스크 플래그

- 갑구/을구 섹션 분리
- 근저당권, 압류, 가압류, 전세권 등 키워드 탐지
- 법률 판단이 아닌 내부 검토 플래그로만 사용

### 4단계: 가치평가 입력 연동

- ValuationInput 생성
- 내부 데이터와 매칭
- 계산 모듈 연결

---

## 14. 테스트 케이스

### 정상 케이스

```txt
- 텍스트 기반 집합건물 등본 PDF
- 주소, 아파트명, 동호수, 전유면적이 명확히 포함됨
- 권리관계 특이사항 없음
```

### OCR 케이스

```txt
- 스캔본 PDF
- 일부 페이지 회전
- 표 구조가 깨짐
```

### 충돌 케이스

```txt
- 주소 후보가 여러 개 추출됨
- 면적 값이 전유부분과 대지권 부분에 복수 존재
```

### 리스크 케이스

```txt
- 근저당권 존재
- 압류 또는 가압류 존재
- 신탁 등기 존재
```

### 실패 케이스

```txt
- 등본이 아닌 PDF
- 암호화 PDF
- 손상 PDF
- 이미지 품질이 낮아 OCR 실패
```

---

## 15. 내부 운영 정책

- 원본 PDF는 기본적으로 단기 보관 후 삭제한다.
- 추출 JSON은 목적 달성 후 보관 기간을 제한한다.
- 사용자가 수정한 값은 원본 추출값과 분리 저장한다.
- 모든 외부 데이터 연동은 사전 승인된 데이터 소스만 사용한다.
- 자동 산출 결과는 내부 참고용이며, 대외 감정평가로 표현하지 않는다.

---

## 16. 구현 시 권장 기술 선택지

### PDF 텍스트 추출

- Node.js: `pdf-parse`, `pdfjs-dist`
- Python 백엔드 병행 시: `pypdf`, `pdfplumber`, `PyMuPDF`

### OCR

- 내부 서버 OCR 엔진 또는 승인된 OCR API
- OCR 결과는 원문 좌표와 함께 저장 권장

### 데이터 검증

- TypeScript: `zod`
- Python: `pydantic`

### 저장소

- 원본 파일: 암호화된 내부 스토리지
- 추출 결과: PostgreSQL JSONB 또는 문서형 저장소
- 로그: 원문 텍스트 저장 금지, 처리 상태 중심 저장

---

## 17. 핵심 의사결정 규칙 요약

```txt
IF PDF가 유효하지 않음
  THEN 처리 중단 및 재업로드 요청

IF 텍스트 추출 품질이 낮음
  THEN OCR 수행 또는 수동 검토 요청

IF 등본 유형 신뢰도 낮음
  THEN 자동 가치평가 입력 생성 금지

IF 필수 필드 누락
  THEN 수동 검토 필요

IF 권리관계 리스크 키워드 존재
  THEN 가격 계산 모듈에 riskFlags 전달

IF 외부 데이터 소스가 유료 서비스 또는 무단 크롤링에 해당
  THEN 사용 금지

IF 모든 필수 필드와 신뢰도 기준 충족
  THEN ValuationInput 생성
```

---

## 18. 최종 산출물 기준

PDF 판독 모듈의 최종 산출물은 다음 세 가지다.

1. `RegistryParseResult`
   - PDF에서 추출한 전체 구조화 결과

2. `ValuationInput`
   - 향후 가치평가 계산에 넘길 최소 입력값

3. `ReviewTask`
   - 사람이 확인해야 할 필드와 사유

```ts
export type ReviewTask = {
  fileId: string;
  manualReviewRequired: boolean;
  reasons: string[];
  fieldsToReview: string[];
  createdAt: string;
};
```

---

## 19. 권장 개발 방향

초기에는 완전 자동화를 목표로 하지 않는다. 먼저 **정확히 읽고, 근거를 보여주고, 사람이 수정할 수 있는 PDF 판독 시스템**을 만든 뒤, 충분한 검증 데이터가 쌓였을 때 가치평가 계산 모듈을 연결하는 것이 안전하다.

특히 내부용이라도 등본에는 민감 정보가 포함될 수 있으므로, 파싱 정확도보다 **근거 추적성, 개인정보 최소화, 수동 검토 가능성, 합법 데이터 사용 원칙**을 우선한다.
