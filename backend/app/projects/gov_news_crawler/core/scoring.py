"""Hybrid rule-based + AI scoring for crawled articles."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .config import (
    DEFAULT_AI_TOP_N,
    ENTITY_POINTS,
    KEYWORD_POINTS,
    LEAD_LENGTH,
    POSITION_POINTS,
    RECENCY_SCORE_OLD,
    RECENCY_SCORE_UNKNOWN,
    RECENCY_THRESHOLDS,
    SCORE_COMBINE_WEIGHTS,
    SCORING_WEIGHTS,
    SYNONYM_POINTS,
)
from .entity_matcher import contains_entity, match_entities


def calculate_keyword_score(
    text: str,
    keyword: str,
    synonyms: list[str] | None = None,
    target_entities: dict | None = None,
) -> float:
    """Score 0-100 based on keyword/synonym/entity occurrences in text."""
    synonyms = synonyms or []
    target_entities = target_entities or {}

    score = 0.0

    # Main keyword occurrences
    if keyword:
        count = text.lower().count(keyword.lower())
        score += count * KEYWORD_POINTS

    # Synonym occurrences
    for syn in synonyms:
        count = text.lower().count(syn.lower())
        score += count * SYNONYM_POINTS

    # Entity occurrences
    matched = match_entities(text, target_entities)
    score += len(matched) * ENTITY_POINTS

    return min(score, 100.0)


def calculate_position_score(
    title: str,
    content: str,
    keyword: str,
    synonyms: list[str] | None = None,
    target_entities: dict | None = None,
) -> float:
    """Score 0-100 based on where keyword/entities appear in the article."""
    synonyms = synonyms or []
    target_entities = target_entities or {}

    score = 0.0
    lead = content[: LEAD_LENGTH] if content else ""

    kw_lower = keyword.lower() if keyword else ""
    title_lower = title.lower() if title else ""
    content_lower = content.lower() if content else ""
    lead_lower = lead.lower()

    # Keyword in title
    if kw_lower and kw_lower in title_lower:
        score += POSITION_POINTS["title"]
    # Keyword in lead
    elif kw_lower and kw_lower in lead_lower:
        score += POSITION_POINTS["lead"]
    # Keyword in content
    elif kw_lower and kw_lower in content_lower:
        score += POSITION_POINTS["content"]

    # Check synonyms similarly (add partial credit)
    for syn in synonyms:
        syn_lower = syn.lower()
        if syn_lower in title_lower:
            score += POSITION_POINTS["title"] * 0.5
        elif syn_lower in lead_lower:
            score += POSITION_POINTS["lead"] * 0.5

    # Entity in title
    if contains_entity(title, target_entities):
        score += POSITION_POINTS["entity_title"]
    # Entity in lead
    elif contains_entity(lead, target_entities):
        score += POSITION_POINTS["entity_lead"]

    return min(score, 100.0)


def calculate_source_score(credibility_score: float | None) -> float:
    """Score 0-100 derived from source credibility (0-1 float, or None=unknown)."""
    if credibility_score is None:
        return 50.0
    return min(credibility_score * 100.0, 100.0)


def calculate_recency_score(published_at: datetime | None) -> float:
    """Score 0-100 based on article age."""
    if published_at is None:
        return float(RECENCY_SCORE_UNKNOWN)

    now = datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)

    age_hours = (now - published_at).total_seconds() / 3600.0

    for threshold_hours, score in RECENCY_THRESHOLDS:
        if age_hours <= threshold_hours:
            return float(score)

    return float(RECENCY_SCORE_OLD)


def calculate_rule_based_score(
    article: dict,
    keyword: str,
    source: dict,
    synonyms: list[str] | None = None,
    target_entities: dict | None = None,
) -> dict:
    """Calculate all four scoring components and return a score breakdown dict.

    Args:
        article: Dict with keys: title, content, published_at (datetime|None).
        keyword: Primary search keyword.
        source: Dict with optional key: credibility_score.
        synonyms: Optional list of keyword synonyms.
        target_entities: Optional dict {"institutions": [...], "leaders": [...]}.

    Returns:
        Dict with keyword_score, position_score, source_score, recency_score, total.
    """
    synonyms = synonyms or []
    target_entities = target_entities or {}

    title = article.get("title") or ""
    content = article.get("content") or ""
    published_at = article.get("published_at")
    credibility_score = source.get("credibility_score")

    full_text = f"{title} {content}"

    kw_score = calculate_keyword_score(full_text, keyword, synonyms, target_entities)
    pos_score = calculate_position_score(title, content, keyword, synonyms, target_entities)
    src_score = calculate_source_score(credibility_score)
    rec_score = calculate_recency_score(published_at)

    total = (
        kw_score * SCORING_WEIGHTS["keyword"]
        + pos_score * SCORING_WEIGHTS["position"]
        + src_score * SCORING_WEIGHTS["source"]
        + rec_score * SCORING_WEIGHTS["recency"]
    )

    return {
        "keyword_score": round(kw_score, 2),
        "position_score": round(pos_score, 2),
        "source_score": round(src_score, 2),
        "recency_score": round(rec_score, 2),
        "total": round(total, 2),
    }


def combine_scores(
    rule_total: float,
    ai_relevance: float | None = None,
    ai_quality: float | None = None,
) -> float:
    """Combine rule-based total with optional AI scores."""
    if ai_relevance is not None and ai_quality is not None:
        ai_avg = (ai_relevance + ai_quality) / 2.0
        weights = SCORE_COMBINE_WEIGHTS["with_ai"]
        return round(rule_total * weights["rule"] + ai_avg * weights["ai"], 2)
    return round(rule_total, 2)


def get_score_category(score: float) -> str:
    """Return 'high', 'medium', or 'low' based on score thresholds."""
    if score >= 80:
        return "high"
    if score >= 60:
        return "medium"
    return "low"
