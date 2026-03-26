"""Business logic for Bid Monitor project."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.projects.bid_monitor.models import (
    BidAlertModel,
    BidCheckRunModel,
    BidKeywordModel,
    BidMonitorConfigModel,
    BidNoticeModel,
)
from app.projects.bid_monitor.schemas import (
    AlertResponse,
    BidMonitorStats,
    CheckRunResponse,
    ConfigResponse,
    ConfigUpdate,
    KeywordCreate,
    KeywordResponse,
    KeywordUpdate,
    NoticeDetailResponse,
    NoticeResponse,
)
from app.projects.bid_monitor.core.scheduler import is_scheduler_running, run_check


class BidMonitorService:

    # -----------------------------------------------------------------------
    # Keywords
    # -----------------------------------------------------------------------

    async def get_keywords(self, db: AsyncSession) -> list[KeywordResponse]:
        result = await db.execute(
            select(BidKeywordModel).order_by(BidKeywordModel.created_at.desc())
        )
        return [self._kw(r) for r in result.scalars().all()]

    async def create_keyword(self, db: AsyncSession, data: KeywordCreate) -> KeywordResponse:
        kw = BidKeywordModel(
            keyword=data.keyword,
            bid_types=data.bid_types,
            is_active=data.is_active,
        )
        db.add(kw)
        await db.commit()
        await db.refresh(kw)
        return self._kw(kw)

    async def get_keyword(self, db: AsyncSession, keyword_id: str) -> KeywordResponse | None:
        row = (await db.execute(
            select(BidKeywordModel).where(BidKeywordModel.id == keyword_id)
        )).scalar_one_or_none()
        return self._kw(row) if row else None

    async def update_keyword(self, db: AsyncSession, keyword_id: str, data: KeywordUpdate) -> KeywordResponse | None:
        row = (await db.execute(
            select(BidKeywordModel).where(BidKeywordModel.id == keyword_id)
        )).scalar_one_or_none()
        if not row:
            return None
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(row, field, value)
        await db.commit()
        await db.refresh(row)
        return self._kw(row)

    async def delete_keyword(self, db: AsyncSession, keyword_id: str) -> bool:
        row = (await db.execute(
            select(BidKeywordModel).where(BidKeywordModel.id == keyword_id)
        )).scalar_one_or_none()
        if not row:
            return False
        await db.delete(row)
        await db.commit()
        return True

    def _kw(self, row: BidKeywordModel) -> KeywordResponse:
        return KeywordResponse(
            id=row.id,
            keyword=row.keyword,
            bid_types=row.bid_types if isinstance(row.bid_types, list) else [],
            is_active=row.is_active,
            last_checked_at=row.last_checked_at,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    # -----------------------------------------------------------------------
    # Notices
    # -----------------------------------------------------------------------

    async def search_notices(
        self,
        db: AsyncSession,
        keyword: str | None = None,
        bid_type: str | None = None,
        sort: str = "date",
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        query = select(BidNoticeModel)

        if keyword:
            query = query.where(BidNoticeModel.bid_ntce_nm.ilike(f"%{keyword}%"))
        if bid_type:
            query = query.where(BidNoticeModel.bid_type == bid_type)

        # Count
        count_q = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_q)).scalar() or 0

        # Sort
        if sort == "price":
            query = query.order_by(BidNoticeModel.presmpt_prce.desc().nulls_last())
        elif sort == "deadline":
            query = query.order_by(BidNoticeModel.bid_clse_dt.asc().nulls_last())
        else:
            query = query.order_by(BidNoticeModel.created_at.desc())

        # Paginate
        query = query.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(query)).scalars().all()

        return {
            "items": [self._notice(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        }

    async def get_notice(self, db: AsyncSession, notice_id: str) -> NoticeDetailResponse | None:
        row = (await db.execute(
            select(BidNoticeModel).where(BidNoticeModel.id == notice_id)
        )).scalar_one_or_none()
        if not row:
            return None
        return NoticeDetailResponse(
            **self._notice(row).model_dump(),
            metadata_json=row.metadata_json if isinstance(row.metadata_json, dict) else {},
            updated_at=row.updated_at,
        )

    def _notice(self, row: BidNoticeModel) -> NoticeResponse:
        return NoticeResponse(
            id=row.id,
            bid_ntce_no=row.bid_ntce_no,
            bid_ntce_ord=row.bid_ntce_ord,
            bid_ntce_nm=row.bid_ntce_nm,
            ntce_instt_nm=row.ntce_instt_nm,
            dminstt_nm=row.dminstt_nm,
            bid_ntce_dt=row.bid_ntce_dt,
            bid_clse_dt=row.bid_clse_dt,
            openg_dt=row.openg_dt,
            presmpt_prce=row.presmpt_prce,
            asign_bdgt_amt=row.asign_bdgt_amt,
            cntrct_cncls_mthd_nm=row.cntrct_cncls_mthd_nm,
            bid_type=row.bid_type,
            ntce_kind_nm=row.ntce_kind_nm,
            bid_ntce_url=row.bid_ntce_url,
            bid_ntce_dtl_url=row.bid_ntce_dtl_url,
            created_at=row.created_at,
        )

    # -----------------------------------------------------------------------
    # Alerts
    # -----------------------------------------------------------------------

    async def get_alerts(self, db: AsyncSession, limit: int = 50) -> list[AlertResponse]:
        query = (
            select(
                BidAlertModel,
                BidKeywordModel.keyword,
                BidNoticeModel.bid_ntce_nm,
            )
            .outerjoin(BidKeywordModel, BidAlertModel.keyword_id == BidKeywordModel.id)
            .outerjoin(BidNoticeModel, BidAlertModel.notice_id == BidNoticeModel.id)
            .order_by(BidAlertModel.created_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(query)).all()
        return [
            AlertResponse(
                id=alert.id,
                keyword_id=alert.keyword_id,
                notice_id=alert.notice_id,
                channel=alert.channel,
                status=alert.status,
                error_message=alert.error_message,
                created_at=alert.created_at,
                keyword_text=kw_text,
                notice_title=ntce_title,
            )
            for alert, kw_text, ntce_title in rows
        ]

    # -----------------------------------------------------------------------
    # Check Runs
    # -----------------------------------------------------------------------

    async def trigger_check(self, db: AsyncSession, trigger_type: str = "manual") -> dict:
        return await run_check(trigger_type=trigger_type)

    async def get_check_runs(self, db: AsyncSession, limit: int = 20) -> list[CheckRunResponse]:
        result = await db.execute(
            select(BidCheckRunModel)
            .order_by(BidCheckRunModel.started_at.desc())
            .limit(limit)
        )
        return [
            CheckRunResponse(
                id=r.id,
                status=r.status,
                trigger_type=r.trigger_type,
                statistics=r.statistics if isinstance(r.statistics, dict) else {},
                error_message=r.error_message,
                started_at=r.started_at,
                completed_at=r.completed_at,
                created_at=r.created_at,
            )
            for r in result.scalars().all()
        ]

    # -----------------------------------------------------------------------
    # Config
    # -----------------------------------------------------------------------

    async def get_config(self, db: AsyncSession) -> ConfigResponse:
        rows = (await db.execute(select(BidMonitorConfigModel))).scalars().all()
        config_map = {r.key: r.value for r in rows}

        from app.config import settings
        api_key = getattr(settings, "DATA_GO_KR_API_KEY", None)

        return ConfigResponse(
            discord_webhook_url=config_map.get("discord_webhook_url"),
            check_interval_minutes=int(config_map.get("check_interval_minutes", "30")),
            data_go_kr_api_key_set=bool(api_key),
        )

    async def update_config(self, db: AsyncSession, data: ConfigUpdate) -> ConfigResponse:
        updates = data.model_dump(exclude_none=True)
        for key, value in updates.items():
            existing = (await db.execute(
                select(BidMonitorConfigModel).where(BidMonitorConfigModel.key == key)
            )).scalar_one_or_none()

            if existing:
                existing.value = str(value)
            else:
                db.add(BidMonitorConfigModel(key=key, value=str(value)))

        await db.commit()
        return await self.get_config(db)

    # -----------------------------------------------------------------------
    # Stats
    # -----------------------------------------------------------------------

    async def get_stats(self, db: AsyncSession) -> BidMonitorStats:
        total_kw = (await db.execute(select(func.count(BidKeywordModel.id)))).scalar() or 0
        active_kw = (await db.execute(
            select(func.count(BidKeywordModel.id)).where(BidKeywordModel.is_active == True)
        )).scalar() or 0
        total_notices = (await db.execute(select(func.count(BidNoticeModel.id)))).scalar() or 0
        total_alerts = (await db.execute(select(func.count(BidAlertModel.id)))).scalar() or 0

        runs_result = await db.execute(
            select(BidCheckRunModel).order_by(BidCheckRunModel.started_at.desc()).limit(10)
        )
        recent_runs = [
            CheckRunResponse(
                id=r.id,
                status=r.status,
                trigger_type=r.trigger_type,
                statistics=r.statistics if isinstance(r.statistics, dict) else {},
                error_message=r.error_message,
                started_at=r.started_at,
                completed_at=r.completed_at,
                created_at=r.created_at,
            )
            for r in runs_result.scalars().all()
        ]

        return BidMonitorStats(
            total_keywords=total_kw,
            active_keywords=active_kw,
            total_notices=total_notices,
            total_alerts=total_alerts,
            recent_runs=recent_runs,
            scheduler_running=is_scheduler_running(),
        )
