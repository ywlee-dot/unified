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

export interface OpenDataStageRow {
  table: string;
  key: string;
  openable?: string;
  reason_numbers?: number[];
  reason_text?: string;
  confidence?: number;
  has_columns?: boolean;
  column_count?: number;
  data_quality?: string;
  source_file?: string;
  file_sources?: string[];
  subject_area?: string;
  core_columns?: string[];
  dataset_description?: string;
  join_table?: string;
  join_keys?: string[];
  dataset_name?: string;
  final_columns?: string[];
  final_openable?: string;
  final_reason?: string;
}

export interface OpenDataStageResponse {
  session_id: string;
  stage: number;
  rows: OpenDataStageRow[];
  total: number;
  openable_count?: number;
  not_openable_count?: number;
  file_count?: number;
  total_columns?: number;
  final_openable?: number;
  final_not_openable?: number;
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
