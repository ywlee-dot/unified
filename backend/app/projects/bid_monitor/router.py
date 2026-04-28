"""API router for Bid Monitor project."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session
from app.projects.bid_monitor.schemas import (
    BackfillRequest,
    CheckTriggerRequest,
    ConfigUpdate,
    FilterConditions,
    KeywordCreate,
    KeywordUpdate,
    ScoringConfigUpdate,
)
from app.projects.bid_monitor.service import BidMonitorService

router = APIRouter()
_service = BidMonitorService()


# ---------------------------------------------------------------------------
# Keywords
# ---------------------------------------------------------------------------

@router.get("/keywords")
async def list_keywords(db: AsyncSession = Depends(get_db_session)):
    return await _service.get_keywords(db)


@router.post("/keywords", status_code=201)
async def create_keyword(data: KeywordCreate, db: AsyncSession = Depends(get_db_session)):
    return await _service.create_keyword(db, data)


@router.get("/keywords/{keyword_id}")
async def get_keyword(keyword_id: str, db: AsyncSession = Depends(get_db_session)):
    kw = await _service.get_keyword(db, keyword_id)
    if not kw:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    return kw


@router.put("/keywords/{keyword_id}")
async def update_keyword(keyword_id: str, data: KeywordUpdate, db: AsyncSession = Depends(get_db_session)):
    kw = await _service.update_keyword(db, keyword_id, data)
    if not kw:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    return kw


@router.delete("/keywords/{keyword_id}")
async def delete_keyword(keyword_id: str, db: AsyncSession = Depends(get_db_session)):
    deleted = await _service.delete_keyword(db, keyword_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    return {"success": True, "message": "키워드가 삭제되었습니다"}


# ---------------------------------------------------------------------------
# Notices
# ---------------------------------------------------------------------------

@router.get("/notices")
async def search_notices(
    keyword: str | None = None,
    bid_type: str | None = None,
    sort: str = "date",
    page: int = 1,
    page_size: int = 20,
    grade: list[str] = Query(default=[]),
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.search_notices(
        db,
        keyword=keyword,
        bid_type=bid_type,
        sort=sort,
        page=page,
        page_size=page_size,
        grade=grade,
    )


@router.get("/notices/{notice_id}")
async def get_notice(notice_id: str, db: AsyncSession = Depends(get_db_session)):
    notice = await _service.get_notice(db, notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다")
    return notice


@router.get("/notices/{notice_id}/similar-past")
async def get_similar_past(
    notice_id: str,
    min_overlap: int = 2,
    limit: int = 10,
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.get_similar_past_notices(db, notice_id, min_overlap=min_overlap, limit=limit)


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@router.get("/alerts")
async def list_alerts(
    limit: int = 50,
    grade: str | None = None,
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.get_alerts(db, limit=limit, grade=grade)


# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------

@router.post("/check/trigger")
async def trigger_check(request: CheckTriggerRequest | None = None, db: AsyncSession = Depends(get_db_session)):
    return await _service.trigger_check(db, trigger_type="manual")


@router.post("/check/backfill")
async def trigger_backfill(request: BackfillRequest, db: AsyncSession = Depends(get_db_session)):
    return await _service.trigger_backfill(db, hours=request.hours)


@router.get("/check/runs")
async def get_check_runs(limit: int = 20, db: AsyncSession = Depends(get_db_session)):
    return await _service.get_check_runs(db, limit=limit)


# ---------------------------------------------------------------------------
# Cleanup (low/none/excluded 알림 + 고아 공고 보존 기간 후 삭제)
# ---------------------------------------------------------------------------

@router.post("/cleanup/trigger")
async def trigger_cleanup():
    """수동 정리 실행 — 매일 04:00 KST에 자동 실행되지만 즉시 실행할 때 사용."""
    from app.projects.bid_monitor.core.scheduler import run_cleanup
    return await run_cleanup()


@router.get("/cleanup/preview")
async def preview_cleanup():
    """현재 보존 기간 기준으로 삭제 대상 카운트만 미리 보여줌 (실제 삭제 안 함)."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func as sa_func, select

    from app.database import async_session_factory
    from app.projects.bid_monitor.core.scheduler import (
        LOW_VALUE_GRADES,
        RETENTION_DAYS,
    )
    from app.projects.bid_monitor.models import BidAlertModel, BidNoticeModel

    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    result: dict = {
        "cutoff": cutoff.isoformat(),
        "retention_days": RETENTION_DAYS,
        "low_value_grades": LOW_VALUE_GRADES,
        "alerts_to_delete_by_grade": {},
        "alerts_total_to_delete": 0,
        "notices_orphan_to_delete": 0,
    }

    async with async_session_factory() as db:
        for grade in LOW_VALUE_GRADES:
            count_stmt = (
                select(sa_func.count())
                .select_from(BidAlertModel)
                .where(
                    BidAlertModel.grade == grade,
                    BidAlertModel.created_at < cutoff,
                )
            )
            count = (await db.execute(count_stmt)).scalar() or 0
            result["alerts_to_delete_by_grade"][grade] = count
            result["alerts_total_to_delete"] += count

        orphan_count_stmt = (
            select(sa_func.count())
            .select_from(BidNoticeModel)
            .where(
                BidNoticeModel.created_at < cutoff,
                ~BidNoticeModel.id.in_(
                    select(BidAlertModel.notice_id).distinct()
                ),
            )
        )
        result["notices_orphan_to_delete"] = (
            (await db.execute(orphan_count_stmt)).scalar() or 0
        )

    return result


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@router.get("/config")
async def get_config(db: AsyncSession = Depends(get_db_session)):
    return await _service.get_config(db)


