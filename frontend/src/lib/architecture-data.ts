// Architecture diagram data — 6 base diagrams + per-project highlight rules
// Design: COLOR_CLASS_MAP is statically defined for Tailwind build safety

export type ArchType = "system" | "network" | "software" | "data" | "integration" | "application";
export type ColorKey = "blue" | "green" | "purple" | "orange" | "red" | "slate" | "cyan" | "amber";

export const COLOR_CLASS_MAP: Record<ColorKey, { bg: string; border: string; shadow: string; gradient: string; text: string }> = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-400",   shadow: "shadow-blue-100/50",   gradient: "from-blue-50 to-blue-100",   text: "text-blue-700" },
  green:  { bg: "bg-green-50",  border: "border-green-400",  shadow: "shadow-green-100/50",  gradient: "from-green-50 to-green-100",  text: "text-green-700" },
  purple: { bg: "bg-purple-50", border: "border-purple-400", shadow: "shadow-purple-100/50", gradient: "from-purple-50 to-purple-100", text: "text-purple-700" },
  orange: { bg: "bg-orange-50", border: "border-orange-400", shadow: "shadow-orange-100/50", gradient: "from-orange-50 to-orange-100", text: "text-orange-700" },
  red:    { bg: "bg-red-50",    border: "border-red-400",    shadow: "shadow-red-100/50",    gradient: "from-red-50 to-red-100",    text: "text-red-700" },
  slate:  { bg: "bg-slate-50",  border: "border-slate-400",  shadow: "shadow-slate-100/50",  gradient: "from-slate-50 to-slate-100",  text: "text-slate-700" },
  cyan:   { bg: "bg-cyan-50",   border: "border-cyan-400",   shadow: "shadow-cyan-100/50",   gradient: "from-cyan-50 to-cyan-100",   text: "text-cyan-700" },
  amber:  { bg: "bg-amber-50",  border: "border-amber-400",  shadow: "shadow-amber-100/50",  gradient: "from-amber-50 to-amber-100",  text: "text-amber-700" },
};

export interface ArchNode {
  id: string;
  label: string;
  sublabel?: string;
  group: "frontend" | "backend" | "database" | "external" | "infra";
  colorKey: ColorKey;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface ArchEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed";
}

