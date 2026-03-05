"""
Stage 1: 개방가능 여부 판단

입력: 테이블명, 컬럼명 정보
출력: 각 테이블별 개방가능여부, 불가능사유번호, 판단사유
"""

import re
import time
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from .api_client import call_gemini
from .config import (
    GEMINI_BASE_URL,
    GEMINI_MODEL,
    DEFAULT_BATCH_SIZE,
    SYSTEM_PATTERNS,
    SYSTEM_PREFIXES,
    SYSTEM_KOREAN_KEYWORDS,
)
from .file_utils import read_sheet_rows, find_col, normalize_spaces


@dataclass
class SimpleTable:
    """최소한의 테이블 정보"""
    key: str
    table_kr: str
    table_en: str
    columns: List[str]


def is_system_table(table_name: str) -> bool:
    """시스템 테이블 판별"""
    upper = table_name.upper()
    if any(upper.startswith(prefix) for prefix in SYSTEM_PREFIXES):
        return True
    if any(keyword in table_name for keyword in SYSTEM_KOREAN_KEYWORDS):
        return True
    if re.search(r"_\d{6,}$", table_name):
        return True
    for pattern in SYSTEM_PATTERNS:
        if pattern.search(table_name):
            return True
    return False


def normalize_table_key(table_kr: str, table_en: str) -> str:
    en_norm = normalize_spaces(table_en).lower() if table_en else ""
    kr_norm = normalize_spaces(table_kr) if table_kr else ""
    if en_norm and kr_norm:
        return f"{en_norm}::{kr_norm}"
    return en_norm or kr_norm


def calculate_similarity(key1: str, key2: str) -> float:
    return SequenceMatcher(None, key1, key2).ratio()


def find_matching_table(new_key: str, existing_tables: dict, threshold: float = 0.85) -> str | None:
    for existing_key in existing_tables.keys():
        if calculate_similarity(new_key, existing_key) >= threshold:
            return existing_key
    return None


def merge_table_data(existing: dict, new: dict, new_source: str) -> dict:
    merged = {
        'key': existing.get('key', ''),
        'table_kr': existing.get('table_kr', ''),
        'table_en': existing.get('table_en', ''),
        'columns': []
    }

    if new.get('table_kr') and len(new['table_kr']) > len(merged['table_kr']):
        merged['table_kr'] = new['table_kr']
    if new.get('table_en') and len(new['table_en']) > len(merged['table_en']):
        merged['table_en'] = new['table_en']

    existing_cols = set(existing.get('columns', []))
    new_cols = set(new.get('columns', []))
    merged['columns'] = sorted(list(existing_cols | new_cols))

    if 'file_sources' not in merged:
        merged['file_sources'] = existing.get('file_sources', [])
    if new_source not in merged['file_sources']:
        merged['file_sources'].append(new_source)

    return merged


def calculate_confidence(table_kr: str, table_en: str, columns: List[str]) -> Dict[str, Any]:
    score = 0
    has_columns = len(columns) > 0
    column_count = len(columns)

    if table_kr and table_kr.strip():
        score += 20
    if table_en and table_en.strip():
        score += 20
    if has_columns:
        score += 30
        score += min(30, column_count * 2)

    if score >= 80:
        quality = 'high'
    elif score >= 50:
        quality = 'medium'
    else:
        quality = 'low'

    return {
        'confidence': score,
        'has_columns': has_columns,
        'column_count': column_count,
        'data_quality': quality
    }


