"""
Stage 3: 핵심 컬럼 기반 데이터셋 구성

개방 가능으로 판정된 테이블에서 의미있는 핵심 컬럼만 선택합니다.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

from .api_client import call_gemini
from .config import DEFAULT_BATCH_SIZE, DEFAULT_CONCURRENCY


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

    def _passes(s1: Dict[str, Any]) -> bool:
        bucket = s1.get("bucket") or s1.get("openable")
        return bucket in ("전체개방", "부분개방", "가능", "검토 필요")

    llm_items = []
    for key, table in tables.items():
        if stage1_results and key in stage1_results:
            if _passes(stage1_results[key]):
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
    concurrency = max(1, DEFAULT_CONCURRENCY)
    display_to_key = {(tables[k].table_kr or tables[k].table_en or k): k for k, _t in llm_items}

    def _payload_from(row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "core_columns": row.get("core_columns", []) or [],
            "dataset_description": row.get("dataset_description", "") or "",
        }

    def _run_batch(chunk: List[Tuple[str, Any]]) -> List[Tuple[str, Dict[str, Any]]]:
        prompt = build_stage3_multi_prompt(chunk)
        result = call_gemini(prompt, api_key, model, base_url)
        rows = result.get("results", []) or []
        recorded: List[Tuple[str, Dict[str, Any]]] = []
        for row in rows:
            row_key = str(row.get("key", "")).strip()
            if not row_key:
                row_table = str(row.get("table", "")).strip()
                row_key = display_to_key.get(row_table, "")
            if not row_key or row_key not in tables:
                continue
            recorded.append((row_key, _payload_from(row)))
        return recorded

    def _run_single(key: str) -> Tuple[str, Dict[str, Any]]:
        table = tables[key]
        prompt_single = build_stage3_prompt(table)
        single = call_gemini(prompt_single, api_key, model, base_url)
        return key, _payload_from(single)

    chunks = list(_chunked(llm_items, chunk_size))
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(_run_batch, chunk) for chunk in chunks]
        for fut in as_completed(futures):
            try:
                for row_key, payload in fut.result():
                    stage3[row_key] = payload
            except Exception:  # noqa: BLE001
                pass

    missing = [k for k, _t in llm_items if k not in stage3]
    if missing:
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(_run_single, key) for key in missing]
            for fut in as_completed(futures):
                try:
                    key, payload = fut.result()
                    stage3[key] = payload
                except Exception:  # noqa: BLE001
                    pass

    return stage3
