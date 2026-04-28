"""Pydantic schemas for Bid Monitor project."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Filter Conditions (키워드별 필터 조건)
# ---------------------------------------------------------------------------

class CategoryFilter(BaseModel):
    pubPrcrmntLrgClsfcNm: list[str] = []   # 대분류
    pubPrcrmntClsfcNm: list[str] = []      # 분류명
    pubPrcrmntMidClsfcNm: list[str] = []   # 중분류
    dtilPrdctClsfcNoNm: list[str] = []     # 세부품목분류
    sucsfbidMthdNm: list[str] = []         # 낙찰방법
    bidMethdNm: list[str] = []             # 입찰방법
    cnstrtsiteRgnNm: list[str] = []        # 지역
    rgstTyNm: list[str] = []              # 등록유형


class PriceRange(BaseModel):
    min: float | None = None
    max: float | None = None


class ScoringWeights(BaseModel):
    """시그널별 가중치. 값을 수정해 개인화 가능."""
    title_keyword: float = 25
    title_alias: float = 20
    keyword_combo_bonus: float = 25
    category_exact: float = 10
    category_mid: float = 5
    category_large: float = 3
    institution: float = 10
    flag: float = 10
    price_in_range: float = 5
    price_out_range: float = -5


class ScoringThresholds(BaseModel):
    """등급 임계값 (0-100 스케일)."""
    high: float = 80
    medium: float = 50
    low: float = 25


class FilterConditions(BaseModel):
    title_keywords: list[str] = []
    title_exclude: list[str] = []
    search_aliases: list[str] = []
    keyword_combinations: list[list[str]] = []  # AND 조건: 모두 포함 시 보너스
    institutions: list[str] = []
    categories: CategoryFilter = CategoryFilter()
    flags: dict[str, str] = {}
    price_range: PriceRange | None = None
    match_mode: Literal["any", "all"] = "any"
    scoring_weights: ScoringWeights = ScoringWeights()
    scoring_thresholds: ScoringThresholds = ScoringThresholds()


class ScoringConfigUpdate(BaseModel):
    """전역 스코어링 설정 업데이트."""
    filter_conditions: FilterConditions


class ScoringConfigResponse(BaseModel):
    """전역 스코어링 설정 응답."""
    filter_conditions: FilterConditions


class SimilarPastNotice(BaseModel):
    """과거 유사 공고 항목 (동일 수요기관 + 제목 키워드 겹침)."""
    id: str
    bid_ntce_no: str
    bid_ntce_ord: str
    bid_ntce_nm: str
    ntce_instt_nm: str | None = None
    dminstt_nm: str | None = None
    bid_ntce_dt: datetime | None = None
    bid_clse_dt: datetime | None = None
    presmpt_prce: float | None = None
    bid_ntce_url: str | None = None
    bid_ntce_dtl_url: str | None = None
    matched_keywords: list[str] = []


# ---------------------------------------------------------------------------
# Keywords
# ---------------------------------------------------------------------------

class KeywordCreate(BaseModel):
    keyword: str
    bid_types: list[str] = ["goods", "services", "construction"]
    is_active: bool = True
    filter_conditions: FilterConditions | None = None


class KeywordUpdate(BaseModel):
    keyword: str | None = None
    bid_types: list[str] | None = None
    is_active: bool | None = None
    filter_conditions: FilterConditions | None = None


class KeywordResponse(BaseModel):
    id: str
    keyword: str
    bid_types: list[str]
    is_active: bool
    filter_conditions: dict | None = None
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
    source_keyword: str | None = None
    match_reasons: list[str] | None = None
    # Scoring
    best_score: float | None = None
    best_grade: str | None = None
    created_at: datetime


class NoticeDetailResponse(NoticeResponse):
    metadata_json: dict = {}
    updated_at: datetime


# ---------------------------------------------------------------------------
# Order Plans (발주계획)
# ---------------------------------------------------------------------------

class OrderPlanResponse(BaseModel):
    id: str
    order_plan_unty_no: str
    bid_type: str
    prdct_clsfc_no_nm: str | None = None
    asign_bdgt_amt: float | None = None
    ordr_plan_dt: datetime | None = None
    ordr_yymm: str | None = None
    ordr_instt_cd: str | None = None
    ordr_instt_nm: str | None = None
    source_keyword: str | None = None
    match_reasons: list[str] | None = None
    best_score: float | None = None
    best_grade: str | None = None
    created_at: datetime


class OrderPlanDetailResponse(OrderPlanResponse):
    metadata_json: dict = {}
    updated_at: datetime


# ---------------------------------------------------------------------------
# Pre-Specs (사전규격공개)
# ---------------------------------------------------------------------------

class PreSpecResponse(BaseModel):
    id: str
    bf_spec_rgst_no: str
    bid_type: str
    prdct_clsfc_no_nm: str | None = None
    asign_bdgt_amt: float | None = None
    rcept_bgn_dt: datetime | None = None
    rcept_clse_dt: datetime | None = None
    rgst_dt: datetime | None = None
    ntce_instt_cd: str | None = None
    ntce_instt_nm: str | None = None
    dminstt_cd: str | None = None
    dminstt_nm: str | None = None
    source_keyword: str | None = None
    match_reasons: list[str] | None = None
    best_score: float | None = None
    best_grade: str | None = None
    created_at: datetime


class PreSpecDetailResponse(PreSpecResponse):
    metadata_json: dict = {}
    updated_at: datetime


# ---------------------------------------------------------------------------
# Pipeline Links (4단계 통합 타임라인)
# ---------------------------------------------------------------------------

class PipelineLinkResponse(BaseModel):
    id: str
    bid_type: str | None = None
    prcrmnt_req_no: str | None = None
    order_plan_unty_no: str | None = None
    bf_spec_rgst_no: str | None = None
    bid_ntce_no: str | None = None
    bid_ntce_ord: str | None = None
    cntrct_no: str | None = None
    notice_id: str | None = None
    order_plan_id: str | None = None
    pre_spec_id: str | None = None
    last_synced_at: datetime | None = None
    created_at: datetime


class PipelineTimelineResponse(BaseModel):
    """한 사업의 4단계 타임라인 — 각 단계별 우리 DB 행이 있으면 임베드."""
    link: PipelineLinkResponse
    order_plan: OrderPlanResponse | None = None
    pre_spec: PreSpecResponse | None = None
    notice: "NoticeResponse | None" = None  # forward ref


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class AlertResponse(BaseModel):
    id: str
    keyword_id: str
    target_type: str = "notice"  # "notice" | "order_plan" | "pre_spec"
    notice_id: str | None = None
    order_plan_id: str | None = None
    pre_spec_id: str | None = None
    channel: str
    status: str
    error_message: str | None = None
    match_reasons: list[str] | None = None
    score: float | None = None
    grade: str | None = None
    signals: list[dict] | None = None
    created_at: datetime
    keyword_text: str | None = None
    target_title: str | None = None  # 통합 — 어느 단계든 사업명/공고명


# ---------------------------------------------------------------------------
# Check Runs
# ---------------------------------------------------------------------------

class CheckTriggerRequest(BaseModel):
    keyword_id: str | None = None


class BackfillRequest(BaseModel):
    hours: int = 24  # 소급 시간 (1 ~ 168 허용)


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
    notify_grade_threshold: str | None = None  # "high" | "medium" | "low"


class ConfigResponse(BaseModel):
    discord_webhook_url: str | None = None
    check_interval_minutes: int = 30
    notify_grade_threshold: str = "medium"
    data_go_kr_api_key_set: bool = False


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class BidMonitorStats(BaseModel):
    total_keywords: int
    active_keywords: int
    total_notices: int
    total_alerts: int
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    # 신규: 발주계획·사전규격 카운트
    total_order_plans: int = 0
    total_pre_specs: int = 0
    high_count_order_plans: int = 0
    medium_count_order_plans: int = 0
    low_count_order_plans: int = 0
    high_count_pre_specs: int = 0
    medium_count_pre_specs: int = 0
    low_count_pre_specs: int = 0
    recent_runs: list[CheckRunResponse] = []
    scheduler_running: bool = False


# Resolve forward refs (PipelineTimelineResponse references NoticeResponse defined earlier)
PipelineTimelineResponse.model_rebuild()
