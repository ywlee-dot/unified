"""
Stage 5: 개방데이터 후보군 검증 (최종 점검)

모든 선행 단계 결과를 종합하여 최종 개방 가능 여부를 평가합니다.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

from .api_client import call_gemini
from .config import DEFAULT_CONCURRENCY


def build_stage5_prompt(
    table: Any,
    subject_area: str = "",
    core_columns: List[str] | None = None,
    joins: List[Dict[str, Any]] | None = None,
) -> str:
    if core_columns is None:
        core_columns = []
    if joins is None:
        joins = []

    table_display = table.table_kr or table.table_en or table.key

    join_text = ", ".join(
        f"{j.get('table_b')}({','.join(j.get('join_keys', []))})"
        for j in joins
    ) if joins else "없음"

    return (
        "다음 테이블의 개방 가능성을 최종 점검하고 개방 데이터셋명을 제안하세요.\n"
        f"테이블명: {table_display}\n"
        f"주제영역: {subject_area}\n"
        f"핵심컬럼: {', '.join(core_columns)}\n"
        f"조인정보: {join_text}\n"
        "출력은 JSON만: {\"final_openable\":\"가능/불가능\", \"dataset_name\":\"...\", "
        "\"final_columns\":[\"...\"], \"final_reason\":\"...\"}"
    )


def run_stage5(
    tables: Dict[str, Any],
    api_key: Optional[str],
    base_url: str,
    model: str,
    sleep: float,
    mock: bool,
    stage1_results: Optional[Dict[str, Dict[str, Any]]] = None,
    stage2_results: Optional[Dict[str, Dict[str, Any]]] = None,
    stage3_results: Optional[Dict[str, Dict[str, Any]]] = None,
    joins_results: Optional[Dict[str, List[Dict[str, Any]]]] = None,
) -> Dict[str, Dict[str, Any]]:
    stage5: Dict[str, Dict[str, Any]] = {}

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
        return stage5

    if mock:
        for key, table in llm_items:
            core_columns = (
                stage3_results[key].get("core_columns", [])
                if stage3_results and key in stage3_results
                else []
            )
            table_display = table.table_kr or table.table_en or table.key
            stage5[key] = {
                "final_openable": "가능",
                "dataset_name": f"{table_display} 데이터셋",
                "final_columns": core_columns,
                "final_reason": "모의 판정",
            }
        return stage5

    if not api_key:
        raise RuntimeError("Gemini API 키가 없습니다.")

    concurrency = max(1, DEFAULT_CONCURRENCY)

    def _context(key: str, table: Any):
        s2 = stage2_results.get(key, {}) if stage2_results else {}
        subject_area = s2.get("major_area") or s2.get("subject_area", "")
        core_columns = stage3_results.get(key, {}).get("core_columns", []) if stage3_results else []
        table_joins = joins_results.get(key, []) if joins_results else []
        return subject_area, core_columns, table_joins

    def _run_one(key: str, table: Any):
        subject_area, core_columns, table_joins = _context(key, table)
        prompt = build_stage5_prompt(table, subject_area, core_columns, table_joins)
        result = call_gemini(prompt, api_key, model, base_url)
        return key, {
            "final_openable": result.get("final_openable", ""),
            "dataset_name": result.get("dataset_name", ""),
            "final_columns": result.get("final_columns", []) or [],
            "final_reason": result.get("final_reason", ""),
        }

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(_run_one, key, table) for key, table in llm_items]
        for fut in as_completed(futures):
            try:
                key, payload = fut.result()
                stage5[key] = payload
            except Exception:  # noqa: BLE001
                pass

    return stage5
