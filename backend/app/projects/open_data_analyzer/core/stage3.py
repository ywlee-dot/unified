"""
Stage 3: 핵심 컬럼 기반 데이터셋 구성

개방 가능으로 판정된 테이블에서 의미있는 핵심 컬럼만 선택합니다.
"""

import time
from typing import Any, Dict, List, Optional, Tuple

from .api_client import call_gemini
from .config import DEFAULT_BATCH_SIZE


def build_stage3_prompt(table: Any) -> str:
    columns_preview = table.columns[:80]
    table_display = table.table_kr or table.table_en or table.key
    return (
        "다음 테이블에서 개방 데이터셋에 필요한 핵심 컬럼만 선정하세요. "
        "ID, 개인정보, 메타데이터는 제외하세요.\n"
        f"테이블명: {table_display}\n"
        f"컬럼: {', '.join(columns_preview)}\n"
        "출력은 JSON만: {\"core_columns\":[\"컬럼1\",\"컬럼2\"], \"dataset_description\":\"...\"}"
    )


def build_stage3_multi_prompt(chunk: List[Tuple[str, Any]]) -> str:
    lines: List[str] = []
    for key, table in chunk:
        cols = ", ".join(table.columns[:60])
        table_display = table.table_kr or table.table_en or table.key
        lines.append(f"- key: {key}\n  table: {table_display}\n  columns: {cols}")
    body = "\n".join(lines)

    return (
        "아래 여러 테이블에 대해 개방 데이터셋에 필요한 핵심 컬럼만 각각 선정하세요. "
        "ID, 개인정보, 메타데이터는 제외하세요.\n"
        "출력은 JSON만, 다음 형식을 정확히 따르세요:\n"
        "{\"results\":[{\"key\":\"...\",\"core_columns\":[\"...\"],\"dataset_description\":\"...\"}]}\n\n"
        f"{body}"
    )


def _chunked(items: list, size: int) -> list:
    if size <= 0:
        return [items]
    return [items[i : i + size] for i in range(0, len(items), size)]


def run_stage3(
    tables: Dict[str, Any],
    api_key: Optional[str],
    base_url: str,
    model: str,
    sleep: float,
    mock: bool,
    stage1_results: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, Dict[str, Any]]:
    stage3: Dict[str, Dict[str, Any]] = {}

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
        return stage3

    if mock:
        for key, table in llm_items:
            stage3[key] = {
                "core_columns": table.columns[:5],
                "dataset_description": "모의 데이터셋"
            }
        return stage3

    if not api_key:
        raise RuntimeError("Gemini API 키가 없습니다.")

    chunk_size = max(1, DEFAULT_BATCH_SIZE)
    display_to_key = {(tables[k].table_kr or tables[k].table_en or k): k for k, _t in llm_items}

    for chunk in _chunked(llm_items, chunk_size):
        prompt = build_stage3_multi_prompt(chunk)
        result = call_gemini(prompt, api_key, model, base_url)
        results = result.get("results", [])

        for row in results:
            row_key = str(row.get("key", "")).strip()
            if not row_key:
                row_table = str(row.get("table", "")).strip()
                row_key = display_to_key.get(row_table, "")
            if not row_key or row_key not in tables:
                continue
            stage3[row_key] = {
                "core_columns": row.get("core_columns", []),
                "dataset_description": row.get("dataset_description", ""),
            }

        missing = [k for k, _t in chunk if k not in stage3]
        for key in missing:
            table = tables[key]
            prompt_single = build_stage3_prompt(table)
            single = call_gemini(prompt_single, api_key, model, base_url)
            stage3[key] = {
                "core_columns": single.get("core_columns", []),
                "dataset_description": single.get("dataset_description", ""),
            }

        if sleep:
            time.sleep(sleep)

    return stage3
