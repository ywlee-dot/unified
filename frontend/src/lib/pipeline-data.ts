// Pipeline diagram data — 9 project E2E pipelines for React Flow rendering
// Design: NODE_TYPE_STYLES and RUNTIME_STYLES are statically defined for Tailwind build safety

import type { Node, Edge } from "@xyflow/react";

// ─── Types ───

export type PipelineNodeType = "input" | "process" | "service" | "storage" | "output";
export type RuntimeService = "nextjs" | "fastapi" | "n8n" | "postgres" | "redis" | "external";

export type ArchitectureLayerType = "frontend" | "backend" | "external" | "data" | "n8n" | "ep" | "ads";

export interface PipelineNodeData {
  label: string;
  sublabel?: string;
  nodeType: PipelineNodeType;
  runtime: RuntimeService;
  runtimeLabel?: string;
  icon?: string;
  techStack?: string[];
  [key: string]: unknown;
}

export interface PipelineGraphNode {
  label: string;
  conditional?: boolean;
  step?: number;
}

export interface PipelineGraphEdge {
  from: [number, number];
  to: [number, number];
  label?: string;
  srcPort?: "left" | "right" | "top" | "bottom";
  tgtPort?: "left" | "right" | "top" | "bottom";
}

export interface PipelineGraph {
  rows: (PipelineGraphNode | null)[][];
  edges: PipelineGraphEdge[];
}

export interface ProjectPipeline {
  slug: string;
  name: string;
  description: string;
  projectType: "standard" | "n8n";
  nodes: Node[];
  edges: Edge[];
  infraServices: string[];
  pipelineGraph?: PipelineGraph;
  color?: string;
}

// ─── Style Constants ───

export const NODE_TYPE_STYLES: Record<PipelineNodeType, { bg: string; border: string; text: string; iconName: string }> = {
  input:   { bg: "bg-blue-50",    border: "border-l-blue-500",    text: "text-blue-700",    iconName: "upload" },
  process: { bg: "bg-purple-50",  border: "border-l-purple-500",  text: "text-purple-700",  iconName: "cpu" },
  service: { bg: "bg-green-50",   border: "border-l-green-500",   text: "text-green-700",   iconName: "server" },
  storage: { bg: "bg-amber-50",   border: "border-l-amber-500",   text: "text-amber-700",   iconName: "database" },
  output:  { bg: "bg-emerald-50", border: "border-l-emerald-500", text: "text-emerald-700", iconName: "check-circle" },
};

export const RUNTIME_STYLES: Record<RuntimeService, { color: string; label: string }> = {
  nextjs:   { color: "bg-slate-600",  label: "Next.js" },
  fastapi:  { color: "bg-green-600",  label: "FastAPI" },
  n8n:      { color: "bg-orange-600", label: "n8n" },
  postgres: { color: "bg-purple-600", label: "PostgreSQL" },
  redis:    { color: "bg-red-600",    label: "Redis" },
  external: { color: "bg-cyan-600",   label: "External" },
};

// ─── Helpers ───

const X_GAP = 260;
const Y_ROW = 0;

function makeNode(
  id: string,
  label: string,
  nodeType: PipelineNodeType,
  runtime: RuntimeService,
  col: number,
  row: number = Y_ROW,
  opts?: { sublabel?: string; runtimeLabel?: string; icon?: string }
): Node<PipelineNodeData> {
  return {
    id,
    type: "pipelineNode",
    position: { x: col * X_GAP, y: row * 120 },
    data: {
      label,
      sublabel: opts?.sublabel,
      nodeType,
      runtime,
      runtimeLabel: opts?.runtimeLabel,
      icon: opts?.icon,
    },
  };
}

function makeEdge(
  source: string,
  target: string,
  opts?: { label?: string; animated?: boolean; dashed?: boolean; sourceHandle?: string; targetHandle?: string }
): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "smoothstep",
    label: opts?.label,
    animated: opts?.animated,
    style: opts?.dashed ? { strokeDasharray: "6 4" } : undefined,
    markerEnd: { type: "arrowclosed" as const },
    ...(opts?.sourceHandle && { sourceHandle: opts.sourceHandle }),
    ...(opts?.targetHandle && { targetHandle: opts.targetHandle }),
  };
}

function makeLayerGroup(
  id: string,
  label: string,
  sublabel: string,
  layerType: ArchitectureLayerType,
  x: number,
  y: number,
  width: number,
  height: number,
): Node {
  return {
    id,
    type: "layerGroup",
    position: { x, y },
    data: { label, sublabel, layerType },
    style: { width, height },
    selectable: false,
    draggable: false,
    connectable: false,
    focusable: false,
  } as Node;
}

