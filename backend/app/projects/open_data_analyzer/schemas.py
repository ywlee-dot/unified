"""Pydantic schemas for Open Data Analyzer project."""

from typing import Any

from pydantic import BaseModel


class StageResponse(BaseModel):
    session_id: str
    stage: int
    rows: list[dict[str, Any]]
    total: int
    openable_count: int | None = None
    not_openable_count: int | None = None
    file_count: int | None = None
    total_columns: int | None = None
    final_openable: int | None = None
    final_not_openable: int | None = None


class AnalyzerStats(BaseModel):
    active_sessions: int
    supported_formats: list[str]
    mock_available: bool
    stages: list[str]
