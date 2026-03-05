"""API router for Government News Crawler project."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db_session
from app.projects.gov_news_crawler.schemas import (
    CrawlTriggerRequest,
    KeywordCreate,
    KeywordUpdate,
    SourceCreate,
)
from app.projects.gov_news_crawler.service import GovNewsCrawlerService

router = APIRouter()
_service = GovNewsCrawlerService()


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
    keyword = await _service.get_keyword(db, keyword_id)
    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    return keyword


@router.put("/keywords/{keyword_id}")
async def update_keyword(
    keyword_id: str, data: KeywordUpdate, db: AsyncSession = Depends(get_db_session)
):
    keyword = await _service.update_keyword(db, keyword_id, data)
    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    return keyword


@router.delete("/keywords/{keyword_id}")
async def delete_keyword(keyword_id: str, db: AsyncSession = Depends(get_db_session)):
    deleted = await _service.delete_keyword(db, keyword_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    return {"success": True, "message": "키워드가 삭제되었습니다"}


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------

@router.get("/sources")
async def list_sources(db: AsyncSession = Depends(get_db_session)):
    return await _service.get_sources(db)


@router.post("/sources", status_code=201)
async def create_source(data: SourceCreate, db: AsyncSession = Depends(get_db_session)):
    return await _service.create_source(db, data)


# ---------------------------------------------------------------------------
# Articles
# ---------------------------------------------------------------------------

@router.get("/articles")
async def search_articles(
    keyword_id: str | None = None,
    min_score: float | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    source_type: str | None = None,
    sort: str = "score",
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db_session),
):
    return await _service.search_articles(
        db,
        keyword_id=keyword_id,
        min_score=min_score,
        date_from=date_from,
        date_to=date_to,
        source_type=source_type,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/articles/{article_id}")
async def get_article(article_id: str, db: AsyncSession = Depends(get_db_session)):
    article = await _service.get_article(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="기사를 찾을 수 없습니다")
    return article


# ---------------------------------------------------------------------------
# Crawl
# ---------------------------------------------------------------------------

@router.post("/crawl/trigger")
async def trigger_crawl(
    request: CrawlTriggerRequest, db: AsyncSession = Depends(get_db_session)
):
    return await _service.trigger_crawl(db, request)


@router.get("/crawl/runs")
async def get_crawl_runs(limit: int = 20, db: AsyncSession = Depends(get_db_session)):
    return await _service.get_crawl_runs(db, limit=limit)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db_session)):
    return await _service.get_stats(db)
