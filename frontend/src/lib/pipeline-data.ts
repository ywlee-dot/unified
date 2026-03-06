// Pipeline diagram data — 9 project E2E pipelines for React Flow rendering
// Design: NODE_TYPE_STYLES and RUNTIME_STYLES are statically defined for Tailwind build safety

import type { Node, Edge } from "@xyflow/react";

// ─── Types ───

export type PipelineNodeType = "input" | "process" | "service" | "storage" | "output";
export type RuntimeService = "nextjs" | "fastapi" | "n8n" | "postgres" | "redis" | "external";

export type ArchitectureLayerType = "frontend" | "backend" | "external" | "data";

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

export interface ProjectPipeline {
  slug: string;
  name: string;
  description: string;
  projectType: "standard" | "n8n";
  nodes: Node[];
  edges: Edge[];
  infraServices: string[];
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

// ─── 2. open-data-analyzer (standard) — 5-stage sequential ───

const openDataAnalyzer: ProjectPipeline = {
  slug: "open-data-analyzer",
  name: "개방 가능 여부 판단",
  description: "5단계 순차 분석으로 데이터 개방 가능 여부를 판정하고 Excel로 내보내기",
  projectType: "standard",
  nodes: [
    makeNode("oda-upload", "Excel 업로드", "input", "nextjs", 0, 0, { sublabel: "POST /stage1", icon: "upload" }),
    makeNode("oda-extract", "테이블 추출/병합", "process", "fastapi", 1, 0, { sublabel: "openpyxl" }),
    makeNode("oda-s1", "Stage1: 개방가능여부", "process", "external", 2, 0, { runtimeLabel: "Gemini API", sublabel: "가능/불가능 판정" }),
    makeNode("oda-s2", "Stage2: 주제영역", "process", "external", 3, 0, { runtimeLabel: "Gemini API", sublabel: "한국표준 분류" }),
    makeNode("oda-s3", "Stage3: 핵심컬럼", "process", "external", 0, 1, { runtimeLabel: "Gemini API", sublabel: "컬럼 + 설명" }),
    makeNode("oda-s4", "Stage4: 조인관계", "process", "external", 1, 1, { runtimeLabel: "Gemini API", sublabel: "FK 분석" }),
    makeNode("oda-s5", "Stage5: 최종정의", "process", "external", 2, 1, { runtimeLabel: "Gemini API", sublabel: "최종 검증" }),
    makeNode("oda-json", "최종 판정 JSON", "output", "fastapi", 3, 1, { icon: "check-circle" }),
    makeNode("oda-excel", "Excel Export", "output", "fastapi", 4, 1, { sublabel: "5개 시트", icon: "file-output" }),
  ],
  edges: [
    makeEdge("oda-upload", "oda-extract", { label: "파일 전송" }),
    makeEdge("oda-extract", "oda-s1", { label: "테이블 데이터" }),
    makeEdge("oda-s1", "oda-s2", { label: "세션 상태" }),
    makeEdge("oda-s2", "oda-s3", { label: "세션 상태" }),
    makeEdge("oda-s3", "oda-s4", { label: "세션 상태" }),
    makeEdge("oda-s4", "oda-s5", { label: "세션 상태" }),
    makeEdge("oda-s5", "oda-json", { label: "최종 결과" }),
    makeEdge("oda-json", "oda-excel", { label: "Export" }),
  ],
  infraServices: ["FastAPI :8000", "Gemini API"],
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
