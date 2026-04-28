"""
Stage 1: 개방가능 여부 판단 (컬럼 단위)

각 테이블의 컬럼별로 개방 가능 여부를 판단합니다.
- 개방 가능 컬럼 수 == 전체 컬럼 수 → 전체개방
- 개방 가능 컬럼 수 >= 3              → 부분개방
- 개방 가능 컬럼 수 < 3               → 불가능
"""

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

from .api_client import call_gemini
from .config import (
    DEFAULT_CONCURRENCY,
    SYSTEM_PATTERNS,
    SYSTEM_PREFIXES,
    SYSTEM_KOREAN_KEYWORDS,
)
from .file_utils import read_sheet_rows, find_col, normalize_spaces


OPEN_COLUMN_THRESHOLD = 3  # 부분개방 최소 컬럼 수

STANDARD_CATEGORIES = [
    "교통 및 물류", "환경·기상", "재정·금융·세제", "문화·체육·관광",
    "보건·의료", "국토관리", "농·축·수산", "교육",
    "과학·기술", "산업·중소기업·고용", "통일·외교·안보", "법무·법제",
    "일반공공행정", "사회복지", "재난·방재·안전", "에너지",
]

EXCLUSION_REASONS_LIST = [
    (1, "법률상 비공개", "다른 법률 또는 법률에서 위임한 명령에 따라 비밀이나 비공개 사항으로 규정된 정보"),
    (2, "국가안보·외교", "국가안전보장·국방·통일·외교관계 등에 관한 사항"),
    (3, "국민 생명·재산 보호", "공개될 경우 국민의 생명·신체 및 재산의 보호에 현저한 지장을 초래할 우려"),
    (4, "재판·수사", "진행 중인 재판, 범죄의 예방·수사·공소·형 집행·교정·보안처분에 관한 사항"),
    (5, "감사·검사·인사관리", "감사·감독·검사·시험·규제·입찰계약·기술개발·인사관리, 의사결정·내부검토 과정"),
    (6, "개인정보", "성명·주민등록번호·전화번호·이메일·주소·계좌번호·의료기록 등 개인정보 (PK/FK/순번 ID는 제외)"),
    (7, "영업비밀", "법인·단체·개인의 경영상·영업상 비밀"),
    (8, "부동산투기·매점매석", "공개 시 부동산 투기, 매점매석 등 특정인 이익/불이익 우려"),
    (9, "시스템 테이블", "임시테이블, 백업 테이블, 로그 테이블, 뷰 테이블, 시스템 관리 테이블 / 암호화키, 세션토큰, 내부인증코드 등 시스템 내부 컬럼"),
]

EXCLUSION_GUIDE = (
    "[개방 불가 사유 9가지 (반드시 이 중에서 선택)]\n"
    + "\n".join(f"  {code}. {label}: {desc}" for code, label, desc in EXCLUSION_REASONS_LIST)
    + "\n"
)

PRINCIPLES = (
    "[판정 원칙]\n"
    "- 컬럼명만으로 판단이 어려울 때는 개방 가능(true)으로 처리하세요.\n"
    "- reason_codes는 개방 불가(false)인 경우에만 [1-9] 정수 배열로 작성. 여러 사유가 동시에 해당되면 모두 포함.\n"
    "- reason은 짧은 라벨 텍스트(예: \"개인정보\", \"시스템 테이블\"). 가능이면 빈 문자열.\n"
    "- 단순 PK·FK·시퀀스 ID(예: id, seq, no, num)는 개인정보 아니므로 개방 가능.\n"
    "- 출력은 JSON만, 앞뒤 설명 텍스트 없이.\n"
)


@dataclass
class SimpleTable:
    key: str
    table_kr: str
    table_en: str
    columns: List[str]


def is_system_table(table_name: str) -> bool:
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
        'columns': [],
    }
    if new.get('table_kr') and len(new['table_kr']) > len(merged['table_kr']):
        merged['table_kr'] = new['table_kr']
    if new.get('table_en') and len(new['table_en']) > len(merged['table_en']):
        merged['table_en'] = new['table_en']

    existing_cols = set(existing.get('columns', []))
    new_cols = set(new.get('columns', []))
    merged['columns'] = sorted(list(existing_cols | new_cols))

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
        'data_quality': quality,
    }


