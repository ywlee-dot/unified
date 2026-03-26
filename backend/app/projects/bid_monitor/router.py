"""API router for Bid Monitor project."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session
from app.projects.bid_monitor.schemas import (
    CheckTriggerRequest,
    ConfigUpdate,
    KeywordCreate,
    KeywordUpdate,
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
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.search_notices(db, keyword=keyword, bid_type=bid_type, sort=sort, page=page, page_size=page_size)


@router.get("/notices/{notice_id}")
async def get_notice(notice_id: str, db: AsyncSession = Depends(get_db_session)):
    notice = await _service.get_notice(db, notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다")
    return notice


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

@router.get("/alerts")
async def list_alerts(limit: int = 50, db: AsyncSession = Depends(get_db_session)):
    return await _service.get_alerts(db, limit=limit)


# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------

@router.post("/check/trigger")
async def trigger_check(request: CheckTriggerRequest | None = None, db: AsyncSession = Depends(get_db_session)):
    return await _service.trigger_check(db, trigger_type="manual")


@router.get("/check/runs")
async def get_check_runs(limit: int = 20, db: AsyncSession = Depends(get_db_session)):
    return await _service.get_check_runs(db, limit=limit)


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
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db_session)):
    return await _service.get_stats(db)