export interface ArchDiagram {
  type: ArchType;
  title: string;
  description: string;
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface ProjectHighlight {
  highlightNodes: Record<ArchType, string[]>;
  highlightEdges?: Record<ArchType, string[]>;
}

export const ARCH_TYPE_LABELS: Record<ArchType, { label: string; description: string }> = {
  system:      { label: "시스템",     description: "전체 서비스 구성 및 연결 관계" },
  network:     { label: "네트워크",   description: "Docker 네트워크, 포트 매핑, 통신 경로" },
  software:    { label: "소프트웨어", description: "애플리케이션 내부 계층 및 모듈 구조" },
  data:        { label: "데이터",     description: "ERD, 테이블 구조 및 관계도" },
  integration: { label: "통합",       description: "외부 API 연동, webhook, 콜백 흐름" },
  application: { label: "애플리케이션", description: "프로젝트 모듈, API 경계, 페이지 구성" },
};

// ─── System Architecture ───
const systemDiagram: ArchDiagram = {
  type: "system",
  title: "시스템 아키텍처",
  description: "Unified Workspace 전체 서비스 구성도 (docker-compose.yml 기반)",
  nodes: [
    { id: "browser",  label: "Browser",           sublabel: "Client",        group: "frontend",  colorKey: "slate",  x: 5,  y: 40 },
    { id: "nextjs",   label: "Next.js Frontend",  sublabel: ":3000",         group: "frontend",  colorKey: "blue",   x: 25, y: 40 },
    { id: "fastapi",  label: "FastAPI Backend",    sublabel: ":8000",         group: "backend",   colorKey: "green",  x: 50, y: 40 },
    { id: "postgres", label: "PostgreSQL",         sublabel: ":5432 (v16)",   group: "database",  colorKey: "purple", x: 75, y: 15 },
    { id: "redis",    label: "Redis",              sublabel: ":6379 (v7)",    group: "database",  colorKey: "red",    x: 75, y: 40 },
    { id: "n8n",      label: "n8n Workflow",       sublabel: ":5678 (v1.76)", group: "infra",     colorKey: "orange", x: 75, y: 65 },
    { id: "gemini",   label: "Gemini API",         sublabel: "Google AI",     group: "external",  colorKey: "cyan",   x: 50, y: 85 },
    { id: "pinecone", label: "Pinecone",           sublabel: "Vector DB",     group: "external",  colorKey: "amber",  x: 25, y: 85 },
  ],
  edges: [
    { id: "browser-nextjs",   from: "browser",  to: "nextjs",   label: "HTTP" },
    { id: "nextjs-fastapi",   from: "nextjs",   to: "fastapi",  label: "REST API (rewrite)" },
    { id: "fastapi-postgres", from: "fastapi",  to: "postgres", label: "asyncpg" },
    { id: "fastapi-redis",    from: "fastapi",  to: "redis",    label: "redis-py" },
    { id: "fastapi-n8n",      from: "fastapi",  to: "n8n",      label: "webhook trigger", style: "dashed" },
    { id: "n8n-fastapi",      from: "n8n",      to: "fastapi",  label: "callback /api/webhooks/n8n", style: "dashed" },
    { id: "fastapi-gemini",   from: "fastapi",  to: "gemini",   label: "HTTP/REST", style: "dashed" },
    { id: "fastapi-pinecone", from: "fastapi",  to: "pinecone", label: "HTTP/REST", style: "dashed" },
  ],
};

// ─── Network Architecture ───
const networkDiagram: ArchDiagram = {
  type: "network",
  title: "네트워크 아키텍처",
  description: "Docker Compose 네트워크 토폴로지 및 포트 매핑",
  nodes: [
    { id: "net-frontend",  label: "frontend-net",      sublabel: "Docker Network",   group: "infra",    colorKey: "blue",   x: 20, y: 10, width: 240, height: 50 },
    { id: "net-backend",   label: "backend-net",       sublabel: "Docker Network",   group: "infra",    colorKey: "green",  x: 60, y: 10, width: 240, height: 50 },
    { id: "frontend-svc",  label: "frontend",          sublabel: "3000:3000",        group: "frontend", colorKey: "blue",   x: 10, y: 40 },
    { id: "backend-svc",   label: "backend",           sublabel: "8000:8000",        group: "backend",  colorKey: "green",  x: 40, y: 40 },
    { id: "db-svc",        label: "db",                sublabel: "127.0.0.1:5432",   group: "database", colorKey: "purple", x: 70, y: 40 },
    { id: "redis-svc",     label: "redis",             sublabel: "127.0.0.1:6379",   group: "database", colorKey: "red",    x: 70, y: 65 },
    { id: "n8n-svc",       label: "n8n",               sublabel: "5678:5678",        group: "infra",    colorKey: "orange", x: 70, y: 90 },
    { id: "external",      label: "External (Internet)", sublabel: "n8n cloud webhook", group: "external", colorKey: "slate", x: 10, y: 90 },
  ],
  edges: [
    { id: "fe-be",         from: "frontend-svc", to: "backend-svc",  label: "frontend-net" },
    { id: "be-db",         from: "backend-svc",  to: "db-svc",       label: "backend-net" },
    { id: "be-redis",      from: "backend-svc",  to: "redis-svc",    label: "backend-net" },
    { id: "be-n8n",        from: "backend-svc",  to: "n8n-svc",      label: "backend-net", style: "dashed" },
    { id: "n8n-db",        from: "n8n-svc",      to: "db-svc",       label: "backend-net", style: "dashed" },
    { id: "ext-be",        from: "external",      to: "backend-svc",  label: "N8N_WEBHOOK_BASE", style: "dashed" },
  ],
};

// ─── Software Architecture ───
const softwareDiagram: ArchDiagram = {
  type: "software",
  title: "소프트웨어 아키텍처",
  description: "Modular Monolith 패턴 — 계층 분리 및 자동 탐지 구조",
  nodes: [
    { id: "app-router",    label: "App Router",         sublabel: "Next.js 15",       group: "frontend", colorKey: "blue",   x: 5,  y: 15 },
    { id: "react-query",   label: "React Query",        sublabel: "데이터 캐싱",       group: "frontend", colorKey: "blue",   x: 5,  y: 40 },
    { id: "api-client",    label: "ApiClient",          sublabel: "lib/api.ts",        group: "frontend", colorKey: "blue",   x: 5,  y: 65 },
    { id: "fastapi-app",   label: "FastAPI App",        sublabel: "main.py",           group: "backend",  colorKey: "green",  x: 35, y: 15 },
    { id: "registry",      label: "ProjectRegistry",    sublabel: "자동 탐지/등록",     group: "backend",  colorKey: "green",  x: 35, y: 40 },
    { id: "auth-module",   label: "Auth (JWT)",         sublabel: "shared/auth",       group: "backend",  colorKey: "green",  x: 35, y: 65 },
    { id: "project-router", label: "Project Router",    sublabel: "/api/projects/{slug}", group: "backend", colorKey: "cyan", x: 65, y: 15 },
    { id: "project-service", label: "Project Service",  sublabel: "비즈니스 로직",      group: "backend",  colorKey: "cyan",  x: 65, y: 40 },
    { id: "project-model",  label: "SQLAlchemy Models", sublabel: "BaseEntity + Mixin", group: "backend", colorKey: "cyan",  x: 65, y: 65 },
    { id: "n8n-client",    label: "N8nClient",          sublabel: "webhook trigger",   group: "backend",  colorKey: "orange", x: 65, y: 90 },
  ],
  edges: [
    { id: "router-query",   from: "app-router",     to: "react-query",     label: "hooks" },
    { id: "query-api",      from: "react-query",    to: "api-client",      label: "fetch" },
    { id: "api-fastapi",    from: "api-client",     to: "fastapi-app",     label: "HTTP" },
    { id: "fastapi-reg",    from: "fastapi-app",    to: "registry",        label: "auto_discover" },
    { id: "reg-router",     from: "registry",       to: "project-router",  label: "mount" },
    { id: "router-svc",     from: "project-router", to: "project-service", label: "Depends" },
    { id: "svc-model",      from: "project-service", to: "project-model",  label: "async session" },
    { id: "svc-n8n",        from: "project-service", to: "n8n-client",     label: "trigger", style: "dashed" },
    { id: "fastapi-auth",   from: "fastapi-app",    to: "auth-module",     label: "middleware" },
  ],
};

// ─── Data Architecture ───
const dataDiagram: ArchDiagram = {
  type: "data",
  title: "데이터 아키텍처",
  description: "ERD — 전체 테이블 구조 및 관계도",
  nodes: [
    { id: "base-entity",    label: "BaseEntity",              sublabel: "UUID PK + Timestamp",  group: "database", colorKey: "slate",  x: 40, y: 5,  width: 200 },
    { id: "gov_keywords",   label: "gov_keywords",            sublabel: "query, category",      group: "database", colorKey: "purple", x: 5,  y: 30 },
    { id: "gov_sources",    label: "gov_sources",             sublabel: "name, url, type",      group: "database", colorKey: "purple", x: 35, y: 30 },
    { id: "gov_articles",   label: "gov_articles",            sublabel: "title, content, url",  group: "database", colorKey: "purple", x: 65, y: 30 },
    { id: "gov_scores",     label: "gov_scores",              sublabel: "rule + AI scores",     group: "database", colorKey: "purple", x: 35, y: 55 },
    { id: "gov_crawl_runs", label: "gov_crawl_runs",          sublabel: "status, statistics",   group: "database", colorKey: "purple", x: 5,  y: 55 },
    { id: "eval_rag",       label: "evaluation_rag_evaluations", sublabel: "score, issues",     group: "database", colorKey: "cyan",   x: 5,  y: 80 },
    { id: "n8n_executions", label: "n8n_executions",          sublabel: "execution_id, status", group: "database", colorKey: "orange", x: 65, y: 80 },
  ],
  edges: [
    { id: "base-kw",     from: "base-entity",  to: "gov_keywords",   label: "extends" },
    { id: "base-src",    from: "base-entity",  to: "gov_sources",    label: "extends" },
    { id: "base-art",    from: "base-entity",  to: "gov_articles",   label: "extends" },
    { id: "base-score",  from: "base-entity",  to: "gov_scores",     label: "extends" },
    { id: "base-crawl",  from: "base-entity",  to: "gov_crawl_runs", label: "extends" },
    { id: "base-eval",   from: "base-entity",  to: "eval_rag",       label: "extends" },
    { id: "base-n8n",    from: "base-entity",  to: "n8n_executions", label: "extends" },
    { id: "art-src",     from: "gov_articles",  to: "gov_sources",   label: "FK source_id", style: "dashed" },
    { id: "score-art",   from: "gov_scores",    to: "gov_articles",  label: "FK article_id", style: "dashed" },
    { id: "score-kw",    from: "gov_scores",    to: "gov_keywords",  label: "FK keyword_id", style: "dashed" },
    { id: "crawl-kw",    from: "gov_crawl_runs", to: "gov_keywords", label: "FK keyword_id", style: "dashed" },
  ],
};

// ─── Integration Architecture ───
const integrationDiagram: ArchDiagram = {
  type: "integration",
  title: "통합 아키텍처",
  description: "외부 시스템 연동 구조 — n8n webhook, LLM API, Vector DB",
  nodes: [
    { id: "backend",       label: "FastAPI Backend",     sublabel: ":8000",                  group: "backend",   colorKey: "green",  x: 40, y: 40 },
    { id: "n8n-cloud",     label: "n8n Cloud",           sublabel: "WEBHOOK_BASE_2",         group: "external",  colorKey: "orange", x: 75, y: 15 },
    { id: "n8n-callback",  label: "Callback Endpoint",   sublabel: "/api/webhooks/n8n/*",    group: "backend",   colorKey: "orange", x: 75, y: 40 },
    { id: "gemini-api",    label: "Gemini API",          sublabel: "gemini-2.5-flash",       group: "external",  colorKey: "cyan",   x: 5,  y: 15 },
    { id: "openai-api",    label: "OpenAI API",          sublabel: "Optional",               group: "external",  colorKey: "slate",  x: 5,  y: 40 },
    { id: "pinecone-api",  label: "Pinecone",            sublabel: "evaluation-guidelines",  group: "external",  colorKey: "amber",  x: 5,  y: 65 },
    { id: "rss-html",      label: "RSS/HTML Sources",    sublabel: "정부/뉴스 사이트",        group: "external",  colorKey: "slate",  x: 40, y: 85 },
    { id: "file-upload",   label: "File Upload",         sublabel: "/tmp/uploads",           group: "infra",     colorKey: "slate",  x: 75, y: 65 },
  ],
  edges: [
    { id: "be-n8n-trigger",   from: "backend",      to: "n8n-cloud",    label: "POST webhook", style: "dashed" },
    { id: "n8n-be-callback",  from: "n8n-cloud",    to: "n8n-callback", label: "결과 콜백", style: "dashed" },
    { id: "be-gemini",        from: "backend",      to: "gemini-api",   label: "LLM 요청" },
    { id: "be-openai",        from: "backend",      to: "openai-api",   label: "LLM 요청 (선택)", style: "dashed" },
    { id: "be-pinecone",      from: "backend",      to: "pinecone-api", label: "Vector Search" },
    { id: "be-rss",           from: "backend",      to: "rss-html",     label: "크롤링 요청" },
    { id: "be-upload",        from: "backend",      to: "file-upload",  label: "파일 저장" },
  ],
};

// ─── Application Architecture ───
const applicationDiagram: ArchDiagram = {
  type: "application",
  title: "애플리케이션 아키텍처",
  description: "9개 프로젝트 모듈 — standard/n8n 타입 분리, API 경계",
  nodes: [
    { id: "registry-app",    label: "ProjectRegistry",      sublabel: "/api/registry",            group: "backend",  colorKey: "green",  x: 40, y: 5, width: 200 },
    { id: "dataset-summary", label: "데이터셋 설명 생성",     sublabel: "standard",                 group: "backend",  colorKey: "blue",   x: 5,  y: 30 },
    { id: "open-data",       label: "개방 가능 여부 판단",     sublabel: "standard",                 group: "backend",  colorKey: "blue",   x: 30, y: 30 },
    { id: "gov-news",        label: "정부 뉴스 크롤링",       sublabel: "standard",                 group: "backend",  colorKey: "blue",   x: 55, y: 30 },
    { id: "eval-rag",        label: "평가편람",               sublabel: "standard",                 group: "backend",  colorKey: "blue",   x: 80, y: 30 },
    { id: "report-gen",      label: "리포트 생성기",           sublabel: "n8n",                     group: "backend",  colorKey: "orange", x: 5,  y: 60 },
    { id: "data-pipeline",   label: "데이터 파이프라인",       sublabel: "n8n",                     group: "backend",  colorKey: "orange", x: 25, y: 60 },
    { id: "summarize",       label: "텍스트 요약",            sublabel: "n8n",                     group: "backend",  colorKey: "orange", x: 45, y: 60 },
    { id: "test1-app",       label: "값진단 사전예외처리",     sublabel: "n8n",                     group: "backend",  colorKey: "orange", x: 65, y: 60 },
    { id: "effort-pub",      label: "공유데이터 제공 노력",    sublabel: "n8n",                     group: "backend",  colorKey: "orange", x: 85, y: 60 },
    { id: "fe-pages",        label: "Frontend Pages",        sublabel: "/projects/{slug}",         group: "frontend", colorKey: "blue",   x: 40, y: 90, width: 200 },
  ],
  edges: [
    { id: "reg-ds",  from: "registry-app", to: "dataset-summary", label: "mount" },
    { id: "reg-od",  from: "registry-app", to: "open-data",       label: "mount" },
    { id: "reg-gn",  from: "registry-app", to: "gov-news",        label: "mount" },
    { id: "reg-er",  from: "registry-app", to: "eval-rag",        label: "mount" },
    { id: "reg-rg",  from: "registry-app", to: "report-gen",      label: "mount" },
    { id: "reg-dp",  from: "registry-app", to: "data-pipeline",   label: "mount" },
    { id: "reg-sm",  from: "registry-app", to: "summarize",       label: "mount" },
    { id: "reg-t1",  from: "registry-app", to: "test1-app",       label: "mount" },
    { id: "reg-ep",  from: "registry-app", to: "effort-pub",      label: "mount" },
    { id: "fe-reg",  from: "fe-pages",     to: "registry-app",    label: "API 호출", style: "dashed" },
  ],
};

export const UNIFIED_DIAGRAMS: Record<ArchType, ArchDiagram> = {
  system: systemDiagram,
  network: networkDiagram,
  software: softwareDiagram,
  data: dataDiagram,
  integration: integrationDiagram,
  application: applicationDiagram,
};

// ─── Per-Project Highlight Rules ───
export const PROJECT_HIGHLIGHTS: Record<string, ProjectHighlight> = {
  "dataset-summary": {
    highlightNodes: {
      system: ["browser", "nextjs", "fastapi", "gemini"],
      network: ["frontend-svc", "backend-svc", "net-frontend", "net-backend"],
      software: ["app-router", "react-query", "api-client", "fastapi-app", "registry", "project-router", "project-service"],
      data: [],
      integration: ["backend", "gemini-api", "openai-api", "file-upload"],
      application: ["registry-app", "dataset-summary", "fe-pages"],
    },
  },
  "open-data-analyzer": {
    highlightNodes: {
      system: ["browser", "nextjs", "fastapi", "gemini"],
      network: ["frontend-svc", "backend-svc", "net-frontend", "net-backend"],
      software: ["app-router", "react-query", "api-client", "fastapi-app", "registry", "project-router", "project-service"],
      data: [],
      integration: ["backend", "gemini-api", "file-upload"],
      application: ["registry-app", "open-data", "fe-pages"],
    },
  },
  "gov-news-crawler": {
    highlightNodes: {
      system: ["browser", "nextjs", "fastapi", "postgres"],
      network: ["frontend-svc", "backend-svc", "db-svc", "net-frontend", "net-backend"],
      software: ["app-router", "react-query", "api-client", "fastapi-app", "registry", "project-router", "project-service", "project-model"],
      data: ["base-entity", "gov_keywords", "gov_sources", "gov_articles", "gov_scores", "gov_crawl_runs"],
      integration: ["backend", "rss-html"],
      application: ["registry-app", "gov-news", "fe-pages"],
    },
  },
  "evaluation-rag": {
    highlightNodes: {
      system: ["browser", "nextjs", "fastapi", "postgres", "gemini", "pinecone"],
      network: ["frontend-svc", "backend-svc", "db-svc", "net-frontend", "net-backend"],
      software: ["app-router", "react-query", "api-client", "fastapi-app", "registry", "project-router", "project-service", "project-model"],
      data: ["base-entity", "eval_rag"],
      integration: ["backend", "gemini-api", "pinecone-api", "file-upload"],
      application: ["registry-app", "eval-rag", "fe-pages"],
    },
  },
  "report-generator": {
    highlightNodes: {
      system: ["browser", "nextjs", "fastapi", "postgres", "n8n"],
      network: ["frontend-svc", "backend-svc", "db-svc", "n8n-svc", "net-frontend", "net-backend", "external"],
      software: ["app-router", "react-query", "api-client", "fastapi-app", "registry", "project-router", "project-service", "n8n-client"],
      data: ["base-entity", "n8n_executions"],
      integration: ["backend", "n8n-cloud", "n8n-callback"],
      application: ["registry-app", "report-gen", "fe-pages"],
    },
  },
  "data-pipeline": {
    highlightNodes: {
      system: ["browser", "nextjs", "fastapi", "postgres", "n8n"],
      network: ["frontend-svc", "backend-svc", "db-svc", "n8n-svc", "net-frontend", "net-backend", "external"],
      software: ["app-router", "react-query", "api-client", "fastapi-app", "registry", "project-router", "project-service", "n8n-client"],
      data: ["base-entity", "n8n_executions"],
      integration: ["backend", "n8n-cloud", "n8n-callback"],
      application: ["registry-app", "data-pipeline", "fe-pages"],
    },
  },
  "summarize": {
    highlightNodes: {
      system: ["browser", "nextjs", "fastapi", "postgres", "n8n"],
      network: ["frontend-svc", "backend-svc", "db-svc", "n8n-svc", "net-frontend", "net-backend", "external"],
      software: ["app-router", "react-query", "api-client", "fastapi-app", "registry", "project-router", "project-service", "n8n-client"],
      data: ["base-entity", "n8n_executions"],
      integration: ["backend", "n8n-cloud", "n8n-callback"],
      application: ["registry-app", "summarize", "fe-pages"],
    },
  },
  "test1": {
    highlightNodes: {
      system: ["browser", "nextjs", "fastapi", "postgres", "n8n"],
      network: ["frontend-svc", "backend-svc", "db-svc", "n8n-svc", "net-frontend", "net-backend", "external"],
      software: ["app-router", "react-query", "api-client", "fastapi-app", "registry", "project-router", "project-service", "n8n-client"],
      data: ["base-entity", "n8n_executions"],
      integration: ["backend", "n8n-cloud", "n8n-callback"],
      application: ["registry-app", "test1-app", "fe-pages"],
    },
  },
  "effort-public-data": {
    highlightNodes: {
      system: ["browser", "nextjs", "fastapi", "postgres", "n8n"],
      network: ["frontend-svc", "backend-svc", "db-svc", "n8n-svc", "net-frontend", "net-backend", "external"],
      software: ["app-router", "react-query", "api-client", "fastapi-app", "registry", "project-router", "project-service", "n8n-client"],
      data: ["base-entity", "n8n_executions"],
      integration: ["backend", "n8n-cloud", "n8n-callback"],
      application: ["registry-app", "effort-pub", "fe-pages"],
    },
  },
};