def extract_tables_from_excel(excel_path: str, sheet_name: Optional[str]) -> Dict[str, "SimpleTable"]:
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
                col_display = (
                    f"{col_kr_norm}({col_en_norm})"
                    if col_kr_norm and col_en_norm
                    else (col_kr_norm or col_en_norm)
                )
                if col_display not in col_buffers[key]:
                    col_buffers[key].append(col_display)

    for key, table in tables.items():
        table.columns = col_buffers[key]

    return tables


def build_stage1_prompt(table: SimpleTable) -> str:
    table_display = table.table_kr or table.table_en or table.key
    cols = table.columns or []
    columns_text = ", ".join(cols) if cols else "(컬럼 정보 없음)"
    std_cats = ", ".join(STANDARD_CATEGORIES)

    return (
        "당신은 공공데이터 개방 심사 전문가입니다.\n"
        "아래 테이블의 각 컬럼 개방 가능 여부를 판단하고, 주제영역과 데이터셋명을 제안하세요.\n\n"
        f"{EXCLUSION_GUIDE}\n"
        f"{PRINCIPLES}\n"
        f"[테이블명] {table_display}\n"
        f"[컬럼 목록] {columns_text}\n\n"
        "[주제영역 참고 - 16대 표준 분류]\n"
        f"{std_cats}\n"
        "major_area: 위 분류 중 가장 가까운 것 선택. 없으면 짧은 구로 자유 작성.\n"
        "sub_area: major_area 내 더 구체적인 주제(한 단어 또는 짧은 구).\n"
        "dataset_name: 개방 가능 컬럼 기준 데이터셋명 제안. 전부 불가면 빈 문자열.\n\n"
        "[출력 JSON만]\n"
        '{"columns": [{"name": "컬럼명", "openable": true, "reason_codes": [], "reason": ""}], '
        '"major_area": "...", "sub_area": "...", "dataset_name": "..."}\n'
        "예: 주민번호 컬럼 → openable=false, reason_codes=[6], reason=\"개인정보\"\n"
        "예: 영업매출 컬럼 → openable=false, reason_codes=[7], reason=\"영업비밀\"\n"
        "예: log_id 컬럼 → openable=false, reason_codes=[9], reason=\"시스템 내부\""
    )


def classify_bucket(open_count: int, total_count: int) -> str:
    if total_count == 0:
        return "불가능"
    if open_count >= total_count:
        return "전체개방"
    if open_count >= OPEN_COLUMN_THRESHOLD:
        return "부분개방"
    return "불가능"


# kept for backward compat with __init__.py exports
HIGH_SCORE_THRESHOLD = 8
LOW_SCORE_THRESHOLD = 3
normalize_table_key = normalize_table_key


def _normalize_col_name(name: str) -> str:
    """Normalize for matching across '한글(영문)' / '한글' format variations.

    LLM이 컬럼명을 짧게 응답해도 원본 추출 컬럼과 매칭되도록 괄호 앞부분만 사용.
    """
    base = name.split("(")[0].strip()
    return (base or name.strip()).lower()


def _parse_column_result(
    table: SimpleTable,
    result: Dict[str, Any],
) -> Dict[str, Any]:
    col_judgments = result.get("columns", []) or []

    # 1) 추출된 table.columns가 진실 소스 — 정규화된 이름 → 원본 표시명
    canonical: Dict[str, str] = {}
    for col in table.columns:
        norm = _normalize_col_name(col)
        if norm and norm not in canonical:
            canonical[norm] = col

    # 2) LLM 판정을 정규화 키로 수집 (중복 LLM 응답 방어)
    llm_open: set = set()
    llm_closed: Dict[str, Dict[str, Any]] = {}  # normalized → {reason, reason_codes}
    for item in col_judgments:
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        norm = _normalize_col_name(name)
        if not norm:
            continue
        if item.get("openable", True):
            llm_open.add(norm)
        else:
            codes_raw = item.get("reason_codes", [])
            codes: List[int] = []
            if isinstance(codes_raw, list):
                for c in codes_raw:
                    try:
                        n = int(c)
                        if 1 <= n <= 9 and n not in codes:
                            codes.append(n)
                    except (TypeError, ValueError):
                        continue
            llm_closed[norm] = {
                "reason": str(item.get("reason", "")),
                "reason_codes": codes,
            }

    open_columns: List[str] = []
    closed_columns: List[Dict[str, Any]] = []

    if canonical:
        # canonical 기준으로 한 번씩만 분류 (closed > open 우선)
        for norm, display in canonical.items():
            if norm in llm_closed:
                info = llm_closed[norm]
                closed_columns.append({
                    "name": display,
                    "reason": info["reason"],
                    "reason_codes": info["reason_codes"],
                })
            else:
                # 명시적 open 판정이거나 LLM이 언급 안 한 컬럼 → 개방 가능
                open_columns.append(display)
        total_count = len(canonical)
    else:
        # 추출 실패 fallback — LLM 응답만으로 분류
        for item in col_judgments:
            name = str(item.get("name", "")).strip()
            if not name:
                continue
            if item.get("openable", True):
                open_columns.append(name)
            else:
                norm = _normalize_col_name(name)
                info = llm_closed.get(norm, {"reason": "", "reason_codes": []})
                closed_columns.append({
                    "name": name,
                    "reason": info["reason"],
                    "reason_codes": info["reason_codes"],
                })
        total_count = len(open_columns) + len(closed_columns)

    open_count = len(open_columns)
    bucket = classify_bucket(open_count, total_count)

    return {
        "bucket": bucket,
        "open_columns": open_columns,
        "closed_columns": closed_columns,
        "open_count": open_count,
        "total_count": total_count,
        "major_area": str(result.get("major_area", "") or "").strip(),
        "sub_area": str(result.get("sub_area", "") or "").strip(),
        "dataset_name": str(result.get("dataset_name", "") or "").strip(),
    }


