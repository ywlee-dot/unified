// --- Auth ---

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user: AuthUser;
}

// --- Common ---

export type ProjectType = "standard" | "n8n";

export interface Project {
  slug: string;
  name: string;
  description: string;
  version: string;
  project_type: ProjectType;
  icon: string;
  color: string;
  enabled: boolean;
  n8n_config?: N8nProjectConfig | null;
}

export interface N8nProjectConfig {
  webhook_path: string;
  workflows: N8nWorkflowConfig[];
}

export interface N8nWorkflowConfig {
  id: string;
  name: string;
  trigger_type: "manual" | "scheduled";
}

// --- Pagination / API Response ---

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message?: string;
  error?: string;
}

// --- n8n Common ---

export interface N8nWorkflow {
  id: string;
  name: string;
  description: string;
  trigger_type: "manual" | "scheduled";
  last_run_at: string | null;
  status: "active" | "inactive";
}

export interface N8nTriggerResponse {
  run_id: string;
  status: "triggered" | "queued";
  message: string;
}

export interface N8nRun {
  run_id: string;
  workflow_id: string;
  workflow_name: string;
  status: "running" | "completed" | "failed";
  started_at: string;
  finished_at: string | null;
  result_data: Record<string, unknown> | null;
  download_url: string | null;
  error_message: string | null;
}

// --- Data Pipeline ---

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  source: string;
  destination: string;
  schedule: string | null;
  status: "active" | "inactive";
  last_run_at: string | null;
}

export interface PipelineRun {
  run_id: string;
  pipeline_id: string;
  pipeline_name: string;
  status: "running" | "completed" | "failed";
  started_at: string;
  finished_at: string | null;
  records_processed: number;
  records_failed: number;
  logs: string[] | null;
  error_message: string | null;
}

// --- Dataset Summary ---

export interface DatasetSummaryResult {
  row_index: number;
  group_key: string | null;
  common: Record<string, string>;
  columns: string[];
  keywords: string[];
  description: string;
  prompt?: string;
  debug?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
}

export interface DatasetSummaryStats {
  total_generated: number;
  mock_available: boolean;
  supported_formats: string[];
}

// --- Gov News Crawler ---

export interface GovKeyword {
  id: string;
  query: string;
  category: string;
  synonyms: string[];
  target_entities: {
    institutions: string[];
    leaders: string[];
  };
  is_active: boolean;
  created_at: string;
}

export interface GovSource {
  id: string;
  name: string;
  source_type: "rss" | "html" | "api";
  url: string;
  category: string;
  credibility_score: number;
  is_active: boolean;
}

export interface GovArticle {
  id: string;
  url: string;
  title: string;
  content: string;
  summary: string | null;
  author: string | null;
  published_at: string | null;
  source_type: "government" | "news";
  institution_name: string | null;
  final_score: number | null;
  source_name: string | null;
}

export interface GovCrawlRun {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  trigger_type: string;
  statistics: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
}

export interface GovNewsStats {
  total_keywords: number;
  active_keywords: number;
  total_sources: number;
  total_articles: number;
  recent_crawl_runs: GovCrawlRun[];
}

// --- Open Data Analyzer ---

export interface OpenDataClosedColumn {
  name: string;
  reason: string;
  reason_codes?: number[];
}

export interface OpenDataTableRow {
  table: string;
  key: string;
  bucket: string;
  open_columns: string[];
  closed_columns: OpenDataClosedColumn[];
  open_count: number;
  total_count: number;
  major_area?: string;
  sub_area?: string;
  dataset_name?: string;
  source_file?: string;
}

export interface OpenDataGroup {
  major_area: string;
  tables: OpenDataTableRow[];
}

export interface OpenDataAnalysisResult {
  session_id: string;
  execution_id?: string;
  total: number;
  full_open_count: number;
  partial_count: number;
  not_openable_count: number;
  file_count: number;
  groups: OpenDataGroup[];
  not_openable: OpenDataTableRow[];
}

// --- Unified execution history (process_executions table) ---

export interface ProcessExecutionSummary {
  execution_id: string;
  project_slug: string;
  process_type: string;
  status: "running" | "succeeded" | "failed" | string;
  input_summary: string;
  input_metadata: Record<string, unknown> | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  workflow_id: string | null;
  workflow_name: string | null;
}

