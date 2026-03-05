"""Entity matching utilities for institutions and leaders."""

import re


def count_occurrences(text: str, term: str) -> int:
    """Count how many times *term* appears in *text* (case-insensitive)."""
    if not term:
        return 0
    pattern = re.escape(term)
    return len(re.findall(pattern, text, flags=re.IGNORECASE))


def match_entities(text: str, target_entities: dict) -> list[dict]:
    """Return a list of matched entities with their occurrence counts.

    Args:
        text: Article text to search.
        target_entities: Dict with keys "institutions" and/or "leaders",
                         each containing a list of name strings.

    Returns:
        List of dicts: [{name, type, count}, ...] for entities with count > 0.
    """
    results: list[dict] = []

    for entity_type in ("institutions", "leaders"):
        for name in target_entities.get(entity_type, []):
            cnt = count_occurrences(text, name)
            if cnt > 0:
                results.append({"name": name, "type": entity_type, "count": cnt})

    return results


def extract_entity_names(
    text: str, target_entities: dict
) -> tuple[str | None, str | None]:
    """Return the first matched institution name and leader name.

    Returns:
        (institution_name, leader_name) — either may be None.
    """
    institution_name: str | None = None
    leader_name: str | None = None

    for name in target_entities.get("institutions", []):
        if count_occurrences(text, name) > 0:
            institution_name = name
            break

    for name in target_entities.get("leaders", []):
        if count_occurrences(text, name) > 0:
            leader_name = name
            break

    return institution_name, leader_name


def contains_entity(text: str, target_entities: dict) -> bool:
    """Return True if any entity from target_entities is found in text."""
    return len(match_entities(text, target_entities)) > 0
