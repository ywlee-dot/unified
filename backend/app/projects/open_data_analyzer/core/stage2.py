"""
Stage 2: 주제영역 도출

개방 가능으로 판정된 테이블의 주제영역을 LLM으로 도출합니다.
16대 공공데이터 표준 분류를 참조하여 major_area + sub_area 계층 구조로 분류합니다.
"""

from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from .api_client import call_gemini
from .config import DEFAULT_BATCH_SIZE, DEFAULT_CONCURRENCY


STANDARD_CATEGORIES = [
    "교통 및 물류", "환경·기상", "재정·금융·세제", "문화·체육·관광",
    "보건·의료", "국토관리", "농·축·수산", "교육",
    "과학·기술", "산업·중소기업·고용", "통일·외교·안보", "법무·법제",
    "일반공공행정", "사회복지", "재난·방재·안전", "에너지",
]

_STANDARD_JOINED = ", ".join(STANDARD_CATEGORIES)


def _normalize_subject(s: str) -> str:
    return " ".join(s.strip().split())


def _consolidate_similar_labels(
    results: Dict[str, Dict[str, Any]],
    threshold: float = 0.82,
) -> Dict[str, Dict[str, Any]]:
    """Snap major_area to nearest standard category, then merge near-duplicate free-form labels."""

    def _snap(label: str) -> str:
        best_ratio, best_cat = 0.0, label
        for cat in STANDARD_CATEGORIES:
            r = SequenceMatcher(None, label, cat).ratio()
            if r > best_ratio:
                best_ratio, best_cat = r, cat
        return best_cat if best_ratio >= threshold else label

    for key in results:
        ma = results[key].get("major_area", "")
        if ma:
            results[key]["major_area"] = _snap(_normalize_subject(ma))

    freq = Counter(r.get("major_area", "") for r in results.values() if r.get("major_area"))
    label_map: Dict[str, str] = {}
    for label in freq:
        if label in STANDARD_CATEGORIES:
            label_map[label] = label
            continue
        best_ratio, best_target = 0.0, label
        for other in freq:
            if other == label:
                continue
            r = SequenceMatcher(None, label, other).ratio()
            if r > best_ratio:
                best_ratio, best_target = r, other
        if best_ratio >= threshold:
            label_map[label] = best_target if freq[best_target] >= freq[label] else label
        else:
            label_map[label] = label

    for key in results:
        ma = results[key].get("major_area", "")
        if ma in label_map:
            results[key]["major_area"] = label_map[ma]

    return results


def build_stage2_prompt(table: Any) -> str:
    columns_preview = table.columns[:60]
    table_display = table.table_kr or table.table_en or table.key
    return (
        "다음 테이블의 주제영역을 분류하세요.\n"
        f"참고 분류(16대 표준): {_STANDARD_JOINED}\n"
        "- major_area: 위 16대 분류 중 가장 가까운 것을 선택. 맞는 것이 없으면 짧은 구로 자유 작성.\n"
        "- sub_area: major_area 내 더 구체적인 주제를 한 단어 또는 짧은 구로 작성.\n"
        f"테이블명: {table_display}\n"
        f"컬럼: {', '.join(columns_preview)}\n"
        '출력은 JSON만: {"major_area":"...","sub_area":"..."}'
    )


def build_stage2_multi_prompt(chunk: List[Tuple[str, Any]]) -> str:
    lines: List[str] = []
    for key, table in chunk:
        cols = ", ".join(table.columns[:40])
        table_display = table.table_kr or table.table_en or table.key
        lines.append(f"- key: {key}\n  table: {table_display}\n  columns: {cols}")
    body = "\n".join(lines)

    return (
        "아래 여러 테이블의 주제영역을 각각 분류하세요.\n"
        f"참고 분류(16대 표준): {_STANDARD_JOINED}\n"
        "- major_area: 위 16대 분류 중 가장 가까운 것을 선택. 맞는 것이 없으면 짧은 구로 자유 작성.\n"
        "- sub_area: major_area 내 더 구체적인 주제(한 단어 또는 짧은 구).\n"
        "출력은 JSON만, 다음 형식을 정확히 따르세요:\n"
        '{"results":[{"key":"...","major_area":"...","sub_area":"..."}]}\n\n'
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
        return stage2

    if mock:
        for key, _table in llm_items:
            stage2[key] = {"major_area": "일반공공행정", "sub_area": "모의주제"}
        return stage2

    if not api_key:
        raise RuntimeError("Gemini API 키가 없습니다.")

    chunk_size = max(1, DEFAULT_BATCH_SIZE)
    concurrency = max(1, DEFAULT_CONCURRENCY)
    display_to_key = {(_t.table_kr or _t.table_en or k): k for k, _t in llm_items}

    def _payload_from(row: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "major_area": _normalize_subject(row.get("major_area", "") or ""),
            "sub_area": _normalize_subject(row.get("sub_area", "") or ""),
        }

    def _run_batch(chunk: List[Tuple[str, Any]]) -> List[Tuple[str, Dict[str, Any]]]:
        prompt = build_stage2_multi_prompt(chunk)
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
        prompt_single = build_stage2_prompt(table)
        single = call_gemini(prompt_single, api_key, model, base_url)
        return key, _payload_from(single)

    chunks = list(_chunked(llm_items, chunk_size))
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(_run_batch, chunk) for chunk in chunks]
        for fut in as_completed(futures):
            try:
                for row_key, payload in fut.result():
                    stage2[row_key] = payload
            except Exception:  # noqa: BLE001
                pass

    missing = [k for k, _t in llm_items if k not in stage2]
    if missing:
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(_run_single, key) for key in missing]
            for fut in as_completed(futures):
                try:
                    key, payload = fut.result()
                    stage2[key] = payload
                except Exception:  # noqa: BLE001
                    pass

    _consolidate_similar_labels(stage2)

    return stage2
