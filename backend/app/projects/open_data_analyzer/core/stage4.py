"""
Stage 4: 주제영역별 조인 검토

같은 주제영역의 테이블끼리 조인 가능성을 검토합니다.
"""

import time
from typing import Any, Dict, List, Optional

from .api_client import call_gemini


def build_stage4_prompt(subject: str, tables_in_subject: list) -> str:
    lines = [f"주제영역: {subject}"]
    for table in tables_in_subject:
        cols = ", ".join(table.columns[:50])
        table_display = table.table_kr or table.table_en or table.key
        lines.append(f"- {table_display}: {cols}")
    body = "\n".join(lines)

    return (
        "같은 주제영역의 테이블 간 조인 가능성을 검토하고 조인 키를 식별하세요.\n"
        f"{body}\n"
        "출력은 JSON만: {\"joins\":[{\"table_a\":\"...\", \"table_b\":\"...\", \"join_keys\":[\"키1\",\"키2\"]}]}"
    )


def run_stage4(
    tables: Dict[str, Any],
    api_key: Optional[str],
    base_url: str,
    model: str,
    sleep: float,
    mock: bool,
    stage2_results: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    joins: Dict[str, List[Dict[str, Any]]] = {}

    subject_groups: Dict[str, List[Any]] = {}
    for key, table in tables.items():
        if hasattr(table, 'subject_area'):
            subject = table.subject_area
        elif stage2_results and key in stage2_results:
            subject = stage2_results[key].get("subject_area", "")
        else:
            subject = ""

        if not subject:
            continue
        subject_groups.setdefault(subject, []).append(table)

    valid_subjects = {s: t for s, t in subject_groups.items() if len(t) >= 2}

    if not valid_subjects:
        return joins

    if mock:
        for subject, tables_in_subject in valid_subjects.items():
            for table in tables_in_subject:
                joins.setdefault(table.key, [])
        return joins

    if not api_key:
        raise RuntimeError("Gemini API 키가 없습니다.")

    for subject, tables_in_subject in valid_subjects.items():
        prompt = build_stage4_prompt(subject, tables_in_subject)
        result = call_gemini(prompt, api_key, model, base_url)

        display_map: Dict[str, str] = {}
        for table in tables_in_subject:
            table_display = table.table_kr or table.table_en or table.key
            display_map[table_display] = table.key
            display_map[table.key] = table.key

        for join in result.get("joins", []):
            table_a = join.get("table_a")
            table_b = join.get("table_b")
            join_keys = join.get("join_keys", [])

            if not table_a or not table_b:
                continue

            key_a = display_map.get(table_a)
            if key_a:
                joins.setdefault(key_a, []).append({
                    "table_b": table_b,
                    "join_keys": join_keys,
                })

        if sleep:
            time.sleep(sleep)

    return joins
