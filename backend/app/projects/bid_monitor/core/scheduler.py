"""APScheduler 기반 30분 간격 입찰공고 모니터링 스케줄러.

Stage 1: 넓은 수집 (키워드 + 유의어 + 분류 기반 전수 조회)
Stage 2: 가중치 기반 스코어링 — 공고 × 키워드 쌍마다 점수 산출
Stage 3: 등급 기반 알림 (high/medium/low)
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import delete as sql_delete, func as sa_func, select

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
    BidOrderPlanModel,
    BidPipelineLinkModel,
    BidPreSpecModel,
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


async def _collect_order_plans(
    g2b: G2BClient, bid_types: list[str], start_dt: str, end_dt: str,
) -> list[dict]:
    """발주계획 — bid_type별 1회씩 수집 + (order_plan_unty_no) 중복 제거."""
    all_items: list[dict] = []
    for bid_type in bid_types:
        items, _ = await g2b.fetch_order_plans(
            bid_type=bid_type, start_dt=start_dt, end_dt=end_dt, num_of_rows=100,
        )
        all_items.extend(items)
    seen: set[str] = set()
    out: list[dict] = []
    for it in all_items:
        key = it.get("order_plan_unty_no") or ""
        if key and key not in seen:
            seen.add(key)
            out.append(it)
    return out


async def _collect_pre_specs(
    g2b: G2BClient, bid_types: list[str], start_dt: str, end_dt: str,
) -> list[dict]:
    """사전규격 — bid_type별 1회씩 수집 + (bf_spec_rgst_no) 중복 제거."""
    all_items: list[dict] = []
    for bid_type in bid_types:
        items, _ = await g2b.fetch_pre_specs(
            bid_type=bid_type, start_dt=start_dt, end_dt=end_dt, num_of_rows=100,
        )
        all_items.extend(items)
    seen: set[str] = set()
    out: list[dict] = []
    for it in all_items:
        key = it.get("bf_spec_rgst_no") or ""
        if key and key not in seen:
            seen.add(key)
            out.append(it)
    return out


def _to_scoring_input(target_type: str, item: dict) -> dict:
    """발주계획/사전규격 item을 scoring engine이 기대하는 notice-style dict로 어댑트.

    scoring/filter는 item['bid_ntce_nm']을 title로, presmpt_prce|asign_bdgt_amt를 가격으로,
    metadata_json의 카테고리/플래그를 본다.
    """
    if target_type == "notice":
        return item
    if target_type == "order_plan":
        return {
            "bid_ntce_nm": item.get("prdct_clsfc_no_nm") or "",
            "ntce_instt_nm": item.get("ordr_instt_nm"),
            "dminstt_nm": item.get("ordr_instt_nm"),
            "presmpt_prce": None,
            "asign_bdgt_amt": item.get("asign_bdgt_amt"),
            "metadata_json": item.get("metadata_json", {}) or {},
        }
    if target_type == "pre_spec":
        return {
            "bid_ntce_nm": item.get("prdct_clsfc_no_nm") or "",
            "ntce_instt_nm": item.get("ntce_instt_nm"),
            "dminstt_nm": item.get("dminstt_nm"),
            "presmpt_prce": None,
            "asign_bdgt_amt": item.get("asign_bdgt_amt"),
            "metadata_json": item.get("metadata_json", {}) or {},
        }
    return item


async def _upsert_pipeline_link(
    db,
    *,
    bid_type: str,
    link: dict,
    notice_id: str | None = None,
    order_plan_id: str | None = None,
    pre_spec_id: str | None = None,
) -> None:
    """4단계 식별자 묶음 upsert. 어떤 단계의 ID라도 일치하면 갱신, 아니면 insert."""
    or_clauses = []
    if link.get("bid_ntce_no"):
        or_clauses.append(BidPipelineLinkModel.bid_ntce_no == link["bid_ntce_no"])
    if link.get("bf_spec_rgst_no"):
        or_clauses.append(BidPipelineLinkModel.bf_spec_rgst_no == link["bf_spec_rgst_no"])
    if link.get("order_plan_unty_no"):
        or_clauses.append(BidPipelineLinkModel.order_plan_unty_no == link["order_plan_unty_no"])
    if link.get("prcrmnt_req_no"):
        or_clauses.append(BidPipelineLinkModel.prcrmnt_req_no == link["prcrmnt_req_no"])
    if not or_clauses:
        return

    from sqlalchemy import or_ as sql_or
    existing = (await db.execute(
        select(BidPipelineLinkModel).where(sql_or(*or_clauses))
    )).scalar_one_or_none()

    now_ts = datetime.now(KST)
    if existing:
        # 부족한 필드만 채워주기 (이미 있는 값은 보존)
        for fk, val in (
            ("prcrmnt_req_no", link.get("prcrmnt_req_no")),
            ("order_plan_unty_no", link.get("order_plan_unty_no")),
            ("bf_spec_rgst_no", link.get("bf_spec_rgst_no")),
            ("bid_ntce_no", link.get("bid_ntce_no")),
            ("bid_ntce_ord", link.get("bid_ntce_ord")),
            ("cntrct_no", link.get("cntrct_no")),
        ):
            if val and not getattr(existing, fk):
                setattr(existing, fk, val)
        if notice_id and not existing.notice_id:
            existing.notice_id = notice_id
        if order_plan_id and not existing.order_plan_id:
            existing.order_plan_id = order_plan_id
        if pre_spec_id and not existing.pre_spec_id:
            existing.pre_spec_id = pre_spec_id
        existing.last_synced_at = now_ts
        existing.raw_response = link.get("raw_response") or existing.raw_response
        existing.bid_type = existing.bid_type or bid_type
    else:
        db.add(BidPipelineLinkModel(
            bid_type=bid_type,
            prcrmnt_req_no=link.get("prcrmnt_req_no"),
            order_plan_unty_no=link.get("order_plan_unty_no"),
            bf_spec_rgst_no=link.get("bf_spec_rgst_no"),
            bid_ntce_no=link.get("bid_ntce_no"),
            bid_ntce_ord=link.get("bid_ntce_ord"),
            cntrct_no=link.get("cntrct_no"),
            notice_id=notice_id,
            order_plan_id=order_plan_id,
            pre_spec_id=pre_spec_id,
            last_synced_at=now_ts,
            raw_response=link.get("raw_response") or {},
        ))


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
            # 발주계획
            "order_plans_fetched": 0,
            "order_plans_new": 0,
            "order_plans_alerts": 0,
            "order_plans_grade_high": 0,
            "order_plans_grade_medium": 0,
            "order_plans_grade_low": 0,
            # 사전규격
            "pre_specs_fetched": 0,
            "pre_specs_new": 0,
            "pre_specs_alerts": 0,
            "pre_specs_grade_high": 0,
            "pre_specs_grade_medium": 0,
            "pre_specs_grade_low": 0,
            # 연결 API
            "pipeline_links_synced": 0,
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

            # ─────────────────────────────────────────────────────────────
            # Stage 4: 발주계획 수집 + 스코어링 + 알림
            # ─────────────────────────────────────────────────────────────
            new_order_plans: list[tuple[BidOrderPlanModel, dict]] = []
            try:
                op_items = await _collect_order_plans(g2b, bid_types_list, start_dt, end_dt)
                stats["order_plans_fetched"] = len(op_items)

                for item in op_items:
                    op_no = item.get("order_plan_unty_no") or ""
                    if not op_no:
                        continue

                    existing = (await db.execute(
                        select(BidOrderPlanModel.id).where(
                            BidOrderPlanModel.order_plan_unty_no == op_no
                        )
                    )).scalar_one_or_none()
                    if existing:
                        continue

                    op_obj = BidOrderPlanModel(
                        order_plan_unty_no=op_no,
                        bid_type=item.get("bid_type", "services"),
                        prdct_clsfc_no_nm=item.get("prdct_clsfc_no_nm"),
                        asign_bdgt_amt=item.get("asign_bdgt_amt"),
                        ordr_plan_dt=item.get("ordr_plan_dt"),
                        ordr_yymm=item.get("ordr_yymm"),
                        ordr_instt_cd=item.get("ordr_instt_cd"),
                        ordr_instt_nm=item.get("ordr_instt_nm"),
                        metadata_json=item.get("metadata_json", {}),
                        source_keyword="auto",
                    )
                    db.add(op_obj)
                    await db.flush()
                    stats["order_plans_new"] += 1
                    new_order_plans.append((op_obj, item))

                    # scoring (재사용 — title을 prdct_clsfc_no_nm으로 어댑트)
                    score_input = _to_scoring_input("order_plan", item)
                    result = compute_score(score_input, scoring_fc)
                    stats[f"order_plans_grade_{result.grade}"] = (
                        stats.get(f"order_plans_grade_{result.grade}", 0) + 1
                    )

                    do_notify = (
                        notifier is not None
                        and _should_notify(result.grade, notify_threshold)
                    )
                    sent = False
                    err = None
                    if do_notify:
                        sent = await notifier.send_order_plan_alert(
                            default_kw.keyword, item,
                            match_reasons=result.reason_labels,
                        )
                        if not sent:
                            err = "Discord 전송 실패"

                    db.add(BidAlertModel(
                        keyword_id=default_kw.id,
                        target_type="order_plan",
                        order_plan_id=op_obj.id,
                        channel="discord" if do_notify else "none",
                        status="sent" if sent else ("pending" if not do_notify else "failed"),
                        error_message=err,
                        match_reasons=result.reason_labels,
                        score=result.score,
                        grade=result.grade,
                        signals=result.signals,
                    ))
                    if sent:
                        stats["order_plans_alerts"] += 1
                    elif do_notify:
                        stats["total_error"] += 1
            except Exception:
                logger.exception("발주계획 stage 실패")

            # ─────────────────────────────────────────────────────────────
            # Stage 5: 사전규격 수집 + 스코어링 + 알림
            # ─────────────────────────────────────────────────────────────
            new_pre_specs: list[tuple[BidPreSpecModel, dict]] = []
            try:
                ps_items = await _collect_pre_specs(g2b, bid_types_list, start_dt, end_dt)
                stats["pre_specs_fetched"] = len(ps_items)

                for item in ps_items:
                    ps_no = item.get("bf_spec_rgst_no") or ""
                    if not ps_no:
                        continue

                    existing = (await db.execute(
                        select(BidPreSpecModel.id).where(
                            BidPreSpecModel.bf_spec_rgst_no == ps_no
                        )
                    )).scalar_one_or_none()
                    if existing:
                        continue

                    ps_obj = BidPreSpecModel(
                        bf_spec_rgst_no=ps_no,
                        bid_type=item.get("bid_type", "services"),
                        prdct_clsfc_no_nm=item.get("prdct_clsfc_no_nm"),
                        asign_bdgt_amt=item.get("asign_bdgt_amt"),
                        rcept_bgn_dt=item.get("rcept_bgn_dt"),
                        rcept_clse_dt=item.get("rcept_clse_dt"),
                        rgst_dt=item.get("rgst_dt"),
                        ntce_instt_cd=item.get("ntce_instt_cd"),
                        ntce_instt_nm=item.get("ntce_instt_nm"),
                        dminstt_cd=item.get("dminstt_cd"),
                        dminstt_nm=item.get("dminstt_nm"),
                        metadata_json=item.get("metadata_json", {}),
                        source_keyword="auto",
                    )
                    db.add(ps_obj)
                    await db.flush()
                    stats["pre_specs_new"] += 1
                    new_pre_specs.append((ps_obj, item))

                    score_input = _to_scoring_input("pre_spec", item)
                    result = compute_score(score_input, scoring_fc)
                    stats[f"pre_specs_grade_{result.grade}"] = (
                        stats.get(f"pre_specs_grade_{result.grade}", 0) + 1
                    )

                    do_notify = (
                        notifier is not None
                        and _should_notify(result.grade, notify_threshold)
                    )
                    sent = False
                    err = None
                    if do_notify:
                        sent = await notifier.send_pre_spec_alert(
                            default_kw.keyword, item,
                            match_reasons=result.reason_labels,
                        )
                        if not sent:
                            err = "Discord 전송 실패"

                    db.add(BidAlertModel(
                        keyword_id=default_kw.id,
                        target_type="pre_spec",
                        pre_spec_id=ps_obj.id,
                        channel="discord" if do_notify else "none",
                        status="sent" if sent else ("pending" if not do_notify else "failed"),
                        error_message=err,
                        match_reasons=result.reason_labels,
                        score=result.score,
                        grade=result.grade,
                        signals=result.signals,
                    ))
                    if sent:
                        stats["pre_specs_alerts"] += 1
                    elif do_notify:
                        stats["total_error"] += 1
            except Exception:
                logger.exception("사전규격 stage 실패")

            # ─────────────────────────────────────────────────────────────
            # Stage 6: 연결 API — 신규 항목별 4단계 식별자 묶음 채우기
            # ─────────────────────────────────────────────────────────────
            try:
                # 신규 공고
                for n in new_high_notices:
                    link = await g2b.fetch_pipeline(
                        bid_type=n.bid_type,
                        bid_ntce_no=n.bid_ntce_no,
                        bid_ntce_ord=n.bid_ntce_ord,
                    )
                    if link:
                        await _upsert_pipeline_link(
                            db, bid_type=n.bid_type, link=link, notice_id=n.id,
                        )
                        stats["pipeline_links_synced"] += 1

                # 신규 발주계획
                for op_obj, _src in new_order_plans:
                    link = await g2b.fetch_pipeline(
                        bid_type=op_obj.bid_type,
                        order_plan_no=op_obj.order_plan_unty_no,
                    )
                    if link:
                        await _upsert_pipeline_link(
                            db, bid_type=op_obj.bid_type, link=link, order_plan_id=op_obj.id,
                        )
                        stats["pipeline_links_synced"] += 1

                # 신규 사전규격
                for ps_obj, _src in new_pre_specs:
                    link = await g2b.fetch_pipeline(
                        bid_type=ps_obj.bid_type,
                        bf_spec_rgst_no=ps_obj.bf_spec_rgst_no,
                    )
                    if link:
                        await _upsert_pipeline_link(
                            db, bid_type=ps_obj.bid_type, link=link, pre_spec_id=ps_obj.id,
                        )
                        stats["pipeline_links_synced"] += 1
            except Exception:
                logger.exception("연결 API stage 실패")

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

            # 요약 전송 (3종 중 하나라도 신규 있으면)
            if notifier and (
                stats["total_new"] > 0
                or stats["order_plans_new"] > 0
                or stats["pre_specs_new"] > 0
            ):
                await notifier.send_summary(
                    stats["total_new"],
                    stats["total_alerts"],
                    len(keywords),
                    new_order_plans=stats["order_plans_new"],
                    new_pre_specs=stats["pre_specs_new"],
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


RETENTION_DAYS = 90
LOW_VALUE_GRADES = ["low", "none", "excluded"]


async def run_cleanup() -> dict:
    """일일 정리: low/none/excluded 등급 알림과 고아 공고를 보존 기간 후 삭제.

    high/medium 등급은 영구 보관. 보존 기간(기본 90일) 경과 후 다음을 삭제:
    1. low/none/excluded 등급 bid_alerts
    2. 어떤 alert도 참조하지 않는 bid_notices (고아)
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    stats: dict = {
        "cutoff": cutoff.isoformat(),
        "retention_days": RETENTION_DAYS,
        "alerts_deleted_by_grade": {},
        "alerts_total_deleted": 0,
        "notices_orphan_deleted": 0,
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
            stats["alerts_deleted_by_grade"][grade] = count
            stats["alerts_total_deleted"] += count

        if stats["alerts_total_deleted"] > 0:
            del_alerts_stmt = sql_delete(BidAlertModel).where(
                BidAlertModel.grade.in_(LOW_VALUE_GRADES),
                BidAlertModel.created_at < cutoff,
            )
            await db.execute(del_alerts_stmt)

        orphan_subq = select(BidAlertModel.notice_id).distinct()
        orphan_count_stmt = (
            select(sa_func.count())
            .select_from(BidNoticeModel)
            .where(
                BidNoticeModel.created_at < cutoff,
                ~BidNoticeModel.id.in_(orphan_subq),
            )
        )
        orphan_count = (await db.execute(orphan_count_stmt)).scalar() or 0
        stats["notices_orphan_deleted"] = orphan_count

        if orphan_count > 0:
            del_notices_stmt = sql_delete(BidNoticeModel).where(
                BidNoticeModel.created_at < cutoff,
                ~BidNoticeModel.id.in_(select(BidAlertModel.notice_id).distinct()),
            )
            await db.execute(del_notices_stmt)

        await db.commit()

    logger.info("입찰 데이터 정리 완료: %s", stats)
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
    _scheduler.add_job(
        run_cleanup,
        trigger=CronTrigger(hour=4, minute=0),
        id="bid_monitor_cleanup",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "입찰공고 모니터링 스케줄러 시작 (체크 30분 간격, 정리 매일 04:00 KST, 보존 %d일)",
        RETENTION_DAYS,
    )


async def stop_scheduler() -> None:
    """스케줄러 정지."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("입찰공고 모니터링 스케줄러 정지")
    _scheduler = None


def is_scheduler_running() -> bool:
    return _scheduler is not None and _scheduler.running
