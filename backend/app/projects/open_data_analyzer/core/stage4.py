"""
Stage 4: 주제영역별 조인 검토

같은 주제영역의 테이블끼리 조인 가능성을 검토합니다.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

from .api_client import call_gemini
from .config import DEFAULT_CONCURRENCY


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
        if stage2_results and key in stage2_results:
            s2 = stage2_results[key]
            subject = s2.get("major_area") or s2.get("subject_area", "")
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

    concurrency = max(1, DEFAULT_CONCURRENCY)

    def _run_subject(subject: str, tables_in_subject: List[Any]) -> List[Tuple[str, Dict[str, Any]]]:
        prompt = build_stage4_prompt(subject, tables_in_subject)
        result = call_gemini(prompt, api_key, model, base_url)

        display_map: Dict[str, str] = {}
        for table in tables_in_subject:
            table_display = table.table_kr or table.table_en or table.key
            display_map[table_display] = table.key
            display_map[table.key] = table.key

        collected: List[Tuple[str, Dict[str, Any]]] = []
        for join in result.get("joins", []) or []:
            table_a = join.get("table_a")
            table_b = join.get("table_b")
            join_keys = join.get("join_keys", []) or []
            if not table_a or not table_b:
                continue
            key_a = display_map.get(table_a)
            if key_a:
                collected.append((key_a, {"table_b": table_b, "join_keys": join_keys}))
        return collected

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [
            executor.submit(_run_subject, subject, tables_in_subject)
            for subject, tables_in_subject in valid_subjects.items()
        ]
        for fut in as_completed(futures):
            try:
                for key_a, payload in fut.result():
                    joins.setdefault(key_a, []).append(payload)
            except Exception:  # noqa: BLE001
                pass

    return joins
