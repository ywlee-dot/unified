"""Business logic for Bid Monitor project."""

from __future__ import annotations

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.projects.bid_monitor.schemas import (
    AlertResponse,
    BidMonitorStats,
    CheckRunResponse,
    ConfigResponse,
    ConfigUpdate,
    FilterConditions,
    KeywordCreate,
    KeywordResponse,
    KeywordUpdate,
    NoticeDetailResponse,
    NoticeResponse,
    OrderPlanDetailResponse,
    OrderPlanResponse,
    PipelineLinkResponse,
    PipelineTimelineResponse,
    PreSpecDetailResponse,
    PreSpecResponse,
    ScoringConfigResponse,
)
from app.projects.bid_monitor.core.scheduler import is_scheduler_running, run_check


# grade 우선순위 매핑 (PostgreSQL CASE 표현용)
GRADE_PRIORITY_SQL = """
    CASE grade
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 1
        ELSE 0
    END
"""


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
            filter_conditions=data.filter_conditions.model_dump() if data.filter_conditions else None,
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
        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "filter_conditions" and value is not None:
                value = value if isinstance(value, dict) else value.model_dump() if hasattr(value, "model_dump") else value
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
            filter_conditions=row.filter_conditions if isinstance(row.filter_conditions, dict) else None,
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
        grade: list[str] | None = None,
    ) -> dict:
        # 등급 우선순위: high=3, medium=2, low=1 (그 외 0)
        grade_rank = case(
            (BidAlertModel.grade == "high", 3),
            (BidAlertModel.grade == "medium", 2),
            (BidAlertModel.grade == "low", 1),
            else_=0,
        )

        # 알림 집계 서브쿼리: 공고별 최고 점수 + 최고 등급 rank + match_reasons 합집합
        alert_sub = (
            select(
                BidAlertModel.notice_id,
                func.max(BidAlertModel.score).label("best_score"),
                func.max(grade_rank).label("best_rank"),
                func.array_agg(BidAlertModel.grade).label("grades"),
                func.array_agg(BidAlertModel.match_reasons).label("all_reasons"),
            )
            .group_by(BidAlertModel.notice_id)
            .subquery()
        )

        # 재공고 중복 제거: 같은 (제목, 공고기관) 조합에서 created_at 최신만 남김
        from sqlalchemy import func as _f, Integer
        dedup_sub = (
            select(
                BidNoticeModel.id,
                _f.row_number().over(
                    partition_by=(BidNoticeModel.bid_ntce_nm, BidNoticeModel.ntce_instt_nm),
                    order_by=BidNoticeModel.created_at.desc(),
                ).label("rn"),
            )
            .subquery()
        )

        query = (
            select(
                BidNoticeModel,
                alert_sub.c.best_score,
                alert_sub.c.grades,
                alert_sub.c.all_reasons,
            )
            .join(dedup_sub, BidNoticeModel.id == dedup_sub.c.id)
            .where(dedup_sub.c.rn == 1)
            .outerjoin(alert_sub, BidNoticeModel.id == alert_sub.c.notice_id)
        )

        if keyword:
            query = query.where(BidNoticeModel.bid_ntce_nm.ilike(f"%{keyword}%"))
        if bid_type:
            query = query.where(BidNoticeModel.bid_type == bid_type)

        if grade:
            rank_map = {"high": 3, "medium": 2, "low": 1}
            valid_ranks = [rank_map[g] for g in grade if g in rank_map]
            if valid_ranks:
                query = query.where(or_(*(alert_sub.c.best_rank == r for r in valid_ranks)))

        count_q = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_q)).scalar() or 0

        if sort == "price":
            query = query.order_by(BidNoticeModel.presmpt_prce.desc().nulls_last())
        elif sort == "deadline":
            query = query.order_by(BidNoticeModel.bid_clse_dt.asc().nulls_last())
        elif sort == "score":
            query = query.order_by(alert_sub.c.best_score.desc().nulls_last())
        else:
            query = query.order_by(BidNoticeModel.created_at.desc())

        query = query.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(query)).all()

        items = []
        for notice, best_score, grades, all_reasons in rows:
            resp = self._notice(notice)
            if best_score is not None:
                resp.best_score = float(best_score)
                resp.best_grade = self._best_grade(grades)
                resp.match_reasons = self._flatten_reasons(all_reasons)
            items.append(resp)

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        }

    def _best_grade(self, grades: list | None) -> str | None:
        if not grades:
            return None
        priority = {"high": 3, "medium": 2, "low": 1}
        best = None
        best_rank = -1
        for g in grades:
            if g in priority and priority[g] > best_rank:
                best = g
                best_rank = priority[g]
        return best

    def _flatten_reasons(self, all_reasons: list | None) -> list[str] | None:
        if not all_reasons:
            return None
        out: list[str] = []
        for mr in all_reasons:
            if isinstance(mr, list):
                out.extend(mr)
        return list(dict.fromkeys(out)) if out else None

    async def get_similar_past_notices(
        self, db: AsyncSession, notice_id: str, min_overlap: int = 0, limit: int = 10
    ) -> list[dict]:
        """동일 수요기관 과거 24개월 공고 전수 수집 후 유사도 순 반환.

        스케줄러에서 사전 수집된 캐시가 있으면 즉시 반환.
        없으면 G2B PPSSrch 엔드포인트로 실시간 조회 (월 단위 병렬 호출).
        """
        current = (await db.execute(
            select(BidNoticeModel).where(BidNoticeModel.id == notice_id)
        )).scalar_one_or_none()
        if not current:
            return []

        # 캐시 우선 반환 (similarity_score 기준 정렬 후 top-limit)
        if current.similar_past_json is not None:
            cached = sorted(
                current.similar_past_json,
                key=lambda x: x.get("similarity_score", 0),
                reverse=True,
            )
            return cached[:limit]

        # --- 실시간 조회 (캐시 미스 fallback) ---
        import asyncio
        from datetime import datetime, timedelta, timezone
        from app.projects.bid_monitor.core.g2b_client import G2BClient

        metadata = current.metadata_json if isinstance(current.metadata_json, dict) else {}
        dminstt_cd = metadata.get("dminsttCd")
        ntce_instt_cd = metadata.get("ntceInsttCd")
        if not dminstt_cd and not ntce_instt_cd:
            return []

        fc_resp = await self.get_scoring_config(db)
        kws = fc_resp.filter_conditions.title_keywords + fc_resp.filter_conditions.search_aliases
        if not kws:
            return []

        from app.projects.bid_monitor.core.scheduler import _similarity_score

        current_title = current.bid_ntce_nm or ""
        KST = timezone(timedelta(hours=9))
        bid_type = current.bid_type or "services"
        end_ref = current.bid_ntce_dt if current.bid_ntce_dt else datetime.now(KST)

        g2b = G2BClient()

        async def fetch_month(month_end: datetime):
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
        tasks = []
        for _ in range(24):
            tasks.append(fetch_month(cursor))
            cursor = cursor - timedelta(days=31)

        results_lists = await asyncio.gather(*tasks, return_exceptions=True)

        seen: set[tuple[str, str]] = {(current.bid_ntce_no, current.bid_ntce_ord)}
        candidates: list[dict] = []
        title_lower = current_title.lower()

        for result in results_lists:
            if isinstance(result, Exception):
                continue
            for item in result:
                key = (item.get("bid_ntce_no", ""), item.get("bid_ntce_ord", "00"))
                if not key[0] or key in seen:
                    continue
                seen.add(key)
                past_title = item.get("bid_ntce_nm") or ""
                sim = _similarity_score(current_title, past_title, kws)
                matched = [k for k in kws if k and k.lower() in title_lower and k.lower() in past_title.lower()]
                dt = item.get("bid_ntce_dt")
                clse = item.get("bid_clse_dt")
                candidates.append({
                    "id": f"past-{key[0]}-{key[1]}",
                    "bid_ntce_no": key[0],
                    "bid_ntce_ord": key[1],
                    "bid_ntce_nm": past_title,
                    "ntce_instt_nm": item.get("ntce_instt_nm"),
                    "dminstt_nm": item.get("dminstt_nm"),
                    "bid_ntce_dt": dt.isoformat() if isinstance(dt, datetime) else dt,
                    "bid_clse_dt": clse.isoformat() if isinstance(clse, datetime) else clse,
                    "presmpt_prce": item.get("presmpt_prce"),
                    "bid_ntce_url": item.get("bid_ntce_url"),
                    "bid_ntce_dtl_url": item.get("bid_ntce_dtl_url"),
                    "matched_keywords": matched,
                    "similarity_score": sim,
                })

        candidates.sort(key=lambda x: x.get("similarity_score", 0), reverse=True)
        return candidates[:limit]

    async def get_notice(self, db: AsyncSession, notice_id: str) -> NoticeDetailResponse | None:
        row = (await db.execute(
            select(BidNoticeModel).where(BidNoticeModel.id == notice_id)
        )).scalar_one_or_none()
        if not row:
            return None

        # 해당 공고의 알림들에서 점수/등급 추출
        alerts_q = await db.execute(
            select(BidAlertModel).where(BidAlertModel.notice_id == notice_id)
        )
        alerts = alerts_q.scalars().all()
        best_score = max((a.score or 0 for a in alerts), default=None) if alerts else None
        best_grade = self._best_grade([a.grade for a in alerts]) if alerts else None
        reasons = self._flatten_reasons([a.match_reasons for a in alerts]) if alerts else None

        base = self._notice(row).model_dump()
        base["best_score"] = float(best_score) if best_score is not None else None
        base["best_grade"] = best_grade
        base["match_reasons"] = reasons
        return NoticeDetailResponse(
            **base,
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
            source_keyword=row.source_keyword,
            created_at=row.created_at,
        )

    # -----------------------------------------------------------------------
    # Alerts
    # -----------------------------------------------------------------------

    async def get_alerts(
        self,
        db: AsyncSession,
        limit: int = 50,
        grade: str | None = None,
    ) -> list[AlertResponse]:
        query = (
            select(
                BidAlertModel,
                BidKeywordModel.keyword,
                BidNoticeModel.bid_ntce_nm,
            )
            .outerjoin(BidKeywordModel, BidAlertModel.keyword_id == BidKeywordModel.id)
            .outerjoin(BidNoticeModel, BidAlertModel.notice_id == BidNoticeModel.id)
        )
        if grade in ("high", "medium", "low"):
            query = query.where(BidAlertModel.grade == grade)
        query = query.order_by(
            BidAlertModel.score.desc().nulls_last(),
            BidAlertModel.created_at.desc(),
        ).limit(limit)

        rows = (await db.execute(query)).all()
        return [
            AlertResponse(
                id=alert.id,
                keyword_id=alert.keyword_id,
                notice_id=alert.notice_id,
                channel=alert.channel,
                status=alert.status,
                error_message=alert.error_message,
                match_reasons=alert.match_reasons if isinstance(alert.match_reasons, list) else None,
                score=alert.score,
                grade=alert.grade,
                signals=alert.signals if isinstance(alert.signals, list) else None,
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

    async def trigger_backfill(self, db: AsyncSession, hours: int) -> dict:
        hours = max(1, min(168, hours))  # 1h ~ 7d 제한
        return await run_check(trigger_type="backfill", window_minutes=hours * 60)

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
            notify_grade_threshold=config_map.get("notify_grade_threshold", "medium"),
            data_go_kr_api_key_set=bool(api_key),
        )

    # -----------------------------------------------------------------------
    # Scoring Config (전역 스코어링 설정)
    # -----------------------------------------------------------------------

    _DEFAULT_SCORING_FC = {
        "title_keywords": ["공공데이터", "데이터기반행정", "데이터 기반 행정"],
        "title_exclude": [
            "ISP", "ISMP", "영향평가", "감리", "빅데이터 분석플랫폼", "분석플랫폼",
            "정보보안", "성과관리", "장비", "PC", "노트북", "차량", "구매", "교체",
            "하드웨어", "재활용", "엑스선", "배수로",
        ],
        "search_aliases": [
            "공공데이터 개방", "공공데이터 제공", "공공데이터 활용",
            "데이터기반행정 활성화", "데이터 기반 행정 활성화",
            "품질관리 컨설팅", "품질관리 용역",
        ],
        "keyword_combinations": [
            ["공공데이터", "데이터기반행정"],
            ["공공데이터", "데이터 기반 행정"],
            ["공공데이터", "품질관리"],
        ],
        "categories": {
            "pubPrcrmntLrgClsfcNm": ["ICT 서비스"],
            "pubPrcrmntClsfcNm": ["데이터서비스", "정보화전략계획서비스", "정보통신연구조사서비스"],
            "pubPrcrmntMidClsfcNm": ["ICT사업 컨설팅", "DB구축 및 자료입력"],
        },
        "scoring_weights": {
            "title_keyword": 25, "title_alias": 20, "keyword_combo_bonus": 30,
            "category_exact": 10, "category_mid": 5, "category_large": 3,
            "institution": 10, "flag": 10, "price_in_range": 5, "price_out_range": -5,
        },
        "scoring_thresholds": {"high": 80, "medium": 50, "low": 25},
    }

    async def get_scoring_config(self, db: AsyncSession) -> ScoringConfigResponse:
        import json
        raw = (await db.execute(
            select(BidMonitorConfigModel).where(BidMonitorConfigModel.key == "scoring_filter_conditions")
        )).scalar_one_or_none()
        if raw:
            fc_dict = json.loads(raw.value)
        else:
            fc_dict = self._DEFAULT_SCORING_FC
        return ScoringConfigResponse(filter_conditions=FilterConditions(**fc_dict))

    async def update_scoring_config(self, db: AsyncSession, fc: FilterConditions) -> ScoringConfigResponse:
        import json
        fc_dict = fc.model_dump()
        existing = (await db.execute(
            select(BidMonitorConfigModel).where(BidMonitorConfigModel.key == "scoring_filter_conditions")
        )).scalar_one_or_none()
        if existing:
            existing.value = json.dumps(fc_dict, ensure_ascii=False)
        else:
            db.add(BidMonitorConfigModel(key="scoring_filter_conditions", value=json.dumps(fc_dict, ensure_ascii=False)))
        await db.commit()
        return ScoringConfigResponse(filter_conditions=fc)

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

        # 공고별 최고 등급 집계 — 한 공고가 여러 키워드에서 매칭되면 최고 등급만 카운트
        grade_subq = (
            select(
                BidAlertModel.notice_id,
                func.max(
                    func.coalesce(
                        # high=3, medium=2, low=1 (CASE)
                        func.nullif(
                            func.coalesce(BidAlertModel.grade, ""), ""
                        ), ""
                    )
                )
            )
            .where(BidAlertModel.grade.in_(["high", "medium", "low"]))
            .group_by(BidAlertModel.notice_id)
        ).subquery()

        # 각 등급별 카운트 (단순 alerts 테이블 기준)
        grade_counts = {}
        for g in ("high", "medium", "low"):
            c = (await db.execute(
                select(func.count(func.distinct(BidAlertModel.notice_id)))
                .where(BidAlertModel.grade == g)
            )).scalar() or 0
            grade_counts[g] = c

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

        # 발주계획·사전규격 카운트
        total_op = (await db.execute(select(func.count(BidOrderPlanModel.id)))).scalar() or 0
        total_ps = (await db.execute(select(func.count(BidPreSpecModel.id)))).scalar() or 0
        op_grade = {}
        ps_grade = {}
        for g in ("high", "medium", "low"):
            op_grade[g] = (await db.execute(
                select(func.count(func.distinct(BidAlertModel.order_plan_id)))
                .where(BidAlertModel.target_type == "order_plan", BidAlertModel.grade == g)
            )).scalar() or 0
            ps_grade[g] = (await db.execute(
                select(func.count(func.distinct(BidAlertModel.pre_spec_id)))
                .where(BidAlertModel.target_type == "pre_spec", BidAlertModel.grade == g)
            )).scalar() or 0

        return BidMonitorStats(
            total_keywords=total_kw,
            active_keywords=active_kw,
            total_notices=total_notices,
            total_alerts=total_alerts,
            high_count=grade_counts["high"],
            medium_count=grade_counts["medium"],
            low_count=grade_counts["low"],
            total_order_plans=total_op,
            total_pre_specs=total_ps,
            high_count_order_plans=op_grade["high"],
            medium_count_order_plans=op_grade["medium"],
            low_count_order_plans=op_grade["low"],
            high_count_pre_specs=ps_grade["high"],
            medium_count_pre_specs=ps_grade["medium"],
            low_count_pre_specs=ps_grade["low"],
            recent_runs=recent_runs,
            scheduler_running=is_scheduler_running(),
        )

    # -----------------------------------------------------------------------
    # Order Plans (발주계획)
    # -----------------------------------------------------------------------

    async def search_order_plans(
        self,
        db: AsyncSession,
        keyword: str | None = None,
        bid_type: str | None = None,
        sort: str = "date",
        page: int = 1,
        page_size: int = 20,
        grade: list[str] | None = None,
    ) -> dict:
        # alert 집계 서브쿼리 (target_type='order_plan')
        grade_rank = case(
            (BidAlertModel.grade == "high", 3),
            (BidAlertModel.grade == "medium", 2),
            (BidAlertModel.grade == "low", 1),
            else_=0,
        )
        alert_sub = (
            select(
                BidAlertModel.order_plan_id.label("oid"),
                func.max(BidAlertModel.score).label("best_score"),
                func.max(grade_rank).label("best_rank"),
                func.array_agg(BidAlertModel.grade).label("grades"),
                func.array_agg(BidAlertModel.match_reasons).label("all_reasons"),
            )
            .where(BidAlertModel.target_type == "order_plan")
            .group_by(BidAlertModel.order_plan_id)
            .subquery()
        )
        query = (
            select(
                BidOrderPlanModel,
                alert_sub.c.best_score,
                alert_sub.c.grades,
                alert_sub.c.all_reasons,
            )
            .outerjoin(alert_sub, BidOrderPlanModel.id == alert_sub.c.oid)
        )
        if keyword:
            query = query.where(BidOrderPlanModel.prdct_clsfc_no_nm.ilike(f"%{keyword}%"))
        if bid_type:
            query = query.where(BidOrderPlanModel.bid_type == bid_type)
        if grade:
            rmap = {"high": 3, "medium": 2, "low": 1}
            ranks = [rmap[g] for g in grade if g in rmap]
            if ranks:
                query = query.where(or_(*(alert_sub.c.best_rank == r for r in ranks)))

        total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

        if sort == "price":
            query = query.order_by(BidOrderPlanModel.asign_bdgt_amt.desc().nulls_last())
        elif sort == "ordr":
            query = query.order_by(BidOrderPlanModel.ordr_plan_dt.asc().nulls_last())
        elif sort == "score":
            query = query.order_by(alert_sub.c.best_score.desc().nulls_last())
        else:
            query = query.order_by(BidOrderPlanModel.created_at.desc())

        query = query.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(query)).all()

        items = []
        for row, best_score, grades, all_reasons in rows:
            resp = self._order_plan(row)
            if best_score is not None:
                resp.best_score = float(best_score)
                resp.best_grade = self._best_grade(grades)
                resp.match_reasons = self._flatten_reasons(all_reasons)
            items.append(resp)
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        }

    async def get_order_plan(self, db: AsyncSession, op_id: str) -> OrderPlanDetailResponse | None:
        row = (await db.execute(
            select(BidOrderPlanModel).where(BidOrderPlanModel.id == op_id)
        )).scalar_one_or_none()
        if not row:
            return None
        alerts = (await db.execute(
            select(BidAlertModel).where(BidAlertModel.order_plan_id == op_id)
        )).scalars().all()
        best_score = max((a.score or 0 for a in alerts), default=None) if alerts else None
        best_grade = self._best_grade([a.grade for a in alerts]) if alerts else None
        reasons = self._flatten_reasons([a.match_reasons for a in alerts]) if alerts else None
        base = self._order_plan(row).model_dump()
        base["best_score"] = float(best_score) if best_score is not None else None
        base["best_grade"] = best_grade
        base["match_reasons"] = reasons
        return OrderPlanDetailResponse(
            **base,
            metadata_json=row.metadata_json if isinstance(row.metadata_json, dict) else {},
            updated_at=row.updated_at,
        )

    def _order_plan(self, row: BidOrderPlanModel) -> OrderPlanResponse:
        return OrderPlanResponse(
            id=row.id,
            order_plan_unty_no=row.order_plan_unty_no,
            bid_type=row.bid_type,
            prdct_clsfc_no_nm=row.prdct_clsfc_no_nm,
            asign_bdgt_amt=row.asign_bdgt_amt,
            ordr_plan_dt=row.ordr_plan_dt,
            ordr_yymm=row.ordr_yymm,
            ordr_instt_cd=row.ordr_instt_cd,
            ordr_instt_nm=row.ordr_instt_nm,
            source_keyword=row.source_keyword,
            created_at=row.created_at,
        )

    # -----------------------------------------------------------------------
    # Pre-Specs (사전규격)
    # -----------------------------------------------------------------------

    async def search_pre_specs(
        self,
        db: AsyncSession,
        keyword: str | None = None,
        bid_type: str | None = None,
        sort: str = "date",
        page: int = 1,
        page_size: int = 20,
        grade: list[str] | None = None,
    ) -> dict:
        grade_rank = case(
            (BidAlertModel.grade == "high", 3),
            (BidAlertModel.grade == "medium", 2),
            (BidAlertModel.grade == "low", 1),
            else_=0,
        )
        alert_sub = (
            select(
                BidAlertModel.pre_spec_id.label("psid"),
                func.max(BidAlertModel.score).label("best_score"),
                func.max(grade_rank).label("best_rank"),
                func.array_agg(BidAlertModel.grade).label("grades"),
                func.array_agg(BidAlertModel.match_reasons).label("all_reasons"),
            )
            .where(BidAlertModel.target_type == "pre_spec")
            .group_by(BidAlertModel.pre_spec_id)
            .subquery()
        )
        query = (
            select(
                BidPreSpecModel,
                alert_sub.c.best_score,
                alert_sub.c.grades,
                alert_sub.c.all_reasons,
            )
            .outerjoin(alert_sub, BidPreSpecModel.id == alert_sub.c.psid)
        )
        if keyword:
            query = query.where(BidPreSpecModel.prdct_clsfc_no_nm.ilike(f"%{keyword}%"))
        if bid_type:
            query = query.where(BidPreSpecModel.bid_type == bid_type)
        if grade:
            rmap = {"high": 3, "medium": 2, "low": 1}
            ranks = [rmap[g] for g in grade if g in rmap]
            if ranks:
                query = query.where(or_(*(alert_sub.c.best_rank == r for r in ranks)))

        total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

        if sort == "price":
            query = query.order_by(BidPreSpecModel.asign_bdgt_amt.desc().nulls_last())
        elif sort == "deadline":
            query = query.order_by(BidPreSpecModel.rcept_clse_dt.asc().nulls_last())
        elif sort == "score":
            query = query.order_by(alert_sub.c.best_score.desc().nulls_last())
        else:
            query = query.order_by(BidPreSpecModel.created_at.desc())

        query = query.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(query)).all()
        items = []
        for row, best_score, grades, all_reasons in rows:
            resp = self._pre_spec(row)
            if best_score is not None:
                resp.best_score = float(best_score)
                resp.best_grade = self._best_grade(grades)
                resp.match_reasons = self._flatten_reasons(all_reasons)
            items.append(resp)
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        }

    async def get_pre_spec(self, db: AsyncSession, ps_id: str) -> PreSpecDetailResponse | None:
        row = (await db.execute(
            select(BidPreSpecModel).where(BidPreSpecModel.id == ps_id)
        )).scalar_one_or_none()
        if not row:
            return None
        alerts = (await db.execute(
            select(BidAlertModel).where(BidAlertModel.pre_spec_id == ps_id)
        )).scalars().all()
        best_score = max((a.score or 0 for a in alerts), default=None) if alerts else None
        best_grade = self._best_grade([a.grade for a in alerts]) if alerts else None
        reasons = self._flatten_reasons([a.match_reasons for a in alerts]) if alerts else None
        base = self._pre_spec(row).model_dump()
        base["best_score"] = float(best_score) if best_score is not None else None
        base["best_grade"] = best_grade
        base["match_reasons"] = reasons
        return PreSpecDetailResponse(
            **base,
            metadata_json=row.metadata_json if isinstance(row.metadata_json, dict) else {},
            updated_at=row.updated_at,
        )

    def _pre_spec(self, row: BidPreSpecModel) -> PreSpecResponse:
        return PreSpecResponse(
            id=row.id,
            bf_spec_rgst_no=row.bf_spec_rgst_no,
            bid_type=row.bid_type,
            prdct_clsfc_no_nm=row.prdct_clsfc_no_nm,
            asign_bdgt_amt=row.asign_bdgt_amt,
            rcept_bgn_dt=row.rcept_bgn_dt,
            rcept_clse_dt=row.rcept_clse_dt,
            rgst_dt=row.rgst_dt,
            ntce_instt_cd=row.ntce_instt_cd,
            ntce_instt_nm=row.ntce_instt_nm,
            dminstt_cd=row.dminstt_cd,
            dminstt_nm=row.dminstt_nm,
            source_keyword=row.source_keyword,
            created_at=row.created_at,
        )

    # -----------------------------------------------------------------------
    # Pipeline (계약과정통합공개) — 한 사업의 4단계 타임라인
    # -----------------------------------------------------------------------

    async def get_pipeline_for(
        self,
        db: AsyncSession,
        *,
        target_type: str,  # "notice" | "order_plan" | "pre_spec"
        target_id: str,
    ) -> PipelineTimelineResponse | None:
        """우리 DB의 한 항목(target)에 대해 link 행을 찾고, 가능하면 외부 API로 보강 후 4단계를 임베드.
        link가 DB에 없으면 외부 API 한 번 호출해 upsert 시도.
        """
        from app.projects.bid_monitor.core.g2b_client import G2BClient
        from app.projects.bid_monitor.core.scheduler import _upsert_pipeline_link
        from sqlalchemy import or_ as sql_or

        notice = order_plan = pre_spec = None
        bid_type = "services"
        # 1) 대상 행 조회
        if target_type == "notice":
            notice = (await db.execute(
                select(BidNoticeModel).where(BidNoticeModel.id == target_id)
            )).scalar_one_or_none()
            if not notice:
                return None
            bid_type = notice.bid_type
        elif target_type == "order_plan":
            order_plan = (await db.execute(
                select(BidOrderPlanModel).where(BidOrderPlanModel.id == target_id)
            )).scalar_one_or_none()
            if not order_plan:
                return None
            bid_type = order_plan.bid_type
        elif target_type == "pre_spec":
            pre_spec = (await db.execute(
                select(BidPreSpecModel).where(BidPreSpecModel.id == target_id)
            )).scalar_one_or_none()
            if not pre_spec:
                return None
            bid_type = pre_spec.bid_type
        else:
            return None

        # 2) 기존 link 검색
        ors = []
        if notice:
            ors.append(BidPipelineLinkModel.notice_id == notice.id)
            if notice.bid_ntce_no:
                ors.append(BidPipelineLinkModel.bid_ntce_no == notice.bid_ntce_no)
        if order_plan:
            ors.append(BidPipelineLinkModel.order_plan_id == order_plan.id)
            if order_plan.order_plan_unty_no:
                ors.append(BidPipelineLinkModel.order_plan_unty_no == order_plan.order_plan_unty_no)
        if pre_spec:
            ors.append(BidPipelineLinkModel.pre_spec_id == pre_spec.id)
            if pre_spec.bf_spec_rgst_no:
                ors.append(BidPipelineLinkModel.bf_spec_rgst_no == pre_spec.bf_spec_rgst_no)

        link_row: BidPipelineLinkModel | None = None
        if ors:
            link_row = (await db.execute(
                select(BidPipelineLinkModel).where(sql_or(*ors))
            )).scalar_one_or_none()

        # 3) link 없으면 외부 API 호출
        if not link_row:
            g = G2BClient()
            kwargs = {}
            if notice:
                kwargs["bid_ntce_no"] = notice.bid_ntce_no
                kwargs["bid_ntce_ord"] = notice.bid_ntce_ord
            elif order_plan:
                kwargs["order_plan_no"] = order_plan.order_plan_unty_no
            elif pre_spec:
                kwargs["bf_spec_rgst_no"] = pre_spec.bf_spec_rgst_no
            link = await g.fetch_pipeline(bid_type=bid_type, **kwargs)
            if link:
                await _upsert_pipeline_link(
                    db, bid_type=bid_type, link=link,
                    notice_id=notice.id if notice else None,
                    order_plan_id=order_plan.id if order_plan else None,
                    pre_spec_id=pre_spec.id if pre_spec else None,
                )
                await db.commit()
                # 새로 만든 row 다시 로드
                link_row = (await db.execute(
                    select(BidPipelineLinkModel).where(sql_or(*ors)) if ors else select(BidPipelineLinkModel).limit(0)
                )).scalar_one_or_none()

        if not link_row:
            # 외부 매칭도 없음 — 빈 link 반환
            return None

        # 4) 4단계 임베드 (각 식별자로 우리 DB 행 조회)
        emb_notice = None
        emb_op = None
        emb_ps = None
        if link_row.notice_id:
            n = (await db.execute(select(BidNoticeModel).where(BidNoticeModel.id == link_row.notice_id))).scalar_one_or_none()
            if n: emb_notice = self._notice(n)
        elif link_row.bid_ntce_no:
            n = (await db.execute(select(BidNoticeModel).where(BidNoticeModel.bid_ntce_no == link_row.bid_ntce_no))).scalar_one_or_none()
            if n: emb_notice = self._notice(n)
        if link_row.order_plan_id:
            o = (await db.execute(select(BidOrderPlanModel).where(BidOrderPlanModel.id == link_row.order_plan_id))).scalar_one_or_none()
            if o: emb_op = self._order_plan(o)
        elif link_row.order_plan_unty_no:
            o = (await db.execute(select(BidOrderPlanModel).where(BidOrderPlanModel.order_plan_unty_no == link_row.order_plan_unty_no))).scalar_one_or_none()
            if o: emb_op = self._order_plan(o)
        if link_row.pre_spec_id:
            p = (await db.execute(select(BidPreSpecModel).where(BidPreSpecModel.id == link_row.pre_spec_id))).scalar_one_or_none()
            if p: emb_ps = self._pre_spec(p)
        elif link_row.bf_spec_rgst_no:
            p = (await db.execute(select(BidPreSpecModel).where(BidPreSpecModel.bf_spec_rgst_no == link_row.bf_spec_rgst_no))).scalar_one_or_none()
            if p: emb_ps = self._pre_spec(p)

        return PipelineTimelineResponse(
            link=PipelineLinkResponse(
                id=link_row.id,
                bid_type=link_row.bid_type,
                prcrmnt_req_no=link_row.prcrmnt_req_no,
                order_plan_unty_no=link_row.order_plan_unty_no,
                bf_spec_rgst_no=link_row.bf_spec_rgst_no,
                bid_ntce_no=link_row.bid_ntce_no,
                bid_ntce_ord=link_row.bid_ntce_ord,
                cntrct_no=link_row.cntrct_no,
                notice_id=link_row.notice_id,
                order_plan_id=link_row.order_plan_id,
                pre_spec_id=link_row.pre_spec_id,
                last_synced_at=link_row.last_synced_at,
                created_at=link_row.created_at,
            ),
            order_plan=emb_op,
            pre_spec=emb_ps,
            notice=emb_notice,
        )
