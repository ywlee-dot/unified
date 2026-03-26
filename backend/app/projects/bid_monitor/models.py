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


class BidAlertModel(BaseEntity):
    __tablename__ = "bid_alerts"

    keyword_id: Mapped[str] = mapped_column(
        ForeignKey("bid_keywords.id", ondelete="CASCADE"), nullable=False
    )
    notice_id: Mapped[str] = mapped_column(
        ForeignKey("bid_notices.id", ondelete="CASCADE"), nullable=False
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="discord")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sent")
    error_message: Mapped[str | None] = mapped_column(Text)


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
