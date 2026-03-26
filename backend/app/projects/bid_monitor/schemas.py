"""Pydantic schemas for Bid Monitor project."""

from datetime import datetime

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Keywords
# ---------------------------------------------------------------------------

class KeywordCreate(BaseModel):
    keyword: str
    bid_types: list[str] = ["goods", "services", "construction"]
    is_active: bool = True


class KeywordUpdate(BaseModel):
    keyword: str | None = None
    bid_types: list[str] | None = None
    is_active: bool | None = None


class KeywordResponse(BaseModel):
    id: str
    keyword: str
    bid_types: list[str]
    is_active: bool
    last_checked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Notices
# ---------------------------------------------------------------------------

class NoticeResponse(BaseModel):
    id: str
    bid_ntce_no: str
    bid_ntce_ord: str
    bid_ntce_nm: str
    ntce_instt_nm: str | None = None
    dminstt_nm: str | None = None
    bid_ntce_dt: datetime | None = None
    bid_clse_dt: datetime | None = None
    openg_dt: datetime | None = None
    presmpt_prce: float | None = None
    asign_bdgt_amt: float | None = None
    cntrct_cncls_mthd_nm: str | None = None
    bid_type: str
    ntce_kind_nm: str | None = None
    bid_ntce_url: str | None = None
    bid_ntce_dtl_url: str | None = None
    created_at: datetime


class NoticeDetailResponse(NoticeResponse):
    metadata_json: dict = {}
    updated_at: datetime


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class AlertResponse(BaseModel):
    id: str
    keyword_id: str
    notice_id: str
    channel: str
    status: str
    error_message: str | None = None
    created_at: datetime
    # joined fields
    keyword_text: str | None = None
    notice_title: str | None = None


# ---------------------------------------------------------------------------
# Check Runs
# ---------------------------------------------------------------------------

class CheckTriggerRequest(BaseModel):
    keyword_id: str | None = None


class CheckRunResponse(BaseModel):
    id: str
    status: str
    trigger_type: str
    statistics: dict = {}
    error_message: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

class ConfigUpdate(BaseModel):
    discord_webhook_url: str | None = None
    check_interval_minutes: int | None = None


class ConfigResponse(BaseModel):
    discord_webhook_url: str | None = None
    check_interval_minutes: int = 30
    data_go_kr_api_key_set: bool = False


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class BidMonitorStats(BaseModel):
    total_keywords: int
    active_keywords: int
    total_notices: int
    total_alerts: int
    recent_runs: list[CheckRunResponse] = []
    scheduler_running: bool = False
