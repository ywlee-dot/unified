"""SQLAlchemy models for Bid Monitor project."""

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class BidKeywordModel(BaseEntity):
    __tablename__ = "bid_keywords"

    keyword: Mapped[str] = mapped_column(String(200), nullable=False)
    bid_types: Mapped[dict | None] = mapped_column(
        JSON, default=["goods", "services", "construction"]
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    filter_conditions: Mapped[dict | None] = mapped_column(JSON, default=None)


class BidNoticeModel(BaseEntity):
    __tablename__ = "bid_notices"

    bid_ntce_no: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    bid_ntce_ord: Mapped[str] = mapped_column(String(10), nullable=False, default="00")
    bid_ntce_nm: Mapped[str] = mapped_column(String(1000), nullable=False)
    ntce_instt_nm: Mapped[str | None] = mapped_column(String(200))
    dminstt_nm: Mapped[str | None] = mapped_column(String(200))
    bid_ntce_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    bid_clse_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    openg_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    presmpt_prce: Mapped[float | None] = mapped_column(Float)
    asign_bdgt_amt: Mapped[float | None] = mapped_column(Float)
    cntrct_cncls_mthd_nm: Mapped[str | None] = mapped_column(String(100))
    bid_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ntce_kind_nm: Mapped[str | None] = mapped_column(String(50))
    bid_ntce_url: Mapped[str | None] = mapped_column(Text)
    bid_ntce_dtl_url: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, default={})
    source_keyword: Mapped[str | None] = mapped_column(String(200))
    similar_past_json: Mapped[list | None] = mapped_column(JSON, default=None)


class BidAlertModel(BaseEntity):
    __tablename__ = "bid_alerts"

    keyword_id: Mapped[str] = mapped_column(
        ForeignKey("bid_keywords.id", ondelete="CASCADE"), nullable=False
    )
    # 단계별 대상 (택1) — target_type으로 어느 단계인지 식별
    target_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="notice", index=True
    )  # "notice" | "order_plan" | "pre_spec"
    notice_id: Mapped[str | None] = mapped_column(
        ForeignKey("bid_notices.id", ondelete="CASCADE"), index=True
    )
    order_plan_id: Mapped[str | None] = mapped_column(
        ForeignKey("bid_order_plans.id", ondelete="CASCADE"), index=True
    )
    pre_spec_id: Mapped[str | None] = mapped_column(
        ForeignKey("bid_pre_specs.id", ondelete="CASCADE"), index=True
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="discord")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sent")
    error_message: Mapped[str | None] = mapped_column(Text)
    match_reasons: Mapped[list | None] = mapped_column(JSON, default=None)
    # Scoring
    score: Mapped[float | None] = mapped_column(Float, index=True)
    grade: Mapped[str | None] = mapped_column(String(10), index=True)  # high|medium|low
    signals: Mapped[list | None] = mapped_column(JSON, default=None)


class BidOrderPlanModel(BaseEntity):
    """발주계획 (OrderPlanSttusService)."""
    __tablename__ = "bid_order_plans"

    order_plan_unty_no: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    bid_type: Mapped[str] = mapped_column(String(20), nullable=False)
    prdct_clsfc_no_nm: Mapped[str | None] = mapped_column(String(1000))  # 사업명/품명
    asign_bdgt_amt: Mapped[float | None] = mapped_column(Float)
    ordr_plan_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 공고예정일
    ordr_yymm: Mapped[str | None] = mapped_column(String(8))  # 발주월 YYYYMM
    ordr_instt_cd: Mapped[str | None] = mapped_column(String(20))
    ordr_instt_nm: Mapped[str | None] = mapped_column(String(200))
    metadata_json: Mapped[dict | None] = mapped_column(JSON, default={})
    source_keyword: Mapped[str | None] = mapped_column(String(200))


class BidPreSpecModel(BaseEntity):
    """사전규격공개 (HrcspSsstndrdInfoService)."""
    __tablename__ = "bid_pre_specs"

    bf_spec_rgst_no: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    bid_type: Mapped[str] = mapped_column(String(20), nullable=False)
    prdct_clsfc_no_nm: Mapped[str | None] = mapped_column(String(1000))  # 사업명
    asign_bdgt_amt: Mapped[float | None] = mapped_column(Float)
    rcept_bgn_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 의견접수 시작
    rcept_clse_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 의견접수 마감
    rgst_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 등록일
    ntce_instt_cd: Mapped[str | None] = mapped_column(String(20))
    ntce_instt_nm: Mapped[str | None] = mapped_column(String(200))
    dminstt_cd: Mapped[str | None] = mapped_column(String(20))
    dminstt_nm: Mapped[str | None] = mapped_column(String(200))
    metadata_json: Mapped[dict | None] = mapped_column(JSON, default={})
    source_keyword: Mapped[str | None] = mapped_column(String(200))


class BidPipelineLinkModel(BaseEntity):
    """발주계획 → 사전규격 → 입찰공고 → 낙찰/계약 단계 식별자 묶음.
    계약과정통합공개서비스(CntrctProcssIntgOpenService) 결과를 기반으로 채워진다.
    """
    __tablename__ = "bid_pipeline_links"

    bid_type: Mapped[str | None] = mapped_column(String(20), index=True)
    prcrmnt_req_no: Mapped[str | None] = mapped_column(String(80), index=True)
    order_plan_unty_no: Mapped[str | None] = mapped_column(String(80), index=True)
    bf_spec_rgst_no: Mapped[str | None] = mapped_column(String(80), index=True)
    bid_ntce_no: Mapped[str | None] = mapped_column(String(40), index=True)
    bid_ntce_ord: Mapped[str | None] = mapped_column(String(10))
    cntrct_no: Mapped[str | None] = mapped_column(String(80))
    # 내부 row 참조 (해당 행이 우리 DB에 있을 때만 채워짐)
    notice_id: Mapped[str | None] = mapped_column(
        ForeignKey("bid_notices.id", ondelete="SET NULL")
    )
    order_plan_id: Mapped[str | None] = mapped_column(
        ForeignKey("bid_order_plans.id", ondelete="SET NULL")
    )
    pre_spec_id: Mapped[str | None] = mapped_column(
        ForeignKey("bid_pre_specs.id", ondelete="SET NULL")
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw_response: Mapped[dict | None] = mapped_column(JSON, default={})


class BidCheckRunModel(BaseEntity):
    __tablename__ = "bid_check_runs"

    status: Mapped[str] = mapped_column(String(20), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False)
    statistics: Mapped[dict | None] = mapped_column(JSON, default={})
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BidMonitorConfigModel(BaseEntity):
    __tablename__ = "bid_monitor_config"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
