"""Pydantic schemas for Data Pipeline project (n8n)."""

from datetime import datetime

from pydantic import BaseModel


class Pipeline(BaseModel):
    id: str
    name: str
    description: str
    source: str
    destination: str
    schedule: str | None = None
    status: str  # "active" | "inactive"
    last_run_at: datetime | None = None


class PipelineTriggerRequest(BaseModel):
    parameters: dict[str, str] = {}
    dry_run: bool = False


class PipelineRun(BaseModel):
    run_id: str
    pipeline_id: str
    pipeline_name: str
    status: str  # "running" | "completed" | "failed"
    started_at: datetime
    finished_at: datetime | None = None
    records_processed: int = 0
    records_failed: int = 0
    logs: list[str] | None = None
    error_message: str | None = None
