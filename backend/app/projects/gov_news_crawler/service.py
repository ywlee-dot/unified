"""Business logic for Government News Crawler project."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.projects.gov_news_crawler.models import (
    GovArticleModel,
    GovCrawlRunModel,
    GovKeywordModel,
    GovScoreModel,
    GovSourceModel,
)
from app.projects.gov_news_crawler.schemas import (
    ArticleDetailResponse,
    ArticleResponse,
    ArticleScoreSummary,
    CrawlRunResponse,
    CrawlTriggerRequest,
    GovNewsStats,
    KeywordCreate,
    KeywordResponse,
    KeywordUpdate,
    SourceCreate,
    SourceResponse,
)
from app.projects.gov_news_crawler.core.orchestrator import CrawlerOrchestrator


class GovNewsCrawlerService:
    """Service layer for the gov-news-crawler project."""

    # -------------------------------------------------------------------------
    # Keyword CRUD
    # -------------------------------------------------------------------------

    async def get_keywords(self, db: AsyncSession) -> list[KeywordResponse]:
        result = await db.execute(select(GovKeywordModel).order_by(GovKeywordModel.created_at.desc()))
        rows = result.scalars().all()
        return [self._keyword_to_response(r) for r in rows]

    async def create_keyword(self, db: AsyncSession, data: KeywordCreate) -> KeywordResponse:
        keyword = GovKeywordModel(
            query=data.query,
            category=data.category,
            synonyms=data.synonyms,
            target_entities=data.target_entities,
            is_active=data.is_active,
        )
        db.add(keyword)
        await db.commit()
        await db.refresh(keyword)
        return self._keyword_to_response(keyword)

    async def get_keyword(self, db: AsyncSession, keyword_id: str) -> KeywordResponse | None:
        result = await db.execute(
            select(GovKeywordModel).where(GovKeywordModel.id == keyword_id)
        )
        row = result.scalar_one_or_none()
        return self._keyword_to_response(row) if row else None

    async def update_keyword(
        self, db: AsyncSession, keyword_id: str, data: KeywordUpdate
    ) -> KeywordResponse | None:
        result = await db.execute(
            select(GovKeywordModel).where(GovKeywordModel.id == keyword_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(row, field, value)
        await db.commit()
        await db.refresh(row)
        return self._keyword_to_response(row)

    async def delete_keyword(self, db: AsyncSession, keyword_id: str) -> bool:
        result = await db.execute(
            select(GovKeywordModel).where(GovKeywordModel.id == keyword_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return False
        await db.delete(row)
        await db.commit()
        return True

    def _keyword_to_response(self, row: GovKeywordModel) -> KeywordResponse:
        return KeywordResponse(
            id=row.id,
            query=row.query,
            category=row.category,
            synonyms=row.synonyms if isinstance(row.synonyms, list) else [],
            target_entities=row.target_entities if isinstance(row.target_entities, dict) else {},
            is_active=row.is_active,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    # -------------------------------------------------------------------------
    # Source CRUD
    # -------------------------------------------------------------------------

    async def get_sources(self, db: AsyncSession) -> list[SourceResponse]:
        result = await db.execute(select(GovSourceModel).order_by(GovSourceModel.created_at.desc()))
        rows = result.scalars().all()
        return [self._source_to_response(r) for r in rows]

    async def create_source(self, db: AsyncSession, data: SourceCreate) -> SourceResponse:
        source = GovSourceModel(
            name=data.name,
            source_type=data.source_type,
            url=data.url,
            category=data.category,
            config=data.config,
            credibility_score=data.credibility_score,
            is_active=data.is_active,
        )
        db.add(source)
        await db.commit()
        await db.refresh(source)
        return self._source_to_response(source)

    def _source_to_response(self, row: GovSourceModel) -> SourceResponse:
        return SourceResponse(
            id=row.id,
            name=row.name,
            source_type=row.source_type,
            url=row.url,
            category=row.category,
            config=row.config if isinstance(row.config, dict) else {},
            credibility_score=row.credibility_score,
            is_active=row.is_active,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    # -------------------------------------------------------------------------
    # Articles
    # -------------------------------------------------------------------------

    async def search_articles(
        self,
        db: AsyncSession,
        keyword_id: str | None = None,
        min_score: float | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        source_type: str | None = None,
        sort: str = "score",
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        stmt = select(GovArticleModel)

        if source_type:
            stmt = stmt.where(GovArticleModel.source_type == source_type)
        if date_from:
            stmt = stmt.where(GovArticleModel.published_at >= date_from)
        if date_to:
            stmt = stmt.where(GovArticleModel.published_at <= date_to)

        # Join scores for filtering/sorting by score
        if keyword_id or min_score is not None or sort == "score":
            stmt = stmt.join(
                GovScoreModel,
                GovScoreModel.article_id == GovArticleModel.id,
                isouter=True,
            )
            if keyword_id:
                stmt = stmt.where(GovScoreModel.keyword_id == keyword_id)
            if min_score is not None:
                stmt = stmt.where(GovScoreModel.final_score >= min_score)
            if sort == "score":
                stmt = stmt.order_by(GovScoreModel.final_score.desc().nullslast())

        if sort == "date":
            stmt = stmt.order_by(GovArticleModel.published_at.desc().nullslast())
        elif sort != "score":
            stmt = stmt.order_by(GovArticleModel.created_at.desc())

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0

        # Paginate
        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)
        result = await db.execute(stmt)
        rows = result.scalars().all()

        return {
            "items": [self._article_to_response(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_article(self, db: AsyncSession, article_id: str) -> ArticleDetailResponse | None:
        result = await db.execute(
            select(GovArticleModel).where(GovArticleModel.id == article_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None

        scores_result = await db.execute(
            select(GovScoreModel).where(GovScoreModel.article_id == article_id)
        )
        scores = scores_result.scalars().all()

        return ArticleDetailResponse(
            id=row.id,
            url=row.url,
            title=row.title,
            content=row.content,
            summary=row.summary,
            author=row.author,
            published_at=row.published_at,
            source_type=row.source_type,
            institution_name=row.institution_name,
            leader_name=row.leader_name,
            metadata_json=row.metadata_json if isinstance(row.metadata_json, dict) else {},
            source_id=row.source_id,
            scores=[
                ArticleScoreSummary(
                    rule_total_score=s.rule_total_score,
                    ai_relevance_score=s.ai_relevance_score,
                    final_score=s.final_score,
                )
                for s in scores
            ],
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def _article_to_response(self, row: GovArticleModel) -> ArticleResponse:
        return ArticleResponse(
            id=row.id,
            url=row.url,
            title=row.title,
            summary=row.summary,
            author=row.author,
            published_at=row.published_at,
            source_type=row.source_type,
            institution_name=row.institution_name,
            leader_name=row.leader_name,
            created_at=row.created_at,
        )

    # -------------------------------------------------------------------------
    # Crawl
    # -------------------------------------------------------------------------

    async def trigger_crawl(
        self, db: AsyncSession, request: CrawlTriggerRequest
    ) -> CrawlRunResponse:
        keyword = None
        if request.keyword_id:
            result = await db.execute(
                select(GovKeywordModel).where(GovKeywordModel.id == request.keyword_id)
            )
            keyword = result.scalar_one_or_none()

        orchestrator = CrawlerOrchestrator()

        sources_result = await db.execute(
            select(GovSourceModel).where(GovSourceModel.is_active == True)
        )
        sources = sources_result.scalars().all()
        source_dicts = [
            {
                "id": s.id,
                "url": s.url,
                "name": s.name,
                "source_type": s.source_type,
                "config": s.config or {},
                "credibility_score": s.credibility_score,
            }
            for s in sources
        ]

        await orchestrator.run(
            db=db,
            keyword_model=keyword,
            sources=source_dicts,
            options={
                "enable_ai": request.enable_ai,
                "ai_top_n": request.ai_top_n,
            },
        )

        # Return the most recent crawl run
        run_result = await db.execute(
            select(GovCrawlRunModel)
            .where(GovCrawlRunModel.keyword_id == (keyword.id if keyword else None))
            .order_by(GovCrawlRunModel.started_at.desc())
            .limit(1)
        )
        run = run_result.scalar_one_or_none()
        if run is None:
            # Fallback: get latest overall
            run_result2 = await db.execute(
                select(GovCrawlRunModel).order_by(GovCrawlRunModel.started_at.desc()).limit(1)
            )
            run = run_result2.scalar_one_or_none()

        return self._crawl_run_to_response(run)

    async def get_crawl_runs(self, db: AsyncSession, limit: int = 20) -> list[CrawlRunResponse]:
        result = await db.execute(
            select(GovCrawlRunModel).order_by(GovCrawlRunModel.started_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        return [self._crawl_run_to_response(r) for r in rows]

    def _crawl_run_to_response(self, row: GovCrawlRunModel) -> CrawlRunResponse:
        return CrawlRunResponse(
            id=row.id,
            status=row.status,
            trigger_type=row.trigger_type,
            statistics=row.statistics if isinstance(row.statistics, dict) else {},
            error_message=row.error_message,
            started_at=row.started_at,
            completed_at=row.completed_at,
            keyword_id=row.keyword_id,
            created_at=row.created_at,
        )

    # -------------------------------------------------------------------------
    # Stats
    # -------------------------------------------------------------------------

    async def get_stats(self, db: AsyncSession) -> GovNewsStats:
        total_keywords = (await db.execute(select(func.count(GovKeywordModel.id)))).scalar() or 0
        active_keywords = (
            await db.execute(
                select(func.count(GovKeywordModel.id)).where(GovKeywordModel.is_active == True)
            )
        ).scalar() or 0
        total_sources = (await db.execute(select(func.count(GovSourceModel.id)))).scalar() or 0
        total_articles = (await db.execute(select(func.count(GovArticleModel.id)))).scalar() or 0

        # Recent crawl runs
        recent_runs_result = await db.execute(
            select(GovCrawlRunModel).order_by(GovCrawlRunModel.started_at.desc()).limit(10)
        )
        recent_runs = recent_runs_result.scalars().all()

        return GovNewsStats(
            total_keywords=total_keywords,
            active_keywords=active_keywords,
            total_sources=total_sources,
            total_articles=total_articles,
            recent_crawl_runs=[self._crawl_run_to_response(r) for r in recent_runs],
        )
