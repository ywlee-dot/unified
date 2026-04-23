"""Pydantic schemas for DA Topic Explorer project."""

from typing import Any

from pydantic import BaseModel


class UploadResponse(BaseModel):
    status: str
    message: str


class PipelineStartResponse(BaseModel):
    status: str
    task_id: str


class TaskStatusResponse(BaseModel):
    status: str
    message: str
    result: dict[str, Any] | None = None
    error: str | None = None


class GeneratePlansRequest(BaseModel):
    selected_topic_ids: list[str]
    context_path: str
