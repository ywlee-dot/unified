"""Business logic service for Analytics project."""

from __future__ import annotations

from app.projects.analytics.dummy_data import (
    get_dummy_chart,
    get_dummy_dashboard,
    get_dummy_reports,
)
from app.projects.analytics.schemas import (
    AnalyticsReport,
    ChartData,
    DashboardSummary,
)


class AnalyticsService:
    """Service returning dummy data for scaffold."""

    async def get_dashboard(self, period: str = "today") -> DashboardSummary:
        return get_dummy_dashboard(period)

    async def get_chart(self, chart_type: str) -> ChartData | None:
        return get_dummy_chart(chart_type)

    async def get_reports(self, page: int = 1, page_size: int = 20) -> dict:
        reports = get_dummy_reports()
        total = len(reports)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": reports[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    async def get_report(self, report_id: str) -> AnalyticsReport | None:
        reports = get_dummy_reports()
        for report in reports:
            if report.id == report_id:
                return report
        return None

    async def get_stats_summary(self, period: str = "month") -> DashboardSummary:
        return get_dummy_dashboard(period)

    async def get_trends(self) -> ChartData:
        return get_dummy_chart("line")