@router.put("/config")
async def update_config(data: ConfigUpdate, db: AsyncSession = Depends(get_db_session)):
    return await _service.update_config(db, data)


# ---------------------------------------------------------------------------
# Scoring Config (전역 스코어링 설정)
# ---------------------------------------------------------------------------

@router.get("/scoring-config")
async def get_scoring_config(db: AsyncSession = Depends(get_db_session)):
    return await _service.get_scoring_config(db)


@router.put("/scoring-config")
async def update_scoring_config(data: ScoringConfigUpdate, db: AsyncSession = Depends(get_db_session)):
    return await _service.update_scoring_config(db, data.filter_conditions)


# ---------------------------------------------------------------------------
# Order Plans (발주계획)
# ---------------------------------------------------------------------------

@router.get("/order-plans")
async def search_order_plans(
    keyword: str | None = None,
    bid_type: str | None = None,
    sort: str = "date",
    page: int = 1,
    page_size: int = 20,
    grade: list[str] = Query(default=[]),
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.search_order_plans(
        db, keyword=keyword, bid_type=bid_type, sort=sort,
        page=page, page_size=page_size, grade=grade,
    )


@router.get("/order-plans/{op_id}")
async def get_order_plan(op_id: str, db: AsyncSession = Depends(get_db_session)):
    op = await _service.get_order_plan(db, op_id)
    if not op:
        raise HTTPException(status_code=404, detail="발주계획을 찾을 수 없습니다")
    return op


# ---------------------------------------------------------------------------
# Pre-Specs (사전규격)
# ---------------------------------------------------------------------------

@router.get("/pre-specs")
async def search_pre_specs(
    keyword: str | None = None,
    bid_type: str | None = None,
    sort: str = "date",
    page: int = 1,
    page_size: int = 20,
    grade: list[str] = Query(default=[]),
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.search_pre_specs(
        db, keyword=keyword, bid_type=bid_type, sort=sort,
        page=page, page_size=page_size, grade=grade,
    )


@router.get("/pre-specs/{ps_id}")
async def get_pre_spec(ps_id: str, db: AsyncSession = Depends(get_db_session)):
    ps = await _service.get_pre_spec(db, ps_id)
    if not ps:
        raise HTTPException(status_code=404, detail="사전규격을 찾을 수 없습니다")
    return ps


# ---------------------------------------------------------------------------
# Pipeline (4단계 통합 타임라인)
# ---------------------------------------------------------------------------

@router.get("/pipeline/{target_type}/{target_id}")
async def get_pipeline_for(
    target_type: str,
    target_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """target_type: 'notice' | 'order_plan' | 'pre_spec'"""
    if target_type not in ("notice", "order_plan", "pre_spec"):
        raise HTTPException(status_code=400, detail="잘못된 target_type")
    timeline = await _service.get_pipeline_for(
        db, target_type=target_type, target_id=target_id,
    )
    if not timeline:
        return {"link": None, "order_plan": None, "pre_spec": None, "notice": None}
    return timeline


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db_session)):
    return await _service.get_stats(db)
