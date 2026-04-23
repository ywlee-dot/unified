"""가중치 기반 스코어링 엔진 — 공고와 키워드 필터 조건의 관련도를 0-100 점으로 산출."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# 기본 가중치
DEFAULT_WEIGHTS: dict[str, float] = {
    "title_keyword": 30,      # 공고명 키워드 매칭 (1건당)
    "title_alias": 15,        # 공고명 유의어 매칭 (1건당)
    "category_exact": 25,     # pubPrcrmntClsfcNm 정확 매칭
    "category_mid": 15,       # pubPrcrmntMidClsfcNm 매칭
    "category_large": 10,     # pubPrcrmntLrgClsfcNm 매칭
    "institution": 10,        # 기관 매칭 (첫 매칭만 카운트)
    "flag": 10,               # 플래그 매칭 (1건당)
    "price_in_range": 5,      # 가격이 선호 범위 내
    "price_out_range": -10,   # 가격이 선호 범위 밖
}

DEFAULT_THRESHOLDS: dict[str, float] = {
    "high": 80,
    "medium": 50,
    "low": 25,
}


@dataclass
class ScoringResult:
    """스코어링 결과."""
    score: float
    grade: str  # "high" | "medium" | "low" | "none" | "excluded"
    signals: list[dict[str, Any]] = field(default_factory=list)
    excluded: bool = False

    @property
    def passed(self) -> bool:
        """low 이상 등급이면 통과로 간주."""
        return self.grade in ("high", "medium", "low")

    @property
    def reason_labels(self) -> list[str]:
        """match_reasons 문자열 리스트 (UI 호환용)."""
        return [f"{s['type']}:{s['value']}" for s in self.signals]


def compute_score(
    item: dict,
    filter_conditions: dict | None,
) -> ScoringResult:
    """공고를 키워드 필터 조건에 대해 스코어링.

    Args:
        item: g2b_client._normalize_item()이 반환하는 dict.
        filter_conditions: BidKeywordModel.filter_conditions.
            None이면 기본 점수 50(medium)으로 통과.

    Returns:
        ScoringResult.
    """
    # 필터 조건 없음 — 기본 medium 등급으로 통과 (레거시 호환)
    if filter_conditions is None:
        return ScoringResult(score=50.0, grade="medium", signals=[])

    title = item.get("bid_ntce_nm", "") or ""
    metadata = item.get("metadata_json", {}) or {}

    weights = {**DEFAULT_WEIGHTS, **(filter_conditions.get("scoring_weights") or {})}
    thresholds = {**DEFAULT_THRESHOLDS, **(filter_conditions.get("scoring_thresholds") or {})}

    # ── 1. Hard exclude (title_exclude) → grade=low, score=5 ────
    title_lower = title.lower()
    for ex in filter_conditions.get("title_exclude", []) or []:
        if ex and ex.lower() in title_lower:
            return ScoringResult(
                score=5.0,
                grade="low",
                signals=[{"type": "excluded", "value": ex, "points": 0}],
                excluded=True,
            )

    score = 0.0
    signals: list[dict] = []

    # ── 2. title_keywords (primary signal) ──────────────────────
    title_keywords = filter_conditions.get("title_keywords", []) or []
    matched_kw_count = 0
    for kw in title_keywords:
        if kw and kw.lower() in title_lower:
            matched_kw_count += 1
            pts = weights["title_keyword"]
            score += pts
            signals.append({"type": "title_keyword", "value": kw, "points": pts})
            if matched_kw_count >= 2:  # cap at 2 matches to avoid runaway
                break

    # ── 3. search_aliases (secondary signal) ────────────────────
    aliases = filter_conditions.get("search_aliases", []) or []
    matched_alias_count = 0
    for alias in aliases:
        if alias and alias.lower() in title_lower:
            matched_alias_count += 1
            pts = weights["title_alias"]
            score += pts
            signals.append({"type": "title_alias", "value": alias, "points": pts})
            if matched_alias_count >= 2:
                break

    # ── 3.5 keyword_combinations (AND 보너스) ───────────────────
    for combo in filter_conditions.get("keyword_combinations", []) or []:
        if combo and all(kw.lower() in title_lower for kw in combo):
            pts = weights.get("keyword_combo_bonus", 25)
            score += pts
            signals.append({"type": "keyword_combo", "value": "+".join(combo), "points": pts})
            break  # 첫 번째 매칭 combo만 적용

    # ── 4. categories ───────────────────────────────────────────
    cat = filter_conditions.get("categories", {}) or {}

    # pubPrcrmntClsfcNm (정확)
    allowed = cat.get("pubPrcrmntClsfcNm") or []
    actual = metadata.get("pubPrcrmntClsfcNm", "")
    if actual and actual in allowed:
        pts = weights["category_exact"]
        score += pts
        signals.append({"type": "category_exact", "value": actual, "points": pts})

    # pubPrcrmntMidClsfcNm (중분류)
    allowed_mid = cat.get("pubPrcrmntMidClsfcNm") or []
    actual_mid = metadata.get("pubPrcrmntMidClsfcNm", "")
    if actual_mid and actual_mid in allowed_mid:
        pts = weights["category_mid"]
        score += pts
        signals.append({"type": "category_mid", "value": actual_mid, "points": pts})

    # pubPrcrmntLrgClsfcNm (대분류)
    allowed_lrg = cat.get("pubPrcrmntLrgClsfcNm") or []
    actual_lrg = metadata.get("pubPrcrmntLrgClsfcNm", "")
    if actual_lrg and actual_lrg in allowed_lrg:
        pts = weights["category_large"]
        score += pts
        signals.append({"type": "category_large", "value": actual_lrg, "points": pts})

    # ── 5. institutions ─────────────────────────────────────────
    institutions = filter_conditions.get("institutions", []) or []
    ntce_instt = (item.get("ntce_instt_nm") or "").lower()
    dminstt = (item.get("dminstt_nm") or "").lower()
    for inst in institutions:
        if not inst:
            continue
        inst_lower = inst.lower()
        if inst_lower in ntce_instt or inst_lower in dminstt:
            pts = weights["institution"]
            score += pts
            signals.append({"type": "institution", "value": inst, "points": pts})
            break  # 첫 매칭만 카운트

    # ── 6. flags ────────────────────────────────────────────────
    flags = filter_conditions.get("flags", {}) or {}
    for flag_key, expected_value in flags.items():
        actual_flag = metadata.get(flag_key, "")
        if actual_flag == expected_value:
            pts = weights["flag"]
            score += pts
            signals.append({
                "type": "flag",
                "value": f"{flag_key}={expected_value}",
                "points": pts,
            })

    # ── 7. price_range ──────────────────────────────────────────
    price_range = filter_conditions.get("price_range")
    if price_range:
        pmin = price_range.get("min")
        pmax = price_range.get("max")
        if pmin is not None or pmax is not None:
            price = item.get("presmpt_prce") or item.get("asign_bdgt_amt")
            if price is not None:
                in_range = (pmin is None or price >= pmin) and (pmax is None or price <= pmax)
                if in_range:
                    pts = weights["price_in_range"]
                    score += pts
                    signals.append({"type": "price_in_range", "value": f"{price:.0f}", "points": pts})
                else:
                    pts = weights["price_out_range"]
                    score += pts
                    signals.append({"type": "price_out_range", "value": f"{price:.0f}", "points": pts})

    # ── 8. 점수 클램핑 & 등급 산출 ──────────────────────────────
    score = max(0.0, min(100.0, score))

    if score >= thresholds["high"]:
        grade = "high"
    elif score >= thresholds["medium"]:
        grade = "medium"
    else:
        grade = "low"  # 점수 미달도 low로 저장 (검색 가능하도록)

    logger.debug(
        "스코어링: title=%s, score=%.1f, grade=%s, signals=%d",
        title[:50], score, grade, len(signals),
    )

    return ScoringResult(score=score, grade=grade, signals=signals)