def extract_tables_from_excel(excel_path: str, sheet_name: Optional[str]) -> Dict[str, SimpleTable]:
    """엑셀에서 테이블 정보 추출"""
    headers, rows = read_sheet_rows(excel_path, sheet_name)

    idx_table_kr = find_col(headers, ["한글 테이블명", "테이블한글명", "테이블명(한글)", "테이블명"])
    idx_table_en = find_col(headers, ["영문 테이블명", "테이블영문명", "테이블명(영문)"])
    idx_col_kr = find_col(headers, ["한글 컬럼명", "컬럼명(한글)", "컬럼명"])
    idx_col_en = find_col(headers, ["영문 컬럼명", "컬럼명(영문)"])

    if idx_table_kr is None and idx_table_en is None:
        raise ValueError(f"테이블명 컬럼을 찾을 수 없습니다. 파일의 헤더: {headers}")

    has_columns = not (idx_col_kr is None and idx_col_en is None)

    tables: Dict[str, SimpleTable] = {}
    col_buffers: Dict[str, List[str]] = {}

    for row in rows:
        table_kr_raw = str(row[idx_table_kr]).strip() if idx_table_kr is not None and row[idx_table_kr] else ""
        table_en_raw = str(row[idx_table_en]).strip() if idx_table_en is not None and row[idx_table_en] else ""
        table_kr = normalize_spaces(table_kr_raw) if table_kr_raw else ""
        table_en = normalize_spaces(table_en_raw) if table_en_raw else ""

        if not table_kr and not table_en:
            continue

        key = normalize_table_key(table_kr, table_en)

        if key not in tables:
            tables[key] = SimpleTable(key=key, table_kr=table_kr, table_en=table_en, columns=[])
            col_buffers[key] = []

        if has_columns:
            col_kr = str(row[idx_col_kr]).strip() if idx_col_kr is not None and row[idx_col_kr] else ""
            col_en = str(row[idx_col_en]).strip() if idx_col_en is not None and row[idx_col_en] else ""

            if col_kr or col_en:
                col_kr_norm = normalize_spaces(col_kr) if col_kr else ""
                col_en_norm = normalize_spaces(col_en) if col_en else ""
                col_display = f"{col_kr_norm}({col_en_norm})" if col_kr_norm and col_en_norm else (col_kr_norm or col_en_norm)
                if col_display not in col_buffers[key]:
                    col_buffers[key].append(col_display)

    for key, table in tables.items():
        table.columns = col_buffers[key]

    return tables


def build_stage1_prompt(table: SimpleTable, reasons: List[str]) -> str:
    columns_preview = table.columns[:60]
    table_display = table.table_kr or table.table_en or table.key
    has_columns = len(table.columns) > 0

    if has_columns:
        prompt = (
            "다음 테이블을 공공데이터로 개방 가능한지 판단하세요. "
            "불가능이면 1~9번 사유 번호를 하나 이상 선택하세요.\n"
            "9번은 시스템 테이블(임시/백업/로그/뷰/관리)입니다.\n"
            "반드시 아래 '불가 사유 목록'을 규칙/체크리스트로 우선 적용하고, "
            "해당되면 '불가능'으로 판정하세요.\n"
            f"테이블명: {table_display}\n"
            f"컬럼: {', '.join(columns_preview)}\n"
        )
    else:
        prompt = (
            "다음 테이블을 공공데이터로 개방 가능한지 판단하세요. "
            "불가능이면 1~9번 사유 번호를 하나 이상 선택하세요.\n"
            "9번은 시스템 테이블(임시/백업/로그/뷰/관리)입니다.\n"
            "반드시 아래 '불가 사유 목록'을 규칙/체크리스트로 우선 적용하고, "
            "해당되면 '불가능'으로 판정하세요.\n"
            f"테이블명: {table_display}\n"
            "컬럼 정보 없음 - 테이블명만으로 판단\n"
        )

    if reasons:
        prompt += "\n불가 사유 목록(번호 포함, 규칙으로 적용):\n" + "\n".join(reasons)
        prompt += (
            "\n\n판정 규칙:\n"
            "- 사유 목록에 해당하면 openable은 반드시 '불가능'.\n"
            "- reason_numbers는 목록에 있는 번호만 사용.\n"
            "- 근거는 reason_text에 간단히 요약."
        )

    prompt += "\n\n출력은 JSON만: {\"openable\":\"가능/불가능\", \"reason_numbers\":[1,2], \"reason_text\":\"...\"}"
    return prompt


