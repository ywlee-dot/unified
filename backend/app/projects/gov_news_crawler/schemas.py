"""Pydantic schemas for Government News Crawler project."""

from datetime import datetime

from pydantic import BaseModel


class KeywordCreate(BaseModel):
    query: str
    category: str = ""
    synonyms: list[str] = []
    target_entities: dict = {}
    is_active: bool = True


class KeywordUpdate(BaseModel):
    query: str | None = None
    category: str | None = None
    synonyms: list[str] | None = None
    target_entities: dict | None = None
    is_active: bool | None = None


class KeywordResponse(BaseModel):
    id: str
    query: str
    category: str
    synonyms: list[str] = []
    target_entities: dict = {}
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SourceCreate(BaseModel):
    name: str
    source_type: str  # "rss" | "web" | "api"
    url: str
    category: str
    config: dict = {}
    credibility_score: float = 0.5
    is_active: bool = True


class SourceResponse(BaseModel):
    id: str
    name: str
    source_type: str
    url: str
    category: str
    config: dict = {}
    credibility_score: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ArticleScoreSummary(BaseModel):
    rule_total_score: float
    ai_relevance_score: float | None = None
    final_score: float


class ArticleResponse(BaseModel):
    id: str
    url: str
    title: str
    summary: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    source_type: str
    institution_name: str | None = None
    leader_name: str | None = None
    created_at: datetime


class ArticleDetailResponse(BaseModel):
    id: str
    url: str
    title: str
    content: str
    summary: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    source_type: str
    institution_name: str | None = None
    leader_name: str | None = None
    metadata_json: dict = {}
    source_id: str | None = None
    scores: list[ArticleScoreSummary] = []
    created_at: datetime
    updated_at: datetime


class CrawlTriggerRequest(BaseModel):
    keyword_id: str | None = None
    enable_ai: bool = False
    ai_top_n: int = 10


class CrawlRunResponse(BaseModel):
    id: str
    status: str  # "running" | "completed" | "failed"
    trigger_type: str  # "manual" | "scheduled"
    statistics: dict = {}
    error_message: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    keyword_id: str | None = None
    created_at: datetime


class GovNewsStats(BaseModel):
    total_keywords: int
    active_keywords: int
    total_sources: int
    total_articles: int
    recent_crawl_runs: list[CrawlRunResponse] = []