def run_stage1(
    tables: Dict[str, SimpleTable],
    reasons: List[str],  # kept for API compat, not used
    api_key: Optional[str],
    base_url: str,
    model: str,
    sleep: float,
    mock: bool,
    progress_callback: Optional[Any] = None,  # Callable[[int, int, int], None]
) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, str]]]:
    stage1: Dict[str, Dict[str, Any]] = {}
    failed: List[Dict[str, str]] = []

    llm_items: List[Tuple[str, SimpleTable]] = []
    for key, table in tables.items():
        display_name = table.table_kr or table.table_en or key
        if is_system_table(display_name):
            cols = table.columns or [display_name]
            closed_per_col = [
                {
                    "name": c,
                    "reason": "시스템 테이블",
                    "reason_codes": [9],
                }
                for c in cols
            ]
            stage1[key] = {
                "bucket": "불가능",
                "open_columns": [],
                "closed_columns": closed_per_col,
                "open_count": 0,
                "total_count": len(cols),
            }
        else:
            llm_items.append((key, table))

    if not llm_items:
        if progress_callback:
            progress_callback(0, 0, 0)
        return stage1, failed

    total_count = len(llm_items)

    if mock:
        for i, (key, table) in enumerate(llm_items):
            open_cols = table.columns
            table_display = table.table_kr or table.table_en or key
            stage1[key] = {
                "bucket": classify_bucket(len(open_cols), len(open_cols)),
                "open_columns": open_cols,
                "closed_columns": [],
                "open_count": len(open_cols),
                "total_count": len(open_cols),
                "major_area": "일반공공행정",
                "sub_area": "모의분류",
                "dataset_name": f"{table_display} 데이터셋",
            }
            if progress_callback:
                progress_callback(i + 1, total_count, 0)
        return stage1, failed

    if not api_key:
        raise RuntimeError("Gemini API 키가 없습니다. GEMINI_API_KEY를 설정하세요.")

    concurrency = max(1, DEFAULT_CONCURRENCY)

    def _run_one(key: str, table: SimpleTable) -> Tuple[str, Dict[str, Any]]:
        prompt = build_stage1_prompt(table)
        result = call_gemini(prompt, api_key, model, base_url)
        return key, _parse_column_result(table, result)

    done_count = 0
    if progress_callback:
        progress_callback(0, total_count, 0)
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {executor.submit(_run_one, key, table): key for key, table in llm_items}
        for fut in as_completed(futures):
            key = futures[fut]
            try:
                _, payload = fut.result()
                stage1[key] = payload
            except Exception as exc:  # noqa: BLE001
                logger.exception("stage1 LLM call failed for key=%s", key)
                failed.append({"key": key, "error": f"{type(exc).__name__}: {exc}"})
            done_count += 1
            if progress_callback:
                progress_callback(done_count, total_count, len(failed))

    if failed and not any(stage1.get(k, {}).get("bucket") in ("전체개방", "부분개방", "불가능") for k, _ in llm_items if k in stage1):
        raise RuntimeError(
            f"LLM 분석이 모두 실패했습니다 ({len(failed)}건). 첫 오류: {failed[0]['error']}"
        )

    return stage1, failed
