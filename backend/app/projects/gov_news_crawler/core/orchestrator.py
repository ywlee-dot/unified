"""Crawl orchestrator — fetches, deduplicates, scores, and persists articles."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .dedup import generate_url_hash, are_titles_similar
from .entity_matcher import extract_entity_names
from .html_scraper import HTMLScraper
from .rss_fetcher import RSSFetcher
from .scoring import calculate_rule_based_score, combine_scores

logger = logging.getLogger(__name__)


class CrawlerOrchestrator:
    """Coordinates fetching, dedup, scoring, and persistence of crawled articles."""

    async def run(
        self,
        db: AsyncSession,
        keyword_model: Any,
        sources: list[dict],
        options: dict | None = None,
    ) -> dict:
        """Execute a full crawl run.

        Args:
            db: Async SQLAlchemy session.
            keyword_model: ORM instance for the keyword being crawled.
            sources: List of source dicts (url, name, source_type, config, ...).
            options: Optional overrides (e.g. title_similarity_threshold).

        Returns:
            Stats dict with keys: total_fetched, total_saved, total_duplicate,
            total_error, run_id.
        """
        options = options or {}

        # Import models lazily to avoid circular imports at module load time
        from app.projects.gov_news_crawler.models import (
            GovCrawlRunModel,
            GovArticleModel,
            GovScoreModel,
        )

        keyword_id = getattr(keyword_model, "id", None)
        # Model field is .query, not .keyword
        keyword_text = getattr(keyword_model, "query", "") or ""
        synonyms: list[str] = getattr(keyword_model, "synonyms", None) or []
        raw_entities = getattr(keyword_model, "target_entities", None) or []
        # target_entities stored as list of strings; convert to dict form for matchers
        if isinstance(raw_entities, list):
            target_entities: dict = {"institutions": raw_entities}
        else:
            target_entities = raw_entities

        # 1. Create crawl run record (trigger_type is required)
        crawl_run = GovCrawlRunModel(
            keyword_id=keyword_id,
            status="running",
            trigger_type="manual",
            started_at=datetime.now(timezone.utc),
            statistics={},
        )
        db.add(crawl_run)
        await db.flush()  # get PK without committing

        stats = {
            "total_fetched": 0,
            "total_saved": 0,
            "total_duplicate": 0,
            "total_error": 0,
            "run_id": crawl_run.id,
        }

        rss_fetcher = RSSFetcher()
        html_scraper = HTMLScraper()

        # Keep a small in-memory cache of titles seen this run for similarity checks
        seen_titles: list[str] = []

        for source in sources:
            source_url: str = source.get("url", "")
            source_name: str = source.get("name", "")
            source_type: str = source.get("source_type", "")
            scraper_config: dict = source.get("config", {})

            try:
                # 2. Fetch articles
                if source_type == "rss" or scraper_config.get("type") == "rss":
                    raw_articles = await rss_fetcher.fetch(source_url, source_name)
                else:
                    raw_articles = await html_scraper.fetch(
                        source_url, scraper_config, source_name
                    )
            except Exception as exc:
                logger.warning("Failed to fetch source %s: %s", source_url, exc)
                stats["total_error"] += 1
                continue

            stats["total_fetched"] += len(raw_articles)

            for raw in raw_articles:
                try:
                    url: str = raw.get("url", "")
                    title: str = raw.get("title", "")

                    if not url:
                        stats["total_error"] += 1
                        continue

                    # 3a. URL-hash dedup — check DB
                    url_hash = generate_url_hash(url)
                    existing = await db.execute(
                        select(GovArticleModel).where(
                            GovArticleModel.url_hash == url_hash
                        )
                    )
                    if existing.scalar_one_or_none() is not None:
                        stats["total_duplicate"] += 1
                        continue

                    # 3b. Title similarity check against this run's seen titles
                    threshold = options.get("title_similarity_threshold", 0.85)
                    is_dup = any(
                        are_titles_similar(title, seen, threshold)
                        for seen in seen_titles
                    )
                    if is_dup:
                        stats["total_duplicate"] += 1
                        continue

                    seen_titles.append(title)

                    # 3c. Extract matched entity names
                    full_text = f"{title} {raw.get('content', '')}"
                    institution_name, leader_name = extract_entity_names(
                        full_text, target_entities
                    )

                    # 3d. Persist article (no keyword_id/crawl_run_id on model)
                    article = GovArticleModel(
                        title=title,
                        url=url,
                        url_hash=url_hash,
                        content=raw.get("content", "") or "",
                        author=raw.get("author", ""),
                        published_at=raw.get("published_at"),
                        source_type=raw.get("source_type", source_type) or "news",
                        institution_name=institution_name,
                        leader_name=leader_name,
                    )
                    db.add(article)
                    await db.flush()  # get article PK

                    # 3e. Calculate rule-based score
                    score_breakdown = calculate_rule_based_score(
                        article={
                            "title": title,
                            "content": raw.get("content", ""),
                            "published_at": raw.get("published_at"),
                        },
                        keyword=keyword_text,
                        source=source,
                        synonyms=synonyms,
                        target_entities=target_entities,
                    )

                    # 4. AI scoring placeholder
                    logger.info(
                        "AI scoring not configured — using rule-based score only "
                        "(article_id=%s)", article.id
                    )
                    final_score = combine_scores(score_breakdown["total"])

                    score_record = GovScoreModel(
                        article_id=article.id,
                        keyword_id=keyword_id,
                        rule_keyword_score=score_breakdown["keyword_score"],
                        rule_position_score=score_breakdown["position_score"],
                        rule_source_score=score_breakdown["source_score"],
                        rule_recency_score=score_breakdown["recency_score"],
                        rule_total_score=score_breakdown["total"],
                        final_score=final_score,
                    )
                    db.add(score_record)

                    stats["total_saved"] += 1

                except Exception as exc:
                    logger.warning(
                        "Error processing article '%s': %s", raw.get("url", ""), exc
                    )
                    stats["total_error"] += 1

        # 5. Update crawl run record with final stats (stored in statistics JSONB)
        crawl_run.status = "completed"
        crawl_run.completed_at = datetime.now(timezone.utc)
        crawl_run.statistics = {
            "total_fetched": stats["total_fetched"],
            "total_saved": stats["total_saved"],
            "total_duplicate": stats["total_duplicate"],
            "total_error": stats["total_error"],
        }

        await db.commit()

        logger.info(
            "Crawl run %s completed: fetched=%d saved=%d duplicate=%d error=%d",
            crawl_run.id,
            stats["total_fetched"],
            stats["total_saved"],
            stats["total_duplicate"],
            stats["total_error"],
        )

        return stats