export interface ProcessExecutionDetail extends ProcessExecutionSummary {
  result_data: Record<string, unknown> | null;
}

export interface ProcessExecutionListResponse {
  items: ProcessExecutionSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface OpenDataAnalyzerStats {
  active_sessions: number;
  supported_formats: string[];
  mock_available: boolean;
  stages: string[];
}

// --- Evaluation RAG ---

export interface EvaluationImprovementItem {
  category: string;
  issue: string;
  recommendation: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface EvaluationRagItemScore {
  item_id: string;
  item_name: string;
  category: string;
  score: number;
  max_score: number;
  reasoning: string;
  issues: string[];
  improvements: string[];
}

export interface EvaluationRagResponse {
  id: string;
  summary: string;
  score: number;
  issues: string[];
  improvements: EvaluationImprovementItem[];
  input_data: string;
  query: string;
  context: string;
  category: string | null;
  created_at: string;
  total_score: number | null;
  max_possible_score: number | null;
  item_scores: EvaluationRagItemScore[];
}

export interface EvaluationRagListResponse {
  evaluations: EvaluationRagResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface EvaluationRagStats {
  total_evaluations: number;
  average_score: number | null;
  categories: string[];
  pinecone_connected: boolean;
  supported_formats: string[];
}

// --- Bid Monitor ---

export interface ScoringWeights {
  title_keyword?: number;
  title_alias?: number;
  category_exact?: number;
  category_mid?: number;
  category_large?: number;
  institution?: number;
  flag?: number;
  price_in_range?: number;
  price_out_range?: number;
}

export interface ScoringThresholds {
  high?: number;
  medium?: number;
  low?: number;
}

export interface FilterConditions {
  title_keywords?: string[];
  title_exclude?: string[];
  search_aliases?: string[];
  institutions?: string[];
  categories?: {
    pubPrcrmntLrgClsfcNm?: string[];
    pubPrcrmntClsfcNm?: string[];
    pubPrcrmntMidClsfcNm?: string[];
    dtilPrdctClsfcNoNm?: string[];
    sucsfbidMthdNm?: string[];
    bidMethdNm?: string[];
    cnstrtsiteRgnNm?: string[];
    rgstTyNm?: string[];
  };
  flags?: Record<string, string>;
  price_range?: {
    min?: number | null;
    max?: number | null;
  };
  match_mode?: "any" | "all";
  scoring_weights?: ScoringWeights;
  scoring_thresholds?: ScoringThresholds;
}

export type BidGrade = "high" | "medium" | "low" | null;

export interface BidKeyword {
  id: string;
  keyword: string;
  bid_types: string[];
  is_active: boolean;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
  filter_conditions?: FilterConditions | null;
}

export interface BidNotice {
  id: string;
  bid_ntce_no: string;
  bid_ntce_ord: string;
  bid_ntce_nm: string;
  ntce_instt_nm: string | null;
  dminstt_nm: string | null;
  bid_ntce_dt: string | null;
  bid_clse_dt: string | null;
  openg_dt: string | null;
  presmpt_prce: number | null;
  asign_bdgt_amt: number | null;
  cntrct_cncls_mthd_nm: string | null;
  bid_type: string;
  ntce_kind_nm: string | null;
  bid_ntce_url: string | null;
  bid_ntce_dtl_url: string | null;
  source_keyword: string | null;
  match_reasons: string[] | null;
  best_score?: number | null;
  best_grade?: BidGrade;
  created_at: string;
}

export interface BidAlert {
  id: string;
  keyword_id: string;
  notice_id: string;
  channel: string;
  status: string;
  error_message: string | null;
  score?: number | null;
  grade?: BidGrade;
  signals?: Array<{ type: string; value: string; points: number }> | null;
  created_at: string;
  keyword_text: string | null;
  notice_title: string | null;
}

export interface BidCheckRun {
  id: string;
  status: "running" | "completed" | "failed";
  trigger_type: string;
  statistics: Record<string, number>;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface BidMonitorConfig {
  discord_webhook_url: string | null;
  check_interval_minutes: number;
  data_go_kr_api_key_set: boolean;
}

export interface BidMonitorStats {
  total_keywords: number;
  active_keywords: number;
  total_notices: number;
  total_alerts: number;
  high_count?: number;
  medium_count?: number;
  low_count?: number;
  recent_runs: BidCheckRun[];
  scheduler_running: boolean;
}
