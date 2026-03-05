"""SQLAlchemy models for Government News Crawler project."""

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models.base import BaseEntity


class GovKeywordModel(BaseEntity):
    __tablename__ = "gov_keywords"

    query: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    synonyms: Mapped[dict | None] = mapped_column(JSON, default=[])
    target_entities: Mapped[dict | None] = mapped_column(JSON, default=[])
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class GovSourceModel(BaseEntity):
    __tablename__ = "gov_sources"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    config: Mapped[dict | None] = mapped_column(JSON, default={})
    credibility_score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class GovArticleModel(BaseEntity):
    __tablename__ = "gov_articles"

    url: Mapped[str] = mapped_column(Text, nullable=False)
    url_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    author: Mapped[str | None] = mapped_column(String(200))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    institution_name: Mapped[str | None] = mapped_column(String(200))
    leader_name: Mapped[str | None] = mapped_column(String(200))
    metadata_json: Mapped[dict | None] = mapped_column(JSON, default={})
    source_id: Mapped[str | None] = mapped_column(
        ForeignKey("gov_sources.id", ondelete="SET NULL")
    )


class GovScoreModel(BaseEntity):
    __tablename__ = "gov_scores"
    __table_args__ = (UniqueConstraint("article_id", "keyword_id", name="uq_score_article_keyword"),)

    rule_keyword_score: Mapped[float] = mapped_column(Float, nullable=False)
    rule_position_score: Mapped[float] = mapped_column(Float, nullable=False)
    rule_source_score: Mapped[float] = mapped_column(Float, nullable=False)
    rule_recency_score: Mapped[float] = mapped_column(Float, nullable=False)
    rule_total_score: Mapped[float] = mapped_column(Float, nullable=False)
    ai_relevance_score: Mapped[float | None] = mapped_column(Float)
    ai_quality_score: Mapped[float | None] = mapped_column(Float)
    ai_reasoning: Mapped[str | None] = mapped_column(Text)
    final_score: Mapped[float] = mapped_column(Float, nullable=False)
    article_id: Mapped[str] = mapped_column(
        ForeignKey("gov_articles.id", ondelete="CASCADE"), nullable=False
    )
    keyword_id: Mapped[str | None] = mapped_column(
        ForeignKey("gov_keywords.id", ondelete="SET NULL")
    )


class GovCrawlRunModel(BaseEntity):
    __tablename__ = "gov_crawl_runs"

    status: Mapped[str] = mapped_column(String(20), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False)
    statistics: Mapped[dict | None] = mapped_column(JSON, default={})
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    keyword_id: Mapped[str | None] = mapped_column(
        ForeignKey("gov_keywords.id", ondelete="SET NULL")
    )
