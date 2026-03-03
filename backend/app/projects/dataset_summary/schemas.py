"""Pydantic schemas for Dataset Summary project."""

from typing import Any

from pydantic import BaseModel


class SummaryResultItem(BaseModel):
    row_index: int
    group_key: str | None = None
    common: dict[str, str] = {}
    columns: list[str] = []
    keywords: list[str] = []
    description: str = ""
    prompt: str | None = None
    debug: dict[str, Any] | None = None
    rows: list[dict[str, Any]] | None = None


class SummarizeResponse(BaseModel):
    results: list[SummaryResultItem]
    debug: dict[str, Any] | None = None


class DatasetSummaryStats(BaseModel):
    total_generated: int
    mock_available: bool
    supported_formats: list[str]
