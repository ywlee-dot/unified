"""Pydantic schemas for Summarize project (n8n)."""

from datetime import datetime

from pydantic import BaseModel


class SummarizeTriggerRequest(BaseModel):
    text: str = ""
    parameters: dict[str, str] = {}


class SummarizeTriggerResponse(BaseModel):
    run_id: str
    status: str
    message: str


class SummarizeRun(BaseModel):
    run_id: str
    workflow_id: str
    workflow_name: str
    status: str  # "running" | "completed" | "failed"
    started_at: datetime
    finished_at: datetime | None = None
    result_data: dict | None = None
    error_message: str | None = None
