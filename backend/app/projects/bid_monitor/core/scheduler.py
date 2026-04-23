"""APScheduler 기반 30분 간격 입찰공고 모니터링 스케줄러.

Stage 1: 넓은 수집 (키워드 + 유의어 + 분류 기반 전수 조회)
Stage 2: 가중치 기반 스코어링 — 공고 × 키워드 쌍마다 점수 산출
Stage 3: 등급 기반 알림 (high/medium/low)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.database import async_session_factory
from app.projects.bid_monitor.core.discord_notifier import DiscordNotifier
from app.projects.bid_monitor.core.g2b_client import G2BClient
from app.projects.bid_monitor.core.scoring_engine import compute_score
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


def _similarity_score(current_title: str, past_title: str, kws: list[str]) -> float:
    """두 공고 제목 간 유사도 (키워드 중복 + Jaccard)."""
    c = current_title.lower()
    p = past_title.lower()
    score = 0.0
    for kw in kws:
        if kw and kw.lower() in c and kw.lower() in p:
            score += 3.0
    cw, pw = set(c.split()), set(p.split())
    union = cw | pw
    if union:
        score += len(cw & pw) / len(union) * 5.0
    return round(score, 2)


async def _fetch_similar_past(notice: BidNoticeModel, kws: list[str]) -> list[dict]:
    """High-grade 공고의 동일 기관 과거 공고 전수 수집 후 유사도 스코어링."""
    import asyncio as _asyncio

    metadata = notice.metadata_json if isinstance(notice.metadata_json, dict) else {}
    dminstt_cd = metadata.get("dminsttCd")
    ntce_instt_cd = metadata.get("ntceInsttCd")
    if not dminstt_cd and not ntce_instt_cd:
        return []

    title = notice.bid_ntce_nm or ""
    bid_type = notice.bid_type or "services"
    end_ref = notice.bid_ntce_dt if notice.bid_ntce_dt else datetime.now(KST)

    g2b = G2BClient()

    async def _month(month_end: datetime) -> list[dict]:
        month_start = month_end - timedelta(days=30)
        items, _ = await g2b.fetch_by_institution(
            bid_type=bid_type,
            start_dt=month_start.strftime("%Y%m%d%H%M"),
            end_dt=month_end.strftime("%Y%m%d%H%M"),
            dminstt_cd=dminstt_cd,
            ntce_instt_cd=ntce_instt_cd if not dminstt_cd else None,
            num_of_rows=100,
        )
        return items

    cursor = end_ref
    month_ends = []
    for _ in range(24):
        month_ends.append(cursor)
        cursor = cursor - timedelta(days=31)

    results = []
    for month_end in month_ends:
        try:
            r = await _month(month_end)
            results.append(r)
        except Exception as exc:
            results.append(exc)
        await _asyncio.sleep(12)  # 분당 5 calls 제한

    current_key = (notice.bid_ntce_no, notice.bid_ntce_ord)
    seen: set[tuple[str, str]] = {current_key}
    candidates: list[dict] = []

    title_lower = title.lower()
    for result in results:
        if isinstance(result, Exception):
            continue
        for r in result:
            key = (r.get("bid_ntce_no", ""), r.get("bid_ntce_ord", "00"))
            if not key[0] or key in seen:
                continue
            seen.add(key)
            past_title = r.get("bid_ntce_nm") or ""
            sim = _similarity_score(title, past_title, kws)
            matched = [k for k in kws if k and k.lower() in title_lower and k.lower() in past_title.lower()]
            dt = r.get("bid_ntce_dt")
            clse = r.get("bid_clse_dt")
            candidates.append({
                "id": f"past-{key[0]}-{key[1]}",
                "bid_ntce_no": key[0],
                "bid_ntce_ord": key[1],
                "bid_ntce_nm": past_title,
                "ntce_instt_nm": r.get("ntce_instt_nm"),
                "dminstt_nm": r.get("dminstt_nm"),
                "bid_ntce_dt": dt.isoformat() if isinstance(dt, datetime) else dt,
                "bid_clse_dt": clse.isoformat() if isinstance(clse, datetime) else clse,
                "presmpt_prce": r.get("presmpt_prce"),
                "bid_ntce_url": r.get("bid_ntce_url"),
                "bid_ntce_dtl_url": r.get("bid_ntce_dtl_url"),
                "matched_keywords": matched,
                "similarity_score": sim,
            })

    candidates.sort(key=lambda x: x.get("similarity_score", 0), reverse=True)
    return candidates[:30]

# 알림 송출 기본 등급 임계값: medium 이상은 Discord 전송
GRADE_RANK = {"high": 3, "medium": 2, "low": 1, "none": 0, "excluded": -1}
DEFAULT_NOTIFY_THRESHOLD = "medium"


async def _get_config_value(db, key: str) -> str | None:
    result = await db.execute(
        select(BidMonitorConfigModel.value).where(BidMonitorConfigModel.key == key)
    )
    return result.scalar_one_or_none()


def _should_notify(grade: str, threshold: str) -> bool:
    return GRADE_RANK.get(grade, 0) >= GRADE_RANK.get(threshold, 2)


def _dedup_items(items_list: list[list[dict]]) -> list[dict]:
    """(bid_ntce_no, bid_ntce_ord) 기준 중복 제거."""
    seen: set[tuple[str, str]] = set()
    result: list[dict] = []
    for items in items_list:
        for item in items:
            key = (item.get("bid_ntce_no", ""), item.get("bid_ntce_ord", "00"))
            if key[0] and key not in seen:
                seen.add(key)
                result.append(item)
    return result


async def _collect_all_notices(
    g2b: G2BClient,
    bid_types: list[str],
    start_dt: str,
    end_dt: str,
    max_pages: int = 1,
) -> list[dict]:
    """bid_type별로 1회씩 전수 조회 (키워드 파라미터는 서버에서 무시되므로 사용 안 함)."""
    all_fetches: list[list[dict]] = []

    for bid_type in bid_types:
        for page in range(1, max_pages + 1):
            items, total = await g2b.fetch_notices(
                bid_type=bid_type,
                start_dt=start_dt,
                end_dt=end_dt,
                keyword=None,  # 서버 필터 무시되므로 None
                page=page,
                num_of_rows=999 if max_pages > 1 else 100,
            )
            if items:
                all_fetches.append(items)
            if not items or page * 999 >= total:
                break

    return _dedup_items(all_fetches)


async def run_check(
    trigger_type: str = "scheduled",
    window_minutes: int | None = None,
) -> dict:
    """입찰공고 체크. window_minutes 지정 시 지정 범위로 소급 백필 실행."""
    return await _run_check_impl(trigger_type, window_minutes)


async def _load_scoring_fc(db) -> dict | None:
    """전역 스코어링 설정 로드. 없으면 None 반환 (엔진이 기본값 사용)."""
    import json
    raw = await _get_config_value(db, "scoring_filter_conditions")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    return None


async def _run_check_impl(trigger_type: str, window_minutes: int | None) -> dict:
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

        stats = {
            "total_fetched": 0,
            "total_new": 0,
            "total_duplicate": 0,
            "grade_high": 0,
            "grade_medium": 0,
            "grade_low": 0,
            "grade_none": 0,
            "grade_excluded": 0,
            "total_alerts": 0,
            "total_error": 0,
        }

        try:
            webhook_url = await _get_config_value(db, "discord_webhook_url")
            notify_threshold = (
                await _get_config_value(db, "notify_grade_threshold")
            ) or DEFAULT_NOTIFY_THRESHOLD
            notifier = DiscordNotifier(webhook_url) if webhook_url else None

            # 전역 스코어링 설정 로드
            scoring_fc = await _load_scoring_fc(db)

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
            window = window_minutes if window_minutes is not None else 35
            max_pages = 1 if window <= 60 else min(10, (window // 60) + 2)
            end_dt = now.strftime("%Y%m%d%H%M")
            start_dt = (now - timedelta(minutes=window)).strftime("%Y%m%d%H%M")

            # 활성 키워드들이 커버하는 bid_types union (키워드 파라미터는 서버에서 무시되므로 bid_type만 사용)
            all_bid_types: set[str] = set()
            for kw in keywords:
                bt = kw.bid_types if isinstance(kw.bid_types, list) else ["goods", "services", "construction"]
                all_bid_types.update(bt)
            bid_types_list = sorted(all_bid_types) if all_bid_types else ["services"]

            # alert의 keyword_id FK용 기본 키워드 (첫 번째 active keyword)
            default_kw = keywords[0]

            logger.info("체크 시작: window=%d분, max_pages=%d, bid_types=%s, trigger=%s",
                        window, max_pages, bid_types_list, trigger_type)

            # Stage 1: bid_type별 1회씩만 전수 수집
            items = await _collect_all_notices(
                g2b=g2b,
                bid_types=bid_types_list,
                start_dt=start_dt,
                end_dt=end_dt,
                max_pages=max_pages,
            )
            stats["total_fetched"] = len(items)

            new_high_notices: list[BidNoticeModel] = []

            for item in items:
                ntce_no = item["bid_ntce_no"]
                ntce_ord = item.get("bid_ntce_ord", "00")

                # 공고 저장 (중복 제외)
                existing = await db.execute(
                    select(BidNoticeModel.id).where(
                        BidNoticeModel.bid_ntce_no == ntce_no,
                        BidNoticeModel.bid_ntce_ord == ntce_ord,
                    )
                )
                existing_id = existing.scalar_one_or_none()

                if existing_id:
                    stats["total_duplicate"] += 1
                    notice_id = existing_id
                    new_notice_obj: BidNoticeModel | None = None
                else:
                    notice = BidNoticeModel(
                        **{
                            k: v for k, v in item.items()
                            if k not in ("metadata_json", "source_keyword")
                        },
                        metadata_json=item.get("metadata_json", {}),
                        source_keyword="auto",
                    )
                    db.add(notice)
                    await db.flush()
                    notice_id = notice.id
                    new_notice_obj = notice
                    stats["total_new"] += 1

                # 이미 스코어링된 공고면 스킵
                existing_alert_q = await db.execute(
                    select(BidAlertModel).where(BidAlertModel.notice_id == notice_id)
                )
                if existing_alert_q.scalar_one_or_none():
                    continue

                # Stage 2: 전역 스코어링 설정으로 평가
                result = compute_score(item, scoring_fc)
                stats[f"grade_{result.grade}"] = stats.get(f"grade_{result.grade}", 0) + 1

                if result.grade == "high" and new_notice_obj is not None:
                    new_high_notices.append(new_notice_obj)

                do_notify = notifier is not None and _should_notify(result.grade, notify_threshold)
                sent = False
                err = None
                if do_notify:
                    sent = await notifier.send_bid_alert(
                        default_kw.keyword,
                        item,
                        match_reasons=result.reason_labels,
                    )
                    if not sent:
                        err = "Discord 전송 실패"

                alert = BidAlertModel(
                    keyword_id=default_kw.id,
                    notice_id=notice_id,
                    channel="discord" if do_notify else "none",
                    status="sent" if sent else ("pending" if not do_notify else "failed"),
                    error_message=err,
                    match_reasons=result.reason_labels,
                    score=result.score,
                    grade=result.grade,
                    signals=result.signals,
                )
                db.add(alert)

                if sent:
                    stats["total_alerts"] += 1
                elif do_notify:
                    stats["total_error"] += 1

            # High-grade 신규 공고 → 과거 유사 공고 사전 수집
            if new_high_notices:
                kws_for_similar = []
                if scoring_fc:
                    kws_for_similar = (
                        (scoring_fc.get("title_keywords") or [])
                        + (scoring_fc.get("search_aliases") or [])
                    )

                import asyncio as _asyncio

                async def _populate_one(n: BidNoticeModel) -> None:
                    try:
                        n.similar_past_json = await _fetch_similar_past(n, kws_for_similar)
                    except Exception:
                        logger.exception("similar_past 수집 실패: notice_id=%s", n.id)

                await _asyncio.gather(*[_populate_one(n) for n in new_high_notices], return_exceptions=True)
                logger.info("과거 유사 공고 사전 수집 완료: %d건", len(new_high_notices))

            # 모든 active 키워드 last_checked_at 동기 업데이트
            now_ts = datetime.now(KST)
            for kw in keywords:
                kw.last_checked_at = now_ts

            # 요약 전송
            if notifier and stats["total_new"] > 0:
                await notifier.send_summary(
                    stats["total_new"],
                    stats["total_alerts"],
                    len(keywords),
                )

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
