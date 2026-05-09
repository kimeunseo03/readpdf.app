import React, { useMemo, useState } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, ShieldCheck, Home, Database, Search, Loader2 } from "lucide-react";

const STEPS = [
  "PDF 등록",
  "텍스트 추출",
  "등본 구조 분석",
  "가치평가 필드 추출",
  "권리 리스크 분석",
  "결과 검토"
];

function normalizeText(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pick(regex, text, group = 1) {
  const match = text.match(regex);
  return match ? String(match[group] ?? "").trim() : null;
}

function parseKoreanMoney(value) {
  if (!value) return null;
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function parseNumber(value) {
  if (!value) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseHeaderAddress(text) {
  const header = pick(/\[집합건물\]\s*([^\n]+?)(?:\n|고유번호|열 람 용)/, text);
  if (!header) return {};

  const unit = header.match(/제(\d+)동\s+제(\d+)층\s+제(\d+)호/);
  const unitAlt = header.match(/제(\d+)동\s+제(\d+)층\s+제(\d+)호|제(\d+)층\s+제(\d+)호/);

  const sido = pick(/^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|충청북도|충청남도|전북특별자치도|전라남도|경상북도|경상남도|제주특별자치도)/, header);
  let rest = sido ? header.replace(sido, "").trim() : header;

  let sigungu = null;
  const sigunguMatch = rest.match(/^(.+?(?:시\s+[^\s]+구|시|군|구))/);
  if (sigunguMatch) {
    sigungu = sigunguMatch[1].trim();
    rest = rest.slice(sigunguMatch[0].length).trim();
  }

  const eupMyeonDong = pick(/^([^\s]+(?:읍|면|동))/, rest);
  if (eupMyeonDong) rest = rest.replace(eupMyeonDong, "").trim();

  const ri = pick(/^([^\s]+리)/, rest);
  if (ri) rest = rest.replace(ri, "").trim();

  const jibun = pick(/^([0-9]+(?:-[0-9]+)?)/, rest);
  if (jibun) rest = rest.replace(jibun, "").trim();

  const apartmentName = rest
    .replace(/제\d+동.*$/, "")
    .replace(/제\d+층\s+제\d+호.*$/, "")
    .trim() || null;

  return {
    raw_title_address: header,
    sido,
    sigungu,
    eup_myeon_dong: eupMyeonDong,
    ri,
    jibun,
    apartment_name: apartmentName,
    building_dong: unit?.[1] ? `${unit[1]}동` : unitAlt?.[4] ? null : null,
    unit_floor: parseNumber(unit?.[2] || unitAlt?.[5]),
    unit_ho: unit?.[3] ? `${unit[3]}호` : unitAlt?.[6] ? `${unitAlt[6]}호` : null
  };
}

function parseRoadAddress(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const idx = lines.findIndex((line) => line.includes("[도로명주소]"));
  if (idx === -1) return null;

  const collected = [];
  for (let i = idx; i < Math.min(idx + 5, lines.length); i++) {
    const cleaned = lines[i].replace("[도로명주소]", "").trim();
    if (cleaned) collected.push(cleaned);
    const joined = collected.join(" ");
    if (/\d+(?:-\d+)?$/.test(joined)) return joined;
  }
  return collected.join(" ") || null;
}

function parseExclusiveArea(text) {
  const section = pick(/【 표 제 부 】\s*\( 전유부분의 건물의 표시 \)([\s\S]*?)(?:\( 대지권의 표시 \)|【 갑 구 】)/, text);
  if (!section) return null;
  return parseNumber(pick(/([0-9]+(?:\.[0-9]+)?)\s*㎡/, section));
}

function parseLandRight(text) {
  const section = pick(/\( 대지권의 표시 \)([\s\S]*?)(?:【 갑 구 】)/, text);
  if (!section) return { denominator: null, numerator: null };

  const denominator = parseNumber(pick(/소유권대지권\s+([0-9]+(?:\.[0-9]+)?)\s*분의/, section));
  const numerator = parseNumber(pick(/분의\s*\n?\s*([0-9]+(?:\.[0-9]+)?)/, section));
  return { denominator, numerator };
}

function parseTotalFloors(text) {
  const buildingSection = pick(/【 표 제 부 】\s*\( 1동의 건물의 표시 \)([\s\S]*?)(?:\( 대지권의 목적인 토지의 표시 \)|【 표 제 부 】\s*\( 전유부분)/, text);
  if (!buildingSection) return null;
  const floors = [...buildingSection.matchAll(/(\d+)층\s+[0-9,.]+㎡/g)].map((m) => Number(m[1]));
  return floors.length ? Math.max(...floors) : parseNumber(pick(/([0-9]+)층\s*공동주택/, buildingSection));
}

function parseUseTypeAndStructure(text) {
  const buildingSection = pick(/【 표 제 부 】\s*\( 1동의 건물의 표시 \)([\s\S]*?)(?:\( 대지권의 목적인 토지의 표시 \)|【 표 제 부 】\s*\( 전유부분)/, text) || "";
  const structure = pick(/(철근콘크리트(?:구조|조)|벽식구조|라멘조|철골철근콘크리트조|철골조)/, buildingSection);
  const useType = pick(/(공동주택\(아파트\)|아파트|점포 및 아파트|공동주택)/, buildingSection);
  return { structure, use_type: useType };
}

function parseLatestOwnership(text) {
  const gapgu = pick(/【 갑 구 】[\s\S]*?권리자 및 기타사항([\s\S]*?)(?:【 을 구 】|$)/, text) || "";
  const ownerMatches = [...gapgu.matchAll(/소유자\s+([^\s]+)\s+\d{6}-\*+/g)];
  const priceMatches = [...gapgu.matchAll(/거래가액\s+금\s*([0-9,]+)원/g)];
  const transferMatches = [...gapgu.matchAll(/소유권이전\s+([0-9년월일]+)\s+([0-9년월일]+)\s+소유자\s+([^\s]+)[\s\S]{0,80}?(매매|상속|증여)?/g)];
  const latestTransfer = transferMatches[transferMatches.length - 1];

  return {
    current_owner: ownerMatches.length ? ownerMatches[ownerMatches.length - 1][1] : null,
    latest_transaction_price: priceMatches.length ? parseKoreanMoney(priceMatches[priceMatches.length - 1][1]) : null,
    latest_transaction_date: latestTransfer?.[1] || null,
    latest_transaction_cause: latestTransfer?.[4] || null
  };
}

function parseRights(text) {
  const eulgu = pick(/【 을 구 】[\s\S]*?권리자 및 기타사항([\s\S]*?)(?:관할등기소|-- 이 하 여 백 --|주요 등기사항 요약|$)/, text) || "";
  const mortgageMatches = [...eulgu.matchAll(/(?:^|\n)\s*(\d+)\s+근저당권설정[\s\S]{0,180}?채권최고액\s+금\s*([0-9,]+)원[\s\S]{0,250}?(?:근저당권자\s+([^\n]+))?/g)];
  const cancelMatches = [...eulgu.matchAll(/(?:^|\n)\s*(\d+)\s+(\d+)번근저당권설정등?\s*\n?기말소|(?:^|\n)\s*(\d+)\s+(\d+)번근저당권설정.*?말소/g)];
  const cancelledRanks = new Set(cancelMatches.map((m) => m[2] || m[4]).filter(Boolean));

  const mortgages = mortgageMatches.map((m) => ({
    rank_no: m[1],
    amount: parseKoreanMoney(m[2]),
    creditor: m[3]?.trim() || null,
    active: !cancelledRanks.has(m[1])
  }));

  const active_mortgages = mortgages.filter((m) => m.active);
  const cancelled_mortgages = mortgages.filter((m) => !m.active);

  const gapgu = pick(/【 갑 구 】[\s\S]*?권리자 및 기타사항([\s\S]*?)(?:【 을 구 】|$)/, text) || "";
  const hasActiveSeizure = /압류/.test(gapgu) && !/압류.*말소|압류해제|해제/.test(gapgu);
  const hasAuctionHistory = /경매개시결정|강제경매개시결정/.test(gapgu);
  const hasActiveAuction = hasAuctionHistory && !/경매개시결정등기말소|취하/.test(gapgu);

  return {
    active_mortgages,
    cancelled_mortgages,
    seizure_records: /압류/.test(gapgu) ? [{ type: "압류", active: hasActiveSeizure }] : [],
    auction_records: hasAuctionHistory ? [{ type: "경매개시결정", active: hasActiveAuction }] : [],
    lease_rights: /전세권|임차권/.test(eulgu) ? [{ type: "전세권/임차권", active: true }] : []
  };
}

function parseRegistryText(rawText, pageCount) {
  const text = normalizeText(rawText);
  const header = parseHeaderAddress(text);
  const land = parseLandRight(text);
  const typeAndStructure = parseUseTypeAndStructure(text);
  const ownership = parseLatestOwnership(text);
  const rights = parseRights(text);

  const flags = [];
  if (rights.active_mortgages.length) flags.push(`말소되지 않은 근저당 ${rights.active_mortgages.length}건`);
  if (rights.seizure_records.some((r) => r.active)) flags.push("활성 압류 가능성");
  if (rights.auction_records.some((r) => r.active)) flags.push("활성 경매개시결정 가능성");
  if (rights.auction_records.some((r) => !r.active)) flags.push("과거 경매 이력");
  if (rights.seizure_records.some((r) => !r.active)) flags.push("과거 압류 이력");
  if (!header.sido || !header.sigungu || !header.jibun || !parseExclusiveArea(text)) flags.push("가치평가 필수 필드 누락");

  const riskLevel = flags.some((f) => f.includes("활성"))
    ? "high"
    : rights.active_mortgages.length || rights.auction_records.length || rights.seizure_records.length
      ? "medium"
      : flags.length
        ? "review_required"
        : "low";

  const confidenceParts = [
    header.sido,
    header.sigungu,
    header.jibun,
    header.unit_ho,
    parseExclusiveArea(text),
    land.denominator,
    land.numerator,
    typeAndStructure.use_type,
    typeAndStructure.structure
  ];
  const confidence = confidenceParts.filter(Boolean).length / confidenceParts.length;

  return {
    document: {
      type: pick(/(등기사항전부증명서)/, text),
      building_type: pick(/-\s*(집합건물)\s*-/, text) || "집합건물",
      registry_id: pick(/고유번호\s+([0-9-]+)/, text),
      view_datetime: pick(/열람일시\s*:\s*([^\n]+)/, text),
      page_count: pageCount,
      confidence: Number(confidence.toFixed(2))
    },
    valuation_input: {
      sido: header.sido,
      sigungu: header.sigungu,
      eup_myeon_dong: header.eup_myeon_dong,
      ri: header.ri,
      jibun: header.jibun,
      road_address: parseRoadAddress(text),
      apartment_name: header.apartment_name,
      building_dong: header.building_dong,
      unit_floor: header.unit_floor,
      unit_ho: header.unit_ho,
      total_floors: parseTotalFloors(text),
      exclusive_area_m2: parseExclusiveArea(text),
      land_right_ratio_denominator: land.denominator,
      land_right_ratio_numerator: land.numerator,
      use_type: typeAndStructure.use_type,
      structure: typeAndStructure.structure,
      latest_transaction_price: ownership.latest_transaction_price,
      latest_transaction_date: ownership.latest_transaction_date,
      latest_transaction_cause: ownership.latest_transaction_cause
    },
    rights: {
      current_owner: ownership.current_owner,
      ...rights
    },
    risk: {
      level: riskLevel,
      flags: flags.length ? flags : ["특이 권리 리스크 미탐지"]
    },
    raw_text_preview: text.slice(0, 3000)
  };
}

async function extractPdfText(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    pages.push(`\n--- PAGE ${pageNo} ---\n${text}`);
  }

  return { text: pages.join("\n"), pageCount: pdf.numPages };
}

function formatWon(value) {
  if (value === null || value === undefined) return "-";
  return `${Number(value).toLocaleString("ko-KR")}원`;
}

function Field({ label, value, warn }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 break-words text-sm font-semibold ${warn ? "text-amber-700" : "text-slate-900"}`}>{value ?? "-"}</div>
    </div>
  );
}

function JsonBlock({ data }) {
  return (
    <pre className="max-h-[520px] overflow-auto rounded-2xl bg-slate-950 p-5 text-xs leading-relaxed text-slate-100 shadow-inner">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function RegistryPdfExtractorPrototype() {
  const [file, setFile] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const status = useMemo(() => {
    if (isProcessing) return "processing";
    if (!file) return "idle";
    if (!result) return "ready";
    return "done";
  }, [file, result, isProcessing]);

  const processFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setActiveStep(1);
    setLog(["PDF 파일 등록 확인", "브라우저에서 PDF 텍스트 레이어 추출 시작"]);

    try {
      const extracted = await extractPdfText(file);
      setActiveStep(2);
      setLog((prev) => [...prev, `${extracted.pageCount}개 페이지 텍스트 추출 완료`, "표제부 / 갑구 / 을구 구조 분석 시작"]);

      const parsed = parseRegistryText(extracted.text, extracted.pageCount);
      setActiveStep(5);
      setResult(parsed);
      setLog((prev) => [
        ...prev,
        "가치평가 필수 항목 추출 완료",
        "말소사항 포함 권리관계 분석 완료",
        "JSON 결과 생성 완료"
      ]);
    } catch (err) {
      console.error(err);
      setError("PDF 텍스트 추출에 실패했습니다. 스캔본이거나 브라우저 PDF 파서가 읽을 수 없는 형식일 수 있습니다. 이 경우 서버 OCR 파이프라인이 필요합니다.");
      setActiveStep(1);
      setLog((prev) => [...prev, "텍스트 추출 실패"]);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setActiveStep(0);
    setLog([]);
    setError(null);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-4 w-4" /> 내부 PoC · 클라이언트 PDF 판독
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight">등기부등본 PDF 추출 콘솔</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                PDF를 브라우저에서 직접 읽고, 등기사항전부증명서의 표제부·갑구·을구에서 아파트 가치평가 필수 입력값과 권리 리스크를 추출합니다.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white">
              <div className="text-xs text-slate-300">현재 상태</div>
              <div className="mt-1 text-lg font-semibold">
                {status === "idle" && "PDF 대기"}
                {status === "ready" && "처리 준비"}
                {status === "processing" && "추출 중"}
                {status === "done" && "추출 완료"}
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-6">
          {STEPS.map((step, index) => (
            <div key={step} className={`rounded-2xl border p-4 ${index <= activeStep ? "border-slate-900 bg-white" : "border-slate-200 bg-slate-100"}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {index < activeStep || result ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-slate-400" />}
                {index + 1}. {step}
              </div>
            </div>
          ))}
        </section>

        <main className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Upload className="h-5 w-5" /> PDF 등록</h2>
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:bg-slate-100">
                <FileText className="h-10 w-10 text-slate-500" />
                <span className="mt-3 text-sm font-semibold">등기부등본 PDF 선택</span>
                <span className="mt-1 text-xs text-slate-500">전자 텍스트가 있는 PDF를 우선 지원합니다.</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) {
                      setFile(selected);
                      setResult(null);
                      setError(null);
                      setActiveStep(0);
                      setLog(["PDF 등록 완료"]);
                    }
                  }}
                />
              </label>

              {file && (
                <div className="mt-4 rounded-2xl bg-slate-100 p-4 text-sm">
                  <div className="font-semibold">{file.name}</div>
                  <div className="mt-1 text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  onClick={processFile}
                  disabled={!file || isProcessing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                  추출 실행
                </button>
                <button onClick={reset} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">
                  초기화
                </button>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Search className="h-5 w-5" /> 처리 로그</h2>
              <div className="mt-4 space-y-3">
                {log.length === 0 ? (
                  <div className="text-sm text-slate-500">아직 처리 로그가 없습니다.</div>
                ) : log.map((item, idx) => (
                  <div key={idx} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            {!result ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
                <div>
                  <Home className="mx-auto h-12 w-12 text-slate-400" />
                  <h2 className="mt-4 text-xl font-bold">추출 결과 대기</h2>
                  <p className="mt-2 text-sm text-slate-500">PDF를 등록하고 추출 실행을 누르면 실제 PDF 텍스트에서 추출한 결과가 표시됩니다.</p>
                </div>
              </div>
            ) : (
              <>
                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-bold"><Database className="h-5 w-5" /> 가치평가 필수 항목</h2>
                      <p className="mt-1 text-sm text-slate-500">이 영역의 필드만 가치평가 엔진 입력값으로 승격합니다.</p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-xs font-bold ${result.risk.level === "low" ? "bg-emerald-100 text-emerald-700" : result.risk.level === "medium" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                      risk: {result.risk.level}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="시도" value={result.valuation_input.sido} />
                    <Field label="시군구" value={result.valuation_input.sigungu} />
                    <Field label="읍면동/리" value={`${result.valuation_input.eup_myeon_dong || ""} ${result.valuation_input.ri || ""}`.trim()} />
                    <Field label="지번" value={result.valuation_input.jibun} />
                    <Field label="도로명주소" value={result.valuation_input.road_address} />
                    <Field label="아파트명" value={result.valuation_input.apartment_name} />
                    <Field label="동/호" value={`${result.valuation_input.building_dong || "-"} ${result.valuation_input.unit_ho || ""}`} />
                    <Field label="층/총층" value={`${result.valuation_input.unit_floor ?? "-"}층 / ${result.valuation_input.total_floors ?? "-"}층`} />
                    <Field label="전유면적" value={result.valuation_input.exclusive_area_m2 ? `${result.valuation_input.exclusive_area_m2}㎡` : "-"} />
                    <Field label="대지권비율" value={`${result.valuation_input.land_right_ratio_denominator ?? "-"}분의 ${result.valuation_input.land_right_ratio_numerator ?? "-"}`} />
                    <Field label="용도" value={result.valuation_input.use_type} />
                    <Field label="구조" value={result.valuation_input.structure} />
                    <Field label="최근 거래가액" value={formatWon(result.valuation_input.latest_transaction_price)} warn={!result.valuation_input.latest_transaction_price} />
                    <Field label="최근 거래일/원인" value={`${result.valuation_input.latest_transaction_date || "-"} / ${result.valuation_input.latest_transaction_cause || "-"}`} />
                    <Field label="현재 소유자" value={result.rights.current_owner} />
                    <Field label="판독 신뢰도" value={`${Math.round((result.document.confidence || 0) * 100)}%`} />
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle className="h-5 w-5" /> 권리 리스크</h2>
                    <div className="mt-4 space-y-3">
                      {result.risk.flags.map((flag, idx) => (
                        <div key={idx} className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">{flag}</div>
                      ))}
                      {result.rights.active_mortgages.length === 0 ? (
                        <div className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">활성 근저당 없음</div>
                      ) : result.rights.active_mortgages.map((m, idx) => (
                        <div key={idx} className="rounded-xl bg-slate-50 p-3 text-sm">
                          <div className="font-semibold">근저당 {m.rank_no}번</div>
                          <div className="mt-1 text-slate-600">채권최고액 {formatWon(m.amount)} · {m.creditor || "권리자 미상"}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <h2 className="text-lg font-bold">문서 메타</h2>
                    <div className="mt-4 grid gap-3">
                      <Field label="문서 유형" value={result.document.type} />
                      <Field label="건물 유형" value={result.document.building_type} />
                      <Field label="고유번호" value={result.document.registry_id} />
                      <Field label="열람일시" value={result.document.view_datetime} />
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h2 className="text-lg font-bold">원본 JSON</h2>
                  <p className="mt-1 text-sm text-slate-500">실제 PDF 텍스트에서 추출한 API 응답 후보입니다.</p>
                  <div className="mt-4"><JsonBlock data={result} /></div>
                </section>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
