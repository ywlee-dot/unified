"""
Stage 2: 주제영역 도출

개방 가능으로 판정된 테이블의 주제영역을 LLM으로 도출합니다.
"""

import time
from typing import Any, Dict, List, Optional, Tuple

from .api_client import call_gemini
from .config import DEFAULT_BATCH_SIZE


def build_stage2_prompt(table: Any) -> str:
    columns_preview = table.columns[:60]
    table_display = table.table_kr or table.table_en or table.key
    return (
        "다음 테이블의 주제영역을 한 단어 또는 짧은 구로 도출하세요.\n"
        f"테이블명: {table_display}\n"
        f"컬럼: {', '.join(columns_preview)}\n"
        "출력은 JSON만: {\"subject_area\":\"...\"}"
    )


def build_stage2_multi_prompt(chunk: List[Tuple[str, Any]]) -> str:
    lines: List[str] = []
    for key, table in chunk:
        cols = ", ".join(table.columns[:40])
        table_display = table.table_kr or table.table_en or table.key
        lines.append(f"- key: {key}\n  table: {table_display}\n  columns: {cols}")
    body = "\n".join(lines)

    return (
        "아래 여러 테이블의 주제영역을 각각 한 단어 또는 짧은 구로 도출하세요.\n"
        "출력은 JSON만, 다음 형식을 정확히 따르세요:\n"
        "{\"results\":[{\"key\":\"...\",\"subject_area\":\"...\"}]}\n\n"
        f"{body}"
    )


def _chunked(items: list, size: int) -> list:
    if size <= 0:
        return [items]
    return [items[i : i + size] for i in range(0, len(items), size)]


def run_stage2(
    tables: Dict[str, Any],
    api_key: Optional[str],
    base_url: str,
    model: str,
    sleep: float,
    mock: bool,
    stage1_results: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Dict[str, Any]]:
    stage2: Dict[str, Dict[str, Any]] = {}

    llm_items = []
    for key, table in tables.items():
        if hasattr(table, 'openable'):
            if table.openable == "가능":
                llm_items.append((key, table))
        elif stage1_results and key in stage1_results:
            if stage1_results[key].get("openable") == "가능":
                llm_items.append((key, table))
        else:
            llm_items.append((key, table))

    if not llm_items:
        return stage2

    if mock:
        for key, _table in llm_items:
            stage2[key] = {"subject_area": "모의주제"}
        return stage2

    if not api_key:
        raise RuntimeError("Gemini API 키가 없습니다.")

    chunk_size = max(1, DEFAULT_BATCH_SIZE)
    display_to_key = {(tables[k].table_kr or tables[k].table_en or k): k for k, _t in llm_items}

    for chunk in _chunked(llm_items, chunk_size):
        prompt = build_stage2_multi_prompt(chunk)
        result = call_gemini(prompt, api_key, model, base_url)
        results = result.get("results", [])

        for row in results:
            row_key = str(row.get("key", "")).strip()
            if not row_key:
                row_table = str(row.get("table", "")).strip()
                row_key = display_to_key.get(row_table, "")
            if not row_key or row_key not in tables:
                continue
            stage2[row_key] = {"subject_area": row.get("subject_area", "")}

        missing = [k for k, _t in chunk if k not in stage2]
        for key in missing:
            table = tables[key]
            prompt_single = build_stage2_prompt(table)
            single = call_gemini(prompt_single, api_key, model, base_url)
            stage2[key] = {"subject_area": single.get("subject_area", "")}

        if sleep:
            time.sleep(sleep)

    return stage2
