"""Pydantic schemas for Analytics project."""

from datetime import date, datetime

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_views: int
    total_events: int
    active_users: int
    conversion_rate: float
    period: str  # "today" | "week" | "month"


class ChartDataset(BaseModel):
    label: str
    data: list[float]
    color: str


class ChartData(BaseModel):
    chart_type: str  # "line" | "bar" | "pie"
    labels: list[str]
    datasets: list[ChartDataset]


class AnalyticsReport(BaseModel):
    id: str
    title: str
    period_start: date
    period_end: date
    summary: str
    metrics: dict[str, float]
    created_at: datetime
