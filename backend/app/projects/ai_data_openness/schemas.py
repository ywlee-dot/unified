"""Pydantic schemas for AI Data Openness project."""

from typing import Any

from pydantic import BaseModel


# ── Phase 1 ──────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    session_id: str
    parsed: dict[str, Any]


class EvaluateRequest(BaseModel):
    session_id: str
    institution: str = "공공기관"
    provider_name: str = "claude"
    api_key: str = ""


class EvaluateResponse(BaseModel):
    provider: str
    institution: str
    total: int
    selected_count: int
    selected: list[dict[str, Any]]
    not_selected: list[dict[str, Any]]
    raw_response: str


class ReportResponse(BaseModel):
    report: str


# ── Phase 2 ──────────────────────────────────────────────────────────────────

class Phase2UploadResponse(BaseModel):
    session_id: str
    parsed: dict[str, Any]


class Phase2GenerateResponse(BaseModel):
    institution: str
    provider: str
    total: int
    representative: dict[str, Any]
    research_context: str
    draft: str
    review_feedback: str
    final_report: str
    sections: dict[str, str]


# ── Common ───────────────────────────────────────────────────────────────────

class ProvidersResponse(BaseModel):
    providers: list[str]
