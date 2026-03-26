"""APScheduler 기반 30분 간격 입찰공고 모니터링 스케줄러."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.database import async_session_factory
from app.projects.bid_monitor.core.discord_notifier import DiscordNotifier
from app.projects.bid_monitor.core.g2b_client import G2BClient
from app.projects.bid_monitor.models import (
    BidAlertModel,
    BidCheckRunModel,
    BidKeywordModel,
    BidMonitorConfigModel,
    BidNoticeModel,
)

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None
KST = timezone(timedelta(hours=9))


async def _get_config_value(db, key: str) -> str | None:
    result = await db.execute(
        select(BidMonitorConfigModel.value).where(BidMonitorConfigModel.key == key)
    )
    return result.scalar_one_or_none()


async def run_check(trigger_type: str = "scheduled") -> dict:
    """입찰공고 체크 실행. 수동/스케줄 트리거 모두 사용."""
    async with async_session_factory() as db:
        now = datetime.now(KST)
        run = BidCheckRunModel(
            status="running",
            trigger_type=trigger_type,
            started_at=now,
            statistics={},
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)

        stats = {"total_fetched": 0, "total_new": 0, "total_duplicate": 0, "total_alerts": 0, "total_error": 0}

        try:
            # Discord 웹훅 URL 가져오기
            webhook_url = await _get_config_value(db, "discord_webhook_url")
            notifier = DiscordNotifier(webhook_url) if webhook_url else None

            # 활성 키워드 조회
            kw_result = await db.execute(
                select(BidKeywordModel).where(BidKeywordModel.is_active == True)
            )
            keywords = kw_result.scalars().all()

            if not keywords:
                logger.info("활성 키워드 없음 — 체크 스킵")
                run.status = "completed"
                run.completed_at = datetime.now(KST)
                run.statistics = stats
                await db.commit()
                return stats

            g2b = G2BClient()
            # 조회 범위: 최근 35분 (5분 여유)
            end_dt = now.strftime("%Y%m%d%H%M")
            start_dt = (now - timedelta(minutes=35)).strftime("%Y%m%d%H%M")

            for kw in keywords:
                bid_types = kw.bid_types if isinstance(kw.bid_types, list) else ["goods", "services", "construction"]

                for bid_type in bid_types:
                    items, total = await g2b.fetch_notices(
                        bid_type=bid_type,
                        start_dt=start_dt,
                        end_dt=end_dt,
                        keyword=kw.keyword,
                    )
                    stats["total_fetched"] += len(items)

                    for item in items:
                        ntce_no = item["bid_ntce_no"]
                        ntce_ord = item.get("bid_ntce_ord", "00")

                        # 중복 체크
                        existing = await db.execute(
                            select(BidNoticeModel.id).where(
                                BidNoticeModel.bid_ntce_no == ntce_no,
                                BidNoticeModel.bid_ntce_ord == ntce_ord,
                            )
                        )
                        if existing.scalar_one_or_none():
                            stats["total_duplicate"] += 1
                            continue

                        # 새 공고 저장
                        notice = BidNoticeModel(**{
                            k: v for k, v in item.items()
                            if k != "metadata_json"
                        }, metadata_json=item.get("metadata_json", {}))
                        db.add(notice)
                        await db.flush()
                        stats["total_new"] += 1

                        # Discord 알림
                        if notifier:
                            sent = await notifier.send_bid_alert(kw.keyword, item)
                            alert = BidAlertModel(
                                keyword_id=kw.id,
                                notice_id=notice.id,
                                channel="discord",
                                status="sent" if sent else "failed",
                                error_message=None if sent else "Discord 전송 실패",
                            )
                            db.add(alert)
                            if sent:
                                stats["total_alerts"] += 1
                            else:
                                stats["total_error"] += 1

                # 키워드 마지막 체크 시간 업데이트
                kw.last_checked_at = datetime.now(KST)

            # 요약 전송
            if notifier and stats["total_new"] > 0:
                await notifier.send_summary(stats["total_new"], stats["total_alerts"], len(keywords))

            run.status = "completed"

        except Exception as e:
            logger.exception("입찰공고 체크 실패")
            run.status = "failed"
            run.error_message = str(e)[:500]
            stats["total_error"] += 1

        run.completed_at = datetime.now(KST)
        run.statistics = stats
        await db.commit()

    logger.info("입찰공고 체크 완료: %s", stats)
    return stats


async def start_scheduler() -> None:
    """스케줄러 시작."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = AsyncIOScheduler(timezone="Asia/Seoul")

    # 기본 30분 간격. DB에서 interval 설정을 읽어올 수도 있지만 시작 시에는 기본값 사용
    _scheduler.add_job(
        run_check,
        trigger=IntervalTrigger(minutes=30),
        id="bid_monitor_check",
        replace_existing=True,
        kwargs={"trigger_type": "scheduled"},
    )
    _scheduler.start()
    logger.info("입찰공고 모니터링 스케줄러 시작 (30분 간격)")


async def stop_scheduler() -> None:
    """스케줄러 정지."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("입찰공고 모니터링 스케줄러 정지")
    _scheduler = None


def is_scheduler_running() -> bool:
    return _scheduler is not None and _scheduler.running
