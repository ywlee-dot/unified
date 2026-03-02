"""Pydantic schemas for Report Generator project (n8n)."""

from datetime import datetime

from pydantic import BaseModel


class N8nWorkflow(BaseModel):
    id: str
    name: str
    description: str
    trigger_type: str  # "manual" | "scheduled"
    last_run_at: datetime | None = None
    status: str  # "active" | "inactive"


class N8nTriggerRequest(BaseModel):
    parameters: dict[str, str] = {}


class N8nTriggerResponse(BaseModel):
    run_id: str
    status: str  # "triggered" | "queued"
    message: str


class N8nRunResult(BaseModel):
    run_id: str
    workflow_id: str
    workflow_name: str
    status: str  # "running" | "completed" | "failed"
    started_at: datetime
    finished_at: datetime | None = None
    result_data: dict | None = None
    download_url: str | None = None
    error_message: str | None = None
