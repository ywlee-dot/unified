"""클라이언트 측 입찰공고 필터링 엔진."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class FilterResult:
    """필터링 결과."""

    passed: bool
    match_reasons: list[str] = field(default_factory=list)


def apply_filters(
    item: dict,
    keyword: str,
    filter_conditions: dict | None,
) -> FilterResult:
    """공고 아이템에 필터 조건을 적용한다.

    Args:
        item: g2b_client._normalize_item()이 반환하는 dict (metadata_json 포함).
        keyword: BidKeywordModel.keyword 값 (하위 호환용).
        filter_conditions: BidKeywordModel.filter_conditions 값.
            None이면 필터링 없이 모든 공고 통과 (현재 동작 유지).

    Returns:
        FilterResult(passed, match_reasons).
    """
    # filter_conditions가 None이면 필터링 없음 — 기존 동작 유지
    if filter_conditions is None:
        logger.debug("필터 조건 없음 (keyword=%s) — 전체 통과", keyword)
        return FilterResult(passed=True, match_reasons=[])

    title = item.get("bid_ntce_nm", "")
    metadata = item.get("metadata_json", {}) or {}

    # --- title_exclude는 항상 먼저 적용 (블랙리스트) ---
    title_exclude = filter_conditions.get("title_exclude", [])
    if title_exclude and _check_title_exclude(title, title_exclude):
        logger.debug("제외 키워드 매칭으로 탈락 (title=%s)", title[:60])
        return FilterResult(passed=False, match_reasons=[])

    # --- 긍정 조건 수집 ---
    match_mode = filter_conditions.get("match_mode", "any")
    positive_results: list[str] = []
    conditions_checked = 0

    # title_keywords
    title_keywords = filter_conditions.get("title_keywords", [])
    if title_keywords:
        conditions_checked += 1
        matched_kw = _check_title_keywords(title, title_keywords)
        if matched_kw:
            positive_results.append(f"title:{matched_kw}")

    # categories
    categories = filter_conditions.get("categories", {})
    if categories:
        cat_matches = _check_categories(metadata, categories)
        if cat_matches:
            conditions_checked += 1
            positive_results.extend(cat_matches)
        else:
            conditions_checked += 1

    # institutions (공고기관/수요기관 부분 매칭 — top-level item 필드)
    institutions = filter_conditions.get("institutions", [])
    if institutions:
        conditions_checked += 1
        inst_match = _check_institutions(item, institutions)
        if inst_match:
            positive_results.append(inst_match)

    # flags
    flags = filter_conditions.get("flags", {})
    if flags:
        flag_matches = _check_flags(metadata, flags)
        if flag_matches:
            conditions_checked += 1
            positive_results.extend(flag_matches)
        else:
            conditions_checked += 1

    # price_range
    price_range = filter_conditions.get("price_range")
    if price_range and (price_range.get("min") is not None or price_range.get("max") is not None):
        conditions_checked += 1
        price = item.get("presmpt_prce") or item.get("asign_bdgt_amt")
        if _check_price_range(price, price_range):
            positive_results.append("price:범위내")

    # --- 조건이 하나도 없으면 vacuous truth (전체 통과) ---
    if conditions_checked == 0:
        logger.debug("긍정 조건 없음 (vacuous truth) — 전체 통과 (keyword=%s)", keyword)
        return FilterResult(passed=True, match_reasons=[])

    # --- match_mode 판정 ---
    if match_mode == "all":
        passed = len(positive_results) >= conditions_checked
    else:  # "any"
        passed = len(positive_results) > 0

    logger.debug(
        "필터 판정: passed=%s, mode=%s, matched=%d/%d, title=%s",
        passed, match_mode, len(positive_results), conditions_checked, title[:60],
    )
    return FilterResult(passed=passed, match_reasons=positive_results if passed else [])


def _check_title_keywords(title: str, keywords: list[str]) -> str | None:
    """공고명에 키워드 중 하나라도 포함되면 해당 키워드 반환."""
    title_lower = title.lower()
    for kw in keywords:
        if kw and kw.lower() in title_lower:
            return kw
    return None


def _check_title_exclude(title: str, excludes: list[str]) -> bool:
    """공고명에 제외 키워드가 포함되면 True (탈락)."""
    title_lower = title.lower()
    for ex in excludes:
        if ex and ex.lower() in title_lower:
            return True
    return False


def _check_categories(metadata: dict, categories: dict) -> list[str]:
    """분류 필터 매칭 (OR). 매칭된 분류 목록 반환."""
    matches = []
    for field_key, allowed_values in categories.items():
        if not allowed_values:
            continue
        actual_value = metadata.get(field_key, "")
        if actual_value and actual_value in allowed_values:
            matches.append(f"category:{actual_value}")
    return matches


def _check_flags(metadata: dict, flags: dict) -> list[str]:
    """플래그 필터 매칭. 매칭된 플래그 목록 반환."""
    matches = []
    for flag_key, expected_value in flags.items():
        actual_value = metadata.get(flag_key, "")
        if actual_value == expected_value:
            matches.append(f"flag:{flag_key}={expected_value}")
    return matches


def _check_institutions(item: dict, institutions: list[str]) -> str | None:
    """공고기관/수요기관 부분 매칭. 매칭된 기관명 반환."""
    ntce_instt = (item.get("ntce_instt_nm") or "").lower()
    dminstt = (item.get("dminstt_nm") or "").lower()
    for inst in institutions:
        if not inst:
            continue
        inst_lower = inst.lower()
        if inst_lower in ntce_instt:
            return f"institution:{inst}"
        if inst_lower in dminstt:
            return f"institution:{inst}"
    return None


def _check_price_range(price: float | None, price_range: dict) -> bool:
    """가격 범위 필터. presmpt_prce 우선, asign_bdgt_amt 폴백. 둘 다 None이면 통과."""
    if price is None:
        return True

    min_price = price_range.get("min")
    max_price = price_range.get("max")

    if min_price is not None and price < min_price:
        return False
    if max_price is not None and price > max_price:
        return False
    return True
