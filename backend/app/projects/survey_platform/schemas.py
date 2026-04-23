"""Pydantic schemas for Survey Platform project."""

from typing import Any

from pydantic import BaseModel


class SurveyCreateResponse(BaseModel):
    success: bool
    survey_id: str | None = None
    error: str | None = None


class SurveyListItem(BaseModel):
    survey_id: str
    survey_type: str
    institution_name: str
    start_date: str
    end_date: str
    status: str
    has_report: bool
    response_count: int
    created_at: str


class SurveyDetail(BaseModel):
    survey_metadata: dict[str, Any]
    sections: list[dict[str, Any]]
    questions: list[dict[str, Any]]
    logic_rules: list[dict[str, Any]]
    status: str
    response_count: int
    has_report: bool


class SubmitResponse(BaseModel):
    success: bool
    response_id: str | None = None
    error: str | None = None


class AnalysisStatusResponse(BaseModel):
    ready: bool
    generated_at: str | None = None


class SurveyUpdateRequest(BaseModel):
    institution_name: str
    start_date: str
    end_date: str