function makeLayerNode(
  id: string,
  label: string,
  nodeType: PipelineNodeType,
  runtime: RuntimeService,
  parentId: string,
  x: number,
  y: number,
  opts?: { sublabel?: string; runtimeLabel?: string; icon?: string; techStack?: string[] }
): Node<PipelineNodeData> {
  return {
    id,
    type: "pipelineNode",
    parentId,
    position: { x, y },
    data: {
      label,
      sublabel: opts?.sublabel,
      nodeType,
      runtime,
      runtimeLabel: opts?.runtimeLabel,
      icon: opts?.icon,
      techStack: opts?.techStack,
    },
  };
}

function makeStepLayerNode(
  id: string,
  label: string,
  step: number | undefined,
  color: string,
  parentId: string | undefined,
  x: number,
  y: number,
  opts?: { sublabel?: string }
): Node {
  const node: Record<string, unknown> = {
    id,
    type: "stepNode",
    position: { x, y },
    data: { label, step, color, sublabel: opts?.sublabel },
  };
  if (parentId !== undefined) node.parentId = parentId;
  return node as Node;
}

// ─── 1. dataset-summary (standard) ───

const datasetSummary: ProjectPipeline = {
  slug: "dataset-summary",
  name: "데이터셋 설명 생성",
  description: "Excel/CSV 파일에서 키워드 8개 + 설명을 자동 생성하는 E2E 파이프라인",
  projectType: "standard",
  nodes: [
    // Architecture layer groups
    makeLayerGroup("ds-l-fe", "Frontend", "Next.js :3000 · Docker: frontend", "frontend", 0, 0, 950, 150),
    makeLayerGroup("ds-l-be", "Backend", "FastAPI :8000 · Docker: backend", "backend", 0, 190, 950, 150),
    makeLayerGroup("ds-l-ext", "External", "Third-party APIs", "external", 0, 380, 950, 150),
    // Pipeline nodes within layers
    makeLayerNode("ds-upload", "Excel/CSV 업로드", "input", "nextjs", "ds-l-fe", 80, 40,
      { sublabel: "POST /summarize", icon: "upload", techStack: ["React", "Dropzone"] }),
    makeLayerNode("ds-parse", "행 파싱", "process", "fastapi", "ds-l-be", 80, 40,
      { sublabel: "openpyxl · pandas", techStack: ["openpyxl", "pandas"] }),
    makeLayerNode("ds-llm", "Gemini LLM 분석", "process", "external", "ds-l-ext", 380, 40,
      { runtimeLabel: "Gemini API", icon: "sparkles", techStack: ["google-generativeai"] }),
    makeLayerNode("ds-gen", "키워드 + 설명 생성", "process", "fastapi", "ds-l-be", 380, 40,
      { sublabel: "8 keywords + summary", techStack: ["Pydantic"] }),
    makeLayerNode("ds-output", "JSON 응답 반환", "output", "fastapi", "ds-l-be", 680, 40,
      { sublabel: "ApiResponse<T>", icon: "check-circle" }),
  ],
  edges: [
    makeEdge("ds-upload", "ds-parse", { label: "HTTP POST multipart", sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ds-parse", "ds-llm", { label: "Gemini SDK 호출" }),
    makeEdge("ds-llm", "ds-gen", { label: "LLM 결과", sourceHandle: "source-top", targetHandle: "target-bottom", dashed: true }),
    makeEdge("ds-gen", "ds-output", { label: "내부 호출" }),
  ],
  infraServices: [],
};

// ─── 2. open-data-analyzer — 수직 스윔레인 4개 + 의미론적 인프라 배치 ───

const ODA_COLOR = "#3182f6"; // 블루: 개방가능여부 판단
const ADS_COLOR = "#06b6d4"; // 시안: AI 데이터셋 정의
const DP_COLOR  = "#f59e0b"; // 앰버: 데이터 파이프라인
const EP_COLOR  = "#10b981"; // 에메랄드: 공유데이터 제공 노력

// 스윔레인 배치 (ODA | ADS[2컬럼] | DP | EP) — 공간 충분히 확보
const ODA_X = 0;
const ADS_X = 440;   // gap1 = 220px (Gemini 여유 35px)
const DP_X  = 1000;  // ADS 490px 수용
const EP_X  = 1400;  // gap3 = 180px (n8n·PG 중앙 배치)
const SW_W     = 220;
const SW_W_ADS = 490;  // ADS 메인+브랜치+여백
const SW_H     = 830;  // ODA/DP/EP 본연 높이
const SW_H_ADS = 1010; // ADS 10단계 수용
const NX    = 20;
const NX_A  = 15;
const NX_B  = 280;  // 브랜치 컬럼 — 메인과 85px 간격 (삼각 엣지 공간)

// 단계 Y 좌표
const OY = { up: 60, ex: 180, an: 370, js: 550, xl: 720 };
const AY = { p1: 60, p2: 160, p3: 260, p4: 360, p5: 460, p6: 560, p7: 590, p8: 720, p9: 820, p10: 920 };
const DY = { tr: 60, wh: 200, et: 340, tf: 460, cb: 580, st: 730 };
const EY = { up: 60, wh: 200, wf: 360, cb: 510, ou: 690 };

// 공용 인프라 절대 좌표 — 양쪽 파이프라인에서 35px+ 여유
const GEM_X = 240,  GEM_Y = OY.an;   // (240, 370) — ODA와 40px, ADS와 35px
const N8N_X = 1220, N8N_Y = DY.wh;   // (1220, 200) — DP·EP 사이 중앙
const PG_X  = 1220, PG_Y  = DY.st;   // (1220, 730)

const openDataAnalyzer: ProjectPipeline = {
  slug: "open-data-analyzer",
  name: "ODA · ADS · DP · EP 통합 아키텍처",
  description: "개방가능여부 판단 + AI 데이터셋 정의 + 데이터 파이프라인 + 공유데이터 제공 노력 — 공용 인프라(Gemini·n8n·PostgreSQL)를 사용 단계 높이에 배치",
  projectType: "standard",
  nodes: [
    // 스윔레인 배경
    makeLayerGroup("sw-oda", "개방가능여부 판단",    "FastAPI · Gemini AI",  "frontend", ODA_X, 0, SW_W, SW_H),
    makeLayerGroup("sw-ads", "AI 데이터셋 정의",     "FastAPI · Gemini AI",  "ads",      ADS_X, 0, SW_W_ADS, SW_H_ADS),
    makeLayerGroup("sw-dp",  "데이터 파이프라인",    "FastAPI · n8n ETL",    "n8n",      DP_X,  0, SW_W, SW_H),
    makeLayerGroup("sw-ep",  "공유데이터 제공 노력", "FastAPI · n8n 분석",   "ep",       EP_X,  0, SW_W, SW_H),

    // ODA 파이프라인
    makeStepLayerNode("oda-upload",  "Excel 업로드",     1, ODA_COLOR, "sw-oda", NX, OY.up, { sublabel: "POST /stage1" }),
    makeStepLayerNode("oda-extract", "테이블 추출/병합", 2, ODA_COLOR, "sw-oda", NX, OY.ex, { sublabel: "openpyxl" }),
    makeStepLayerNode("oda-analyze", "Gemini AI 분석",   3, ODA_COLOR, "sw-oda", NX, OY.an, { sublabel: "5단계 순차 호출" }),
    makeStepLayerNode("oda-json",    "최종 판정 JSON",   4, ODA_COLOR, "sw-oda", NX, OY.js, { sublabel: "ApiResponse<T>" }),
    makeStepLayerNode("oda-excel",   "Excel Export",     5, ODA_COLOR, "sw-oda", NX, OY.xl, { sublabel: "5개 시트" }),

    // ADS 파이프라인 (10단계 — 메인 컬럼 9단계 + 브랜치 컬럼의 step 7)
    makeStepLayerNode("ads-1",  "수요분석 및 후보 도출", 1,  ADS_COLOR, "sw-ads", NX_A, AY.p1),
    makeStepLayerNode("ads-2",  "후보 목록 정의",        2,  ADS_COLOR, "sw-ads", NX_A, AY.p2),
    makeStepLayerNode("ads-3",  "데이터 적합성 평가",    3,  ADS_COLOR, "sw-ads", NX_A, AY.p3, { sublabel: "AI 평가" }),
    makeStepLayerNode("ads-4",  "데이터셋 범위 확정",    4,  ADS_COLOR, "sw-ads", NX_A, AY.p4),
    makeStepLayerNode("ads-5",  "AI 데이터셋 설계",      5,  ADS_COLOR, "sw-ads", NX_A, AY.p5, { sublabel: "AI 설계 지원" }),
    makeStepLayerNode("ads-6",  "비식별·가명 처리",      6,  ADS_COLOR, "sw-ads", NX_A, AY.p6),
    makeStepLayerNode("ads-7",  "데이터 품질 점검",      7,  ADS_COLOR, "sw-ads", NX_B, AY.p7, { sublabel: "QC 브랜치" }),  // 브랜치 컬럼
    makeStepLayerNode("ads-8",  "오류데이터 정제",       8,  ADS_COLOR, "sw-ads", NX_A, AY.p8),
    makeStepLayerNode("ads-9",  "AI 메타데이터 정의",    9,  ADS_COLOR, "sw-ads", NX_A, AY.p9, { sublabel: "AI 메타 생성" }),
    makeStepLayerNode("ads-10", "데이터셋 정의 완성",    10, ADS_COLOR, "sw-ads", NX_A, AY.p10),

    // DP 파이프라인
    makeStepLayerNode("dp-trigger",   "스케줄/수동 트리거", 1, DP_COLOR, "sw-dp", NX, DY.tr, { sublabel: "POST /trigger/{id}" }),
    makeStepLayerNode("dp-webhook",   "n8n Webhook",        2, DP_COLOR, "sw-dp", NX, DY.wh, { sublabel: "webhook 실행 요청" }),
    makeStepLayerNode("dp-etl",       "ETL 워크플로우",     3, DP_COLOR, "sw-dp", NX, DY.et, { sublabel: "etl-daily / sync" }),
    makeStepLayerNode("dp-transform", "데이터 변환",        4, DP_COLOR, "sw-dp", NX, DY.tf, { sublabel: "변환 처리" }),
    makeStepLayerNode("dp-callback",  "콜백 수신",          5, DP_COLOR, "sw-dp", NX, DY.cb, { sublabel: "/api/webhooks/n8n" }),
    makeStepLayerNode("dp-status",    "상태 업데이트",      6, DP_COLOR, "sw-dp", NX, DY.st),

    // EP 파이프라인
    makeStepLayerNode("ep-upload",   "파일 업로드",     1, EP_COLOR, "sw-ep", NX, EY.up, { sublabel: "multipart/form-data" }),
    makeStepLayerNode("ep-webhook",  "n8n Webhook",     2, EP_COLOR, "sw-ep", NX, EY.wh, { sublabel: "webhook 실행 요청" }),
    makeStepLayerNode("ep-workflow", "분석 워크플로우", 3, EP_COLOR, "sw-ep", NX, EY.wf),
    makeStepLayerNode("ep-callback", "콜백 수신",       4, EP_COLOR, "sw-ep", NX, EY.cb, { sublabel: "/api/webhooks/n8n" }),
    makeStepLayerNode("ep-output",   "분석 결과",       5, EP_COLOR, "sw-ep", NX, EY.ou),

    // 공용 인프라 (절대 좌표)
    makeStepLayerNode("shared-gemini",   "Gemini API",       undefined, "#7c3aed", undefined, GEM_X, GEM_Y, { sublabel: "gemini-2.5-flash · 다중 호출" }),
    makeStepLayerNode("shared-n8n",      "n8n :5678",        undefined, "#ea580c", undefined, N8N_X, N8N_Y, { sublabel: "webhook · 비동기 처리" }),
    makeStepLayerNode("shared-postgres", "PostgreSQL :5432", undefined, "#b45309", undefined, PG_X,  PG_Y,  { sublabel: "결과·이력 저장소" }),
  ],
  edges: [
    // ODA 수직 흐름
    makeEdge("oda-upload",  "oda-extract",  { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("oda-extract", "oda-analyze",  { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("oda-analyze", "oda-json",     { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("oda-json",    "oda-excel",    { sourceHandle: "source-bottom", targetHandle: "target-top" }),

    // ADS 메인 컬럼 수직 흐름 (1→2→3→4→5→6, 그리고 8→9→10)
    makeEdge("ads-1", "ads-2", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ads-2", "ads-3", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ads-3", "ads-4", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ads-4", "ads-5", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ads-5", "ads-6", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ads-8", "ads-9", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ads-9", "ads-10", { sourceHandle: "source-bottom", targetHandle: "target-top" }),

    // 5-6-7 삼각 분기 — step 7은 브랜치 컬럼, 각 엣지가 서로 다른 핸들로 겹침 방지
    // 5→7: ads-5 우측 상단 → ads-7 좌상단
    makeEdge("ads-5", "ads-7", { label: "직접 QC 투입", sourceHandle: "source-right-top", targetHandle: "target-top-left", dashed: true, animated: true }),
    // 6→7: ads-6 우측 → ads-7 좌측 (수평)
    makeEdge("ads-6", "ads-7", { label: "QC 진입",       sourceHandle: "source-right",     targetHandle: "target-left-top" }),
    // 7→5: ads-7 좌상단 → ads-5 우측 하단 (루프백 상단)
    makeEdge("ads-7", "ads-5", { label: "QC 실패·재설계", sourceHandle: "source-left-top",  targetHandle: "target-right-bot", dashed: true, animated: true }),
    // 7→8: ads-7 하단 → ads-8 우측 상단 (다시 메인으로)
    makeEdge("ads-7", "ads-8", { label: "QC 통과",       sourceHandle: "source-bottom",    targetHandle: "target-right-top" }),

    // ADS 3→1 적합성 실패 루프백 (우측 바깥으로 곡선 — 상단 오프셋으로 다른 right 엣지와 구분)
    makeEdge("ads-3", "ads-1", { label: "적합성 실패·재탐색", sourceHandle: "source-right-bot", targetHandle: "target-right-top", dashed: true, animated: true }),

    // DP 수직 흐름
    makeEdge("dp-trigger",   "dp-webhook",   { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("dp-webhook",   "dp-etl",       { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("dp-etl",       "dp-transform", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("dp-transform", "dp-callback",  { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("dp-callback",  "dp-status",    { sourceHandle: "source-bottom", targetHandle: "target-top" }),

    // EP 수직 흐름
    makeEdge("ep-upload",   "ep-webhook",  { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ep-webhook",  "ep-workflow", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ep-workflow", "ep-callback", { sourceHandle: "source-bottom", targetHandle: "target-top" }),
    makeEdge("ep-callback", "ep-output",   { sourceHandle: "source-bottom", targetHandle: "target-top" }),

    // ODA ↔ Gemini 순환 (5회 반복 호출)
    makeEdge("oda-analyze",   "shared-gemini", { label: "API 호출 ×5", dashed: true }),
    makeEdge("shared-gemini", "oda-analyze",   { label: "결과 수신", sourceHandle: "source-top", targetHandle: "target-top", dashed: true, animated: true }),

    // ADS → Gemini (3개 AI 집약 단계 — 각자 Gemini 우측 다른 위치로 진입: 상/중/하)
    makeEdge("ads-3", "shared-gemini", { label: "적합성 AI 평가", sourceHandle: "source-left", targetHandle: "target-right-top", dashed: true }),
    makeEdge("ads-5", "shared-gemini", { label: "설계 AI 지원",   sourceHandle: "source-left", targetHandle: "target-right",     dashed: true }),
    makeEdge("ads-9", "shared-gemini", { label: "메타 자동 생성", sourceHandle: "source-left", targetHandle: "target-right-bot", dashed: true }),

    // DP ↔ n8n 비동기 (n8n 하단 좌측으로 콜백 — 2개 스프레드)
    makeEdge("dp-webhook",  "shared-n8n", { label: "webhook 실행", dashed: true }),
    makeEdge("shared-n8n",  "dp-callback", { label: "결과 콜백", sourceHandle: "source-bottom-left", targetHandle: "target-top", dashed: true, animated: true }),

    // EP ↔ n8n 비동기 (n8n 하단 우측으로 콜백)
    makeEdge("ep-webhook",  "shared-n8n", { label: "webhook 실행", sourceHandle: "source-left", targetHandle: "target-right", dashed: true }),
    makeEdge("shared-n8n",  "ep-callback", { label: "결과 콜백", sourceHandle: "source-bottom-right", targetHandle: "target-top", dashed: true, animated: true }),

    // 저장 → PostgreSQL
    makeEdge("dp-status", "shared-postgres", { label: "실행이력 저장", dashed: true }),
    makeEdge("ep-output", "shared-postgres", { label: "결과 저장", sourceHandle: "source-left", targetHandle: "target-right", dashed: true }),
  ],
  infraServices: ["Gemini API (gemini-2.5-flash)", "n8n :5678", "PostgreSQL :5432"],
};

// ─── 3. gov-news-crawler (standard) ───

const govNewsCrawler: ProjectPipeline = {
  slug: "gov-news-crawler",
  name: "정부 뉴스 크롤링",
  description: "RSS/HTML 소스에서 정부 뉴스를 크롤링하고 규칙+AI로 스코어링",
  projectType: "standard",
  nodes: [
    makeNode("gnc-kw", "키워드/소스 설정", "input", "fastapi", 0, 0, { sublabel: "CRUD 엔드포인트", icon: "settings" }),
    makeNode("gnc-crawl", "RSS/HTML 크롤링", "process", "fastapi", 1, 0, { sublabel: "feedparser + scraper" }),
    makeNode("gnc-dedup", "중복 제거", "process", "fastapi", 2, 0, { sublabel: "URL hash + 제목 유사도" }),
    makeNode("gnc-entity", "엔티티 추출", "process", "fastapi", 3, 0, { sublabel: "기관명/리더명" }),
    makeNode("gnc-score", "규칙 + AI 스코어링", "process", "external", 4, 0, { runtimeLabel: "Gemini API (선택)", icon: "sparkles" }),
    makeNode("gnc-db", "PostgreSQL 저장", "storage", "postgres", 2, 1, { sublabel: "5개 테이블", icon: "database" }),
    makeNode("gnc-dash", "대시보드 표시", "output", "nextjs", 4, 1, { icon: "check-circle" }),
  ],
  edges: [
    makeEdge("gnc-kw", "gnc-crawl", { label: "트리거" }),
    makeEdge("gnc-crawl", "gnc-dedup", { label: "기사 목록" }),
    makeEdge("gnc-dedup", "gnc-entity", { label: "고유 기사" }),
    makeEdge("gnc-entity", "gnc-score", { label: "기사 + 엔티티" }),
    makeEdge("gnc-score", "gnc-db", { label: "점수 저장" }),
    makeEdge("gnc-db", "gnc-dash", { label: "조회" }),
  ],
  infraServices: ["FastAPI :8000", "PostgreSQL :5432", "Gemini API (선택)"],
};

// ─── 4. evaluation-rag (standard) — dual flow ───

const evaluationRag: ProjectPipeline = {
  slug: "evaluation-rag",
  name: "평가편람",
  description: "RAG 기반 공공데이터 평가 — 인제스트 흐름 + 평가 흐름",
  projectType: "standard",
  nodes: [
    // Ingest flow (top row)
    makeNode("er-hwpx", "HWPX/PDF 업로드", "input", "nextjs", 0, 0, { sublabel: "인제스트 파이프라인", icon: "upload" }),
    makeNode("er-parse", "문서 파싱", "process", "fastapi", 1, 0, { sublabel: "HWPX/PDF/DOCX" }),
    makeNode("er-chunk", "청킹 + 임베딩", "process", "external", 2, 0, { runtimeLabel: "Gemini API", icon: "sparkles" }),
    makeNode("er-pinecone-in", "Pinecone 저장", "storage", "external", 3, 0, { runtimeLabel: "Pinecone", icon: "database" }),

    // Evaluation flow (bottom row)
    makeNode("er-query", "쿼리 + 데이터 입력", "input", "nextjs", 0, 1.5, { sublabel: "POST /evaluate", icon: "search" }),
    makeNode("er-rag", "RAG 검색 / JSON 로드", "process", "fastapi", 1, 1.5, { sublabel: "Pinecone or 로컬 JSON" }),
    makeNode("er-eval", "Gemini 항목별 평가", "process", "external", 2, 1.5, { runtimeLabel: "Gemini API", icon: "sparkles" }),
    makeNode("er-db", "PostgreSQL 저장", "storage", "postgres", 3, 1.5, { sublabel: "evaluation_rag_evaluations", icon: "database" }),
    makeNode("er-result", "항목별 점수 + 요약", "output", "fastapi", 4, 1.5, { icon: "check-circle" }),
  ],
  edges: [
    // Ingest flow edges
    makeEdge("er-hwpx", "er-parse", { label: "파일" }),
    makeEdge("er-parse", "er-chunk", { label: "텍스트" }),
    makeEdge("er-chunk", "er-pinecone-in", { label: "벡터 저장" }),
    // Evaluation flow edges
    makeEdge("er-query", "er-rag", { label: "쿼리" }),
    makeEdge("er-rag", "er-eval", { label: "컨텍스트" }),
    makeEdge("er-eval", "er-db", { label: "평가 결과" }),
    makeEdge("er-db", "er-result", { label: "조회" }),
    // Cross-zone edge (ingest -> evaluation)
    makeEdge("er-pinecone-in", "er-rag", { label: "벡터 검색", dashed: true, animated: true }),
  ],
  infraServices: ["FastAPI :8000", "PostgreSQL :5432", "Gemini API", "Pinecone"],
};

// ─── 5. report-generator (n8n) ───

const reportGenerator: ProjectPipeline = {
  slug: "report-generator",
  name: "리포트 생성기",
  description: "n8n 워크플로우로 리포트를 생성하고 다운로드 URL 반환",
  projectType: "n8n",
  nodes: [
    makeNode("rg-trigger", "수동 트리거", "input", "nextjs", 0, 0, { sublabel: "POST /trigger/{id}", icon: "play" }),
    makeNode("rg-api", "FastAPI 라우터", "service", "fastapi", 1, 0, { sublabel: ":8000" }),
    makeNode("rg-webhook", "n8n Webhook", "service", "n8n", 2, 0, { sublabel: "webhook POST", icon: "webhook" }),
    makeNode("rg-workflow", "리포트 생성 워크플로우", "process", "n8n", 3, 0, { sublabel: "generate-daily/weekly" }),
    makeNode("rg-callback", "콜백 수신", "service", "fastapi", 4, 0, { sublabel: "/api/webhooks/n8n" }),
    makeNode("rg-db", "PostgreSQL 저장", "storage", "postgres", 2, 1, { sublabel: "n8n_executions", icon: "database" }),
    makeNode("rg-download", "리포트 다운로드", "output", "nextjs", 4, 1, { sublabel: "report_url", icon: "file-output" }),
  ],
  edges: [
    makeEdge("rg-trigger", "rg-api", { label: "HTTP" }),
    makeEdge("rg-api", "rg-webhook", { label: "webhook POST", animated: true }),
    makeEdge("rg-webhook", "rg-workflow", { label: "실행" }),
    makeEdge("rg-workflow", "rg-callback", { label: "결과 콜백", dashed: true, animated: true }),
    makeEdge("rg-callback", "rg-db", { label: "실행이력 저장" }),
    makeEdge("rg-callback", "rg-download", { label: "URL 반환" }),
  ],
  infraServices: ["FastAPI :8000", "n8n :5678", "PostgreSQL :5432"],
};

// ─── 6. data-pipeline (n8n) ───

const dataPipeline: ProjectPipeline = {
  slug: "data-pipeline",
  name: "데이터 파이프라인",
  description: "n8n 기반 ETL 파이프라인 — 트리거, 모니터링, 실행 이력",
  projectType: "n8n",
  nodes: [
    makeNode("dp-trigger", "스케줄/수동 트리거", "input", "nextjs", 0, 0, { sublabel: "POST /trigger/{id}", icon: "play" }),
    makeNode("dp-api", "FastAPI 라우터", "service", "fastapi", 1, 0, { sublabel: ":8000" }),
    makeNode("dp-webhook", "n8n Webhook", "service", "n8n", 2, 0, { sublabel: "webhook POST", icon: "webhook" }),
    makeNode("dp-etl", "ETL 워크플로우", "process", "n8n", 3, 0, { sublabel: "etl-daily / sync-external" }),
    makeNode("dp-transform", "데이터 변환", "process", "n8n", 4, 0),
    makeNode("dp-db", "PostgreSQL 저장", "storage", "postgres", 2, 1, { sublabel: "n8n_executions", icon: "database" }),
    makeNode("dp-status", "상태 업데이트", "output", "fastapi", 4, 1, { icon: "check-circle" }),
  ],
  edges: [
    makeEdge("dp-trigger", "dp-api", { label: "HTTP" }),
    makeEdge("dp-api", "dp-webhook", { label: "webhook POST", animated: true }),
    makeEdge("dp-webhook", "dp-etl", { label: "실행" }),
    makeEdge("dp-etl", "dp-transform", { label: "ETL 데이터" }),
    makeEdge("dp-transform", "dp-db", { label: "저장" }),
    makeEdge("dp-db", "dp-status", { label: "상태 반환" }),
  ],
  infraServices: ["FastAPI :8000", "n8n :5678", "PostgreSQL :5432"],
};

// ─── 7. summarize (n8n) ───

const summarize: ProjectPipeline = {
  slug: "summarize",
  name: "텍스트 요약",
  description: "n8n 워크플로우로 텍스트를 LLM 요약 처리",
  projectType: "n8n",
  nodes: [
    makeNode("sm-input", "텍스트 입력", "input", "nextjs", 0, 0, { sublabel: "POST /trigger", icon: "type" }),
    makeNode("sm-api", "FastAPI 라우터", "service", "fastapi", 1, 0, { sublabel: ":8000" }),
    makeNode("sm-webhook", "n8n Webhook", "service", "n8n", 2, 0, { sublabel: "webhook POST", icon: "webhook" }),
    makeNode("sm-llm", "LLM 요약 처리", "process", "n8n", 3, 0, { icon: "sparkles" }),
    makeNode("sm-callback", "콜백 수신", "service", "fastapi", 4, 0, { sublabel: "/api/webhooks/n8n" }),
    makeNode("sm-output", "요약 결과 반환", "output", "fastapi", 5, 0, { icon: "check-circle" }),
  ],
  edges: [
    makeEdge("sm-input", "sm-api", { label: "텍스트" }),
    makeEdge("sm-api", "sm-webhook", { label: "webhook POST", animated: true }),
    makeEdge("sm-webhook", "sm-llm", { label: "실행" }),
    makeEdge("sm-llm", "sm-callback", { label: "결과 콜백", dashed: true, animated: true }),
    makeEdge("sm-callback", "sm-output", { label: "요약 반환" }),
  ],
  infraServices: ["FastAPI :8000", "n8n :5678"],
};

// ─── 8. test1 / 값진단 사전예외처리 (n8n) ───

const test1: ProjectPipeline = {
  slug: "test1",
  name: "값진단 사전예외처리",
  description: "파일 업로드 후 n8n 워크플로우로 데이터 품질 사전 진단",
  projectType: "n8n",
  nodes: [
    makeNode("t1-upload", "파일 업로드", "input", "nextjs", 0, 0, { sublabel: "POST /trigger/{id}", icon: "upload" }),
    makeNode("t1-api", "FastAPI 라우터", "service", "fastapi", 1, 0, { sublabel: ":8000" }),
    makeNode("t1-webhook", "n8n Webhook", "service", "n8n", 2, 0, { sublabel: "multipart/form-data", icon: "webhook" }),
    makeNode("t1-check", "품질 진단", "process", "n8n", 3, 0, { sublabel: "data_quality_pretest" }),
    makeNode("t1-validate", "검증 규칙 적용", "process", "n8n", 4, 0),
    makeNode("t1-callback", "콜백 수신", "service", "fastapi", 5, 0, { sublabel: "/api/webhooks/n8n" }),
    makeNode("t1-output", "예외 리포트", "output", "fastapi", 6, 0, { icon: "file-output" }),
  ],
  edges: [
    makeEdge("t1-upload", "t1-api", { label: "파일 전송" }),
    makeEdge("t1-api", "t1-webhook", { label: "multipart POST", animated: true }),
    makeEdge("t1-webhook", "t1-check", { label: "실행" }),
    makeEdge("t1-check", "t1-validate", { label: "진단 결과" }),
    makeEdge("t1-validate", "t1-callback", { label: "결과 콜백", dashed: true, animated: true }),
    makeEdge("t1-callback", "t1-output", { label: "리포트 반환" }),
  ],
  infraServices: ["FastAPI :8000", "n8n :5678"],
};

// ─── 9. effort-public-data (n8n) ───

const effortPublicData: ProjectPipeline = {
  slug: "effort-public-data",
  name: "공유데이터 제공 노력",
  description: "파일 업로드 후 n8n 워크플로우로 공유데이터 제공 노력도 분석",
  projectType: "n8n",
  nodes: [
    makeNode("ep-upload", "파일 업로드", "input", "nextjs", 0, 0, { sublabel: "POST /trigger/{id}", icon: "upload" }),
    makeNode("ep-api", "FastAPI 라우터", "service", "fastapi", 1, 0, { sublabel: ":8000" }),
    makeNode("ep-webhook", "n8n Webhook", "service", "n8n", 2, 0, { sublabel: "multipart/form-data", icon: "webhook" }),
    makeNode("ep-workflow", "분석 워크플로우", "process", "n8n", 3, 0),
    makeNode("ep-callback", "콜백 수신", "service", "fastapi", 4, 0, { sublabel: "/api/webhooks/n8n" }),
    makeNode("ep-output", "분석 결과", "output", "fastapi", 5, 0, { icon: "check-circle" }),
  ],
  edges: [
    makeEdge("ep-upload", "ep-api", { label: "파일 전송" }),
    makeEdge("ep-api", "ep-webhook", { label: "multipart POST", animated: true }),
    makeEdge("ep-webhook", "ep-workflow", { label: "실행" }),
    makeEdge("ep-workflow", "ep-callback", { label: "결과 콜백", dashed: true, animated: true }),
    makeEdge("ep-callback", "ep-output", { label: "결과 반환" }),
  ],
  infraServices: ["FastAPI :8000", "n8n :5678"],
};

// ─── Exports ───

export const PROJECT_PIPELINES: Record<string, ProjectPipeline> = {
  "dataset-summary": datasetSummary,
  "evaluation-rag": evaluationRag,
  "gov-news-crawler": govNewsCrawler,
  "open-data-analyzer": openDataAnalyzer,
  "data-pipeline": dataPipeline,
  "effort-public-data": effortPublicData,
  "report-generator": reportGenerator,
  "summarize": summarize,
  "test1": test1,
};

// Deterministic tab order: standard first (alpha), then n8n (alpha)
export const PIPELINE_ORDER: string[] = [
  "dataset-summary",
  "evaluation-rag",
  "gov-news-crawler",
  "open-data-analyzer",
  "data-pipeline",
  "effort-public-data",
  "report-generator",
  "summarize",
  "test1",
];
