"""Pydantic schemas for evaluation-rag project."""

from datetime import datetime
from pydantic import BaseModel, Field


class ImprovementItemSchema(BaseModel):
    """Individual improvement item in evaluation result."""

    category: str = Field(..., description="Category of improvement")
    issue: str = Field(..., description="Specific issue identified")
    recommendation: str = Field(..., description="Actionable recommendation")
    priority: str = Field(..., description="Priority level (critical/high/medium/low)")


class EvaluationItemScore(BaseModel):
    """Individual evaluation item score."""

    item_id: str = Field(..., description="Evaluation item ID (e.g. quality_01)")
    item_name: str = Field(..., description="Evaluation item name")
    category: str = Field(..., description="Category (quality/openness/analysis/sharing/management)")
    score: int = Field(..., ge=0, le=10, description="Item score (0-10)")
    max_score: int = Field(default=10, description="Maximum possible score")
    reasoning: str = Field(default="", description="Scoring rationale")
    issues: list[str] = Field(default_factory=list, description="Issues found for this item")
    improvements: list[str] = Field(default_factory=list, description="Improvements for this item")


class EvaluationCriteriaItem(BaseModel):
    """Single evaluation criteria item from the handbook."""

    item_id: str
    item_name: str
    category: str
    category_ko: str
    description: str
    scoring_criteria: str
    max_score: int = 10


class EvaluationCriteriaResponse(BaseModel):
    """Response for evaluation criteria lookup."""

    categories: list[dict] = Field(..., description="Categories with their items")
    total_items: int = Field(..., description="Total number of evaluation items")
    pinecone_namespace: str = Field(default="v2")


class EvaluationRequest(BaseModel):
    """Request for RAG-based evaluation."""

    input_data: str = Field(..., description="Data to evaluate", min_length=1)
    query: str = Field(..., description="Search query for criteria", min_length=1)
    category: str | None = Field(
        None,
        description="Optional category filter (quality, openness, analysis, sharing, management)",
    )


class SimpleEvaluationRequest(BaseModel):
    """Request for simple evaluation without RAG."""

    input_data: str = Field(..., description="Data to evaluate", min_length=1)
    query: str = Field(..., description="Evaluation query/criteria", min_length=1)
    category: str | None = Field(None, description="Optional category filter")


class EvaluationResponse(BaseModel):
    """Response from evaluation."""

    id: str = Field(..., description="Evaluation ID")
    summary: str = Field(..., description="Evaluation summary")
    score: int = Field(..., ge=0, le=100, description="Overall score (0-100), computed from item scores or legacy")
    issues: list[str] = Field(default_factory=list, description="List of issues found")
    improvements: list[ImprovementItemSchema] = Field(
        default_factory=list, description="List of improvements"
    )
    input_data: str = Field(..., description="Original input data")
    query: str = Field(..., description="Search query used")
    context: str = Field(..., description="Retrieved evaluation criteria")
    category: str | None = Field(None, description="Category filter applied")
    created_at: datetime = Field(..., description="Timestamp when evaluation was created")
    total_score: float | None = Field(None, description="Sum of item scores")
    max_possible_score: float | None = Field(None, description="Maximum possible score")
    item_scores: list[EvaluationItemScore] = Field(default_factory=list, description="Per-item scores")

    model_config = {"from_attributes": True}


class EvaluationListResponse(BaseModel):
    """Response for list of evaluations."""

    evaluations: list[EvaluationResponse]
    total: int = Field(..., description="Total number of evaluations")
    page: int = Field(default=1, description="Current page number")
    page_size: int = Field(default=20, description="Number of items per page")


class EvaluationStatsResponse(BaseModel):
    """Response for evaluation service statistics."""

    total_evaluations: int = Field(default=0, description="Total evaluations performed")
    average_score: float | None = Field(None, description="Average evaluation score")
    categories: list[str] = Field(
        default_factory=lambda: ["quality", "openness", "analysis", "sharing", "management"]
    )
    pinecone_connected: bool = Field(default=False, description="Whether Pinecone is connected")
    supported_formats: list[str] = Field(
        default_factory=lambda: [".pdf", ".txt", ".xlsx", ".xls", ".hwp", ".hwpx", ".docx"]
    )
