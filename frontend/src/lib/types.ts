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

// --- Data Collector ---

export interface CollectorJob {
  id: string;
  name: string;
  source_type: "api" | "web" | "rss";
  source_url: string;
  schedule: string | null;
  status: "active" | "paused" | "error";
  last_run_at: string | null;
  collected_count: number;
  created_at: string;
}

export interface CollectionHistory {
  id: string;
  job_id: string;
  started_at: string;
  finished_at: string | null;
  status: "success" | "failed" | "running";
  items_collected: number;
  error_message: string | null;
}

export interface CollectorStats {
  total_jobs: number;
  active_jobs: number;
  total_collected: number;
  last_24h_collected: number;
  error_rate: number;
}

// --- Analytics ---

export interface DashboardSummary {
  total_views: number;
  total_events: number;
  active_users: number;
  conversion_rate: number;
  period: "today" | "week" | "month";
}

export interface ChartDataset {
  label: string;
  data: number[];
  color: string;
}

export interface ChartData {
  chart_type: "line" | "bar" | "pie";
  labels: string[];
  datasets: ChartDataset[];
}

export interface AnalyticsReport {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  summary: string;
  metrics: Record<string, number>;
  created_at: string;
}

// --- Notifications ---

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: "email" | "sms" | "webhook" | "slack";
  subject: string | null;
  body_template: string;
  variables: string[];
  created_at: string;
}

export interface NotificationHistory {
  id: string;
  template_name: string;
  channel: string;
  recipient: string;
  status: "sent" | "delivered" | "failed" | "pending";
  sent_at: string;
  error_message: string | null;
}

export interface NotificationStats {
  total_sent: number;
  delivered: number;
  failed: number;
  delivery_rate: number;
  by_channel: Record<string, number>;
}

// --- Content Manager ---

export interface Content {
  id: string;
  title: string;
  body: string;
  category_id: string;
  category_name: string;
  status: "draft" | "review" | "published" | "archived";
  author: string;
  tags: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  content_count: number;
  created_at: string;
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
