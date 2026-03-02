"""Dummy data for Analytics project."""

from datetime import date, datetime, timedelta, timezone

from app.projects.analytics.schemas import (
    AnalyticsReport,
    ChartData,
    ChartDataset,
    DashboardSummary,
)

_now = datetime.now(timezone.utc)

CHART_DATA: dict[str, ChartData] = {
    "line": ChartData(
        chart_type="line",
        labels=["1월", "2월", "3월", "4월", "5월", "6월"],
        datasets=[
            ChartDataset(label="방문자", data=[4200, 5100, 4800, 6200, 5900, 7100], color="#3B82F6"),
            ChartDataset(label="가입자", data=[320, 410, 380, 520, 480, 610], color="#10B981"),
        ],
    ),
    "bar": ChartData(
        chart_type="bar",
        labels=["웹", "모바일", "API", "기타"],
        datasets=[
            ChartDataset(label="요청 수", data=[12000, 8500, 3200, 1100], color="#8B5CF6"),
        ],
    ),
    "pie": ChartData(
        chart_type="pie",
        labels=["직접 방문", "검색 유입", "소셜", "광고", "기타"],
        datasets=[
            ChartDataset(label="트래픽 소스", data=[35, 28, 18, 12, 7], color="#F59E0B"),
        ],
    ),
}

ANALYTICS_REPORTS: list[AnalyticsReport] = [
    AnalyticsReport(
        id="report-001", title="2026년 2월 월간 분석",
        period_start=date(2026, 2, 1), period_end=date(2026, 2, 28),
        summary="전월 대비 방문자 12% 증가",
        metrics={"total_views": 45200, "unique_users": 12300, "conversion_rate": 3.2, "avg_session_duration": 245},
        created_at=_now - timedelta(days=2),
    ),
    AnalyticsReport(
        id="report-002", title="2026년 1월 월간 분석",
        period_start=date(2026, 1, 1), period_end=date(2026, 1, 31),
        summary="신규 사용자 유입 증가세",
        metrics={"total_views": 40100, "unique_users": 10800, "conversion_rate": 2.9, "avg_session_duration": 230},
        created_at=_now - timedelta(days=30),
    ),
    AnalyticsReport(
        id="report-003", title="2025년 12월 월간 분석",
        period_start=date(2025, 12, 1), period_end=date(2025, 12, 31),
        summary="연말 이벤트 효과로 전환율 상승",
        metrics={"total_views": 38500, "unique_users": 9800, "conversion_rate": 3.5, "avg_session_duration": 260},
        created_at=_now - timedelta(days=62),
    ),
    AnalyticsReport(
        id="report-004", title="2025년 11월 월간 분석",
        period_start=date(2025, 11, 1), period_end=date(2025, 11, 30),
        summary="모바일 트래픽 비중 증가",
        metrics={"total_views": 35200, "unique_users": 9200, "conversion_rate": 2.7, "avg_session_duration": 215},
        created_at=_now - timedelta(days=92),
    ),
    AnalyticsReport(
        id="report-005", title="2025년 4분기 분기 분석",
        period_start=date(2025, 10, 1), period_end=date(2025, 12, 31),
        summary="4분기 전체 성장률 15% 달성",
        metrics={"total_views": 108900, "unique_users": 28500, "conversion_rate": 3.1, "avg_session_duration": 238},
        created_at=_now - timedelta(days=60),
    ),
    AnalyticsReport(
        id="report-006", title="2025년 연간 분석",
        period_start=date(2025, 1, 1), period_end=date(2025, 12, 31),
        summary="연간 방문자 수 전년 대비 35% 증가",
        metrics={"total_views": 420000, "unique_users": 95000, "conversion_rate": 2.8, "avg_session_duration": 225},
        created_at=_now - timedelta(days=58),
    ),
]


def get_dummy_dashboard(period: str = "today") -> DashboardSummary:
    data_map = {
        "today": DashboardSummary(total_views=1520, total_events=4230, active_users=342, conversion_rate=3.2, period="today"),
        "week": DashboardSummary(total_views=12400, total_events=32100, active_users=2100, conversion_rate=2.9, period="week"),
        "month": DashboardSummary(total_views=45200, total_events=125000, active_users=8500, conversion_rate=3.1, period="month"),
    }
    return data_map.get(period, data_map["today"])


def get_dummy_chart(chart_type: str) -> ChartData | None:
    return CHART_DATA.get(chart_type)


def get_dummy_reports() -> list[AnalyticsReport]:
    return ANALYTICS_REPORTS