def build_stage1_multi_prompt(chunk: List[Tuple[str, SimpleTable]], reasons: List[str]) -> str:
    lines: List[str] = []
    for key, table in chunk:
        table_display = table.table_kr or table.table_en or table.key
        has_columns = len(table.columns) > 0

        if has_columns:
            cols = ", ".join(table.columns[:40])
            lines.append(f"- key: {key}\n  table: {table_display}\n  columns: {cols}")
        else:
            lines.append(f"- key: {key}\n  table: {table_display}\n  columns: 컬럼 정보 없음")

    body = "\n".join(lines)

    prompt = (
        "아래 여러 테이블에 대해 공공데이터 개방 가능 여부를 각각 판단하세요.\n"
        "반드시 아래 '불가 사유 목록'을 규칙/체크리스트로 우선 적용하고, "
        "해당되면 '불가능'으로 판정하세요.\n"
        "출력은 JSON만, 다음 형식을 정확히 따르세요:\n"
        "{\"results\":[{\"key\":\"...\",\"openable\":\"가능/불가능\","
        "\"reason_numbers\":[1,2],\"reason_text\":\"...\"}]}\n\n"
        f"{body}"
    )

    if reasons:
        prompt += "\n\n불가 사유 목록(번호 포함, 규칙으로 적용):\n" + "\n".join(reasons)
        prompt += (
            "\n\n판정 규칙:\n"
            "- 사유 목록에 해당하면 openable은 반드시 '불가능'.\n"
            "- reason_numbers는 목록에 있는 번호만 사용.\n"
            "- 근거는 reason_text에 간단히 요약."
        )

    return prompt


def _chunked(items: list, size: int) -> list:
    if size <= 0:
        return [items]
    return [items[i : i + size] for i in range(0, len(items), size)]


def run_stage1(
    tables: Dict[str, SimpleTable],
    reasons: List[str],
    api_key: Optional[str],
    base_url: str,
    model: str,
    sleep: float,
    mock: bool,
) -> Dict[str, Dict[str, Any]]:
    stage1: Dict[str, Dict[str, Any]] = {}
    items = list(tables.items())

    llm_items: List[Tuple[str, SimpleTable]] = []
    for key, table in items:
        display_name = table.table_kr or table.table_en or key
        if is_system_table(display_name):
            stage1[key] = {
                "openable": "불가능",
                "reason_numbers": [9],
                "reason_text": "시스템 테이블 자동 필터링",
            }
        else:
            llm_items.append((key, table))

    if not llm_items:
        return stage1

    if mock:
        for key, _table in llm_items:
            stage1[key] = {"openable": "가능", "reason_numbers": [], "reason_text": "모의 판정"}
        return stage1

    if not api_key:
        raise RuntimeError("Gemini API 키가 없습니다. GEMINI_API_KEY를 설정하세요.")

    chunk_size = max(1, DEFAULT_BATCH_SIZE)
    display_to_key = {(tables[k].table_kr or tables[k].table_en or k): k for k, _t in llm_items}

    for chunk in _chunked(llm_items, chunk_size):
        prompt = build_stage1_multi_prompt(chunk, reasons)
        result = call_gemini(prompt, api_key, model, base_url)
        results = result.get("results", [])

        for row in results:
            row_key = str(row.get("key", "")).strip()
            if not row_key:
                row_table = str(row.get("table", "")).strip()
                row_key = display_to_key.get(row_table, "")
            if not row_key or row_key not in tables:
                continue
            stage1[row_key] = {
                "openable": row.get("openable", ""),
                "reason_numbers": row.get("reason_numbers", []),
                "reason_text": row.get("reason_text", ""),
            }

        missing = [k for k, _t in chunk if k not in stage1]
        for key in missing:
            table = tables[key]
            prompt_single = build_stage1_prompt(table, reasons)
            single = call_gemini(prompt_single, api_key, model, base_url)
            stage1[key] = {
                "openable": single.get("openable", ""),
                "reason_numbers": single.get("reason_numbers", []),
                "reason_text": single.get("reason_text", ""),
            }

        if sleep:
            time.sleep(sleep)

    return stage1
