"""API router for Analytics project."""

from fastapi import APIRouter, HTTPException

from app.projects.analytics.service import AnalyticsService

router = APIRouter()

_service = AnalyticsService()


@router.get("/dashboard")
async def get_dashboard(period: str = "today"):
    return await _service.get_dashboard(period=period)


@router.get("/charts/{chart_type}")
async def get_chart(chart_type: str):
    chart = await _service.get_chart(chart_type)
    if not chart:
        raise HTTPException(status_code=404, detail=f"차트 타입을 찾을 수 없습니다: {chart_type}")
    return chart


@router.get("/reports")
async def list_reports(page: int = 1, page_size: int = 20):
    return await _service.get_reports(page=page, page_size=page_size)


@router.get("/reports/{report_id}")
async def get_report(report_id: str):
    report = await _service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="리포트를 찾을 수 없습니다")
    return report


@router.get("/stats/summary")
async def get_stats_summary(period: str = "month"):
    return await _service.get_stats_summary(period=period)


@router.get("/stats/trends")
async def get_trends():
    return await _service.get_trends()
