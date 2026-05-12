# Internal Registry PDF Reader MVP

회사 내부용 등본 PDF 판독 1차 구현입니다. Vercel + GitHub 배포를 전제로 한 Next.js App Router 프로젝트입니다.

## 구현 범위

- PDF 업로드 UI
- `/api/documents/parse` 백엔드 API
- PDF 파일 검증
- `pdf-parse` 기반 native text 추출
- OCR 필요 여부 판단
- 등본 키워드/구조 탐지
- 주소, 건물명, 동, 호수, 전유면적, 대지권 비율 추출 초안
- 근저당권, 압류, 가압류, 전세권/임차권, 신탁 리스크 플래그 탐지
- 개인정보 마스킹 텍스트 미리보기
- 가치평가 모듈로 넘길 `ValuationInput` placeholder 생성
- 금지 데이터 소스 정책 명시

## 디렉터리 구조

```txt
app/                         # Next.js 라우트와 API 엔드포인트
  api/documents/parse/route.ts
  upload/page.tsx
src/
  backend/                   # 서버 전용 로직
    pdf/                     # PDF 검증, 텍스트 추출, 파싱, 정규화
    compliance/              # PII 마스킹, 데이터 소스 정책
    valuation/               # 향후 가치평가 모듈 연결부
  frontend/                  # 클라이언트 UI 컴포넌트와 API 호출부
    components/
    lib/
  shared/                    # 프론트/백엔드 공용 타입
docs/                        # 설계 가이드라인
```

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000/upload` 접속 후 PDF를 업로드합니다.

## Vercel 배포

1. GitHub에 이 프로젝트를 push합니다.
2. Vercel에서 해당 repository를 Import합니다.
3. Framework Preset은 Next.js로 자동 인식됩니다.
4. 별도 환경변수 없이 1차 MVP 실행이 가능합니다.

## 현재 한계

- OCR 실제 수행은 아직 구현하지 않았고 필요 여부만 판단합니다.
- 좌표 기반 원문 근거 추적은 아직 없습니다. 현재는 텍스트 스니펫 중심입니다.
- 등본 서식마다 표현이 다를 수 있어 정규식 추출 정확도는 검증 데이터로 개선해야 합니다.
- 원본 PDF 저장, DB 저장, 수정 이력 저장은 포함하지 않았습니다.

## 금지 원칙

- KB부동산 등 유료 서비스의 무단 데이터 사용 금지
- 로그인 우회, 세션 자동화, 약관 위반 크롤링 금지
- 타사 화면 캡처 자동화 금지
- 개인정보 목적 외 저장 금지

## 다음 구현 후보

- OCR 엔진 연결
- 수동 수정 UI와 수정 이력 저장
- PostgreSQL JSONB 저장
- 필드별 confidence 개선
- 내부 거래 사례 또는 허가된 공공데이터 기반 가치평가 모듈 연결
