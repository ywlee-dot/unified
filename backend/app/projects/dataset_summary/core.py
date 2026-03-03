import json
import os
import time
from io import BytesIO, StringIO
from pathlib import Path
from typing import Any, Dict, List

import csv
import requests
from openpyxl import load_workbook

DEFAULT_BASE_URL = os.environ.get(
    "OPENAI_BASE_URL",
    os.environ.get("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"),
)
DEFAULT_MODEL = os.environ.get("OPENAI_MODEL", os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
DEFAULT_PROMPT_PATH = os.environ.get("PROMPT_PATH", str(Path(__file__).parent / "prompt.txt"))

_PROMPT_CACHE = None

def _fill_forward(headers: List[str]) -> List[str]:
    filled = []
    last = ""
    for value in headers:
        if value:
            last = value
            filled.append(value)
        else:
            filled.append(last)
    return filled


def _merge_headers(row1: tuple, row2: tuple) -> List[str]:
    headers = []
    row1_list = [str(h).strip() if h is not None else "" for h in row1]
    row2_list = [str(h).strip() if h is not None else "" for h in row2]
    row1_list = _fill_forward(row1_list)
    for i in range(max(len(row1_list), len(row2_list))):
        h1 = row1_list[i] if i < len(row1_list) else ""
        h2 = row2_list[i] if i < len(row2_list) else ""
        if h2 and h1:
            headers.append(f"{h1} / {h2}")
        elif h2:
            headers.append(h2)
        else:
            headers.append(h1)
    return headers


def _collapse_separators(text: str, sep: str) -> str:
    double = f"{sep}{sep}"
    while double in text:
        text = text.replace(double, sep)
    return text


def _header_score(row: tuple) -> int:
    tokens = ("번호", "개방", "데이터셋", "정보시스템", "테이블", "컬럼", "영문", "한글", "비고", "개방시기")
    if not row:
        return 0
    text_parts = []
    for cell in row:
        if cell is None:
            continue
        text = str(cell).strip()
        if text:
            text_parts.append(text)
    merged = " ".join(text_parts)
    return sum(1 for token in tokens if token in merged)


def _row_stats(row: tuple) -> tuple[int, float]:
    filled = 0
    numeric = 0
    for cell in row:
        if cell is None or cell == "":
            continue
        filled += 1
        text = str(cell).strip()
        if text and all(ch.isdigit() or ch in ".-" for ch in text):
            numeric += 1
    numeric_ratio = numeric / filled if filled else 0.0
    return filled, numeric_ratio


def _cell_length_stats(row: tuple) -> tuple[int, int, int]:
    lengths = []
    for cell in row:
        if cell is None:
            continue
        text = str(cell).strip()
        if not text:
            continue
        lengths.append(len(text))
    if not lengths:
        return 0, 0, 0
    short = sum(1 for length in lengths if length <= 12)
    long = sum(1 for length in lengths if length >= 30)
    return short, long, max(lengths)


def _header_row_score(row: tuple) -> int:
    token_score = _header_score(row)
    filled, numeric_ratio = _row_stats(row)
    if filled <= 1:
        return -1
    short, long, max_len = _cell_length_stats(row)
    score = token_score * 3 + filled + short * 2 + int((1 - numeric_ratio) * 2) - long * 4
    if max_len >= 40:
        score -= 6
    if short < max(2, filled // 3):
        score -= 3
    return score


def _header_pair_score(row0: tuple, row1: tuple) -> int:
    merged = _merge_headers(row0, row1)
    token_score = _header_score(tuple(merged))
    filled, numeric_ratio = _row_stats(tuple(merged))
    if filled <= 2:
        return -1
    short, long, max_len = _cell_length_stats(tuple(merged))
    row0_blank = sum(1 for cell in row0 if cell is None or str(cell).strip() == "")
    row1_filled = sum(1 for cell in row1 if cell is not None and str(cell).strip() != "")
    blank_bonus = 2 if row0_blank >= row1_filled and row1_filled > 0 else 0
    score = (
        token_score * 3
        + filled
        + short * 2
        + int((1 - numeric_ratio) * 2)
        + blank_bonus
        - long * 4
    )
    if max_len >= 40:
        score -= 6
    if short < max(2, filled // 3):
        score -= 3
    return score


def _detect_header_candidate(rows: List[tuple], max_scan: int = 30) -> tuple[int, int]:
    best_idx = 0
    best_rows = 1
    best_score = -1
    scan = min(max_scan, len(rows))
    for idx in range(scan):
        row = rows[idx]
        score = _header_row_score(row)
        if score > best_score:
            best_score = score
            best_idx = idx
            best_rows = 1
        if idx + 1 < scan:
            pair_score = _header_pair_score(row, rows[idx + 1])
            if pair_score > best_score:
                best_score = pair_score
                best_idx = idx
                best_rows = 2
    return best_idx, best_rows


def _col_letters_to_index(letters: str) -> int:
    index = 0
    for char in letters:
        if not char.isalpha():
            break
        index = index * 26 + (ord(char.upper()) - ord("A") + 1)
    return index


def _parse_cell_ref(cell: str) -> tuple[int, int]:
    if not cell:
        raise ValueError("Empty cell reference.")
    letters = "".join(ch for ch in cell if ch.isalpha())
    numbers = "".join(ch for ch in cell if ch.isdigit())
    if not letters or not numbers:
        raise ValueError(f"Invalid cell reference: {cell}")
    col = _col_letters_to_index(letters)
    row = int(numbers)
    return row, col


def _apply_manual_header(
    rows: List[tuple], header_range: tuple[str, str]
) -> tuple[List[str], int, int, int]:
    start_cell, end_cell = header_range
    start_row, start_col = _parse_cell_ref(start_cell)
    end_row, end_col = _parse_cell_ref(end_cell)
    if end_row < start_row or end_col < start_col:
        raise ValueError("Header range is invalid.")

    header_rows = rows[start_row - 1 : end_row]
    max_cols = end_col - start_col + 1
    header_slice = [row[start_col - 1 : end_col] for row in header_rows]
    headers = [str(h).strip() if h is not None else "" for h in header_slice[0]]
    data_start = end_row
    if len(header_slice) > 1:
        headers = _merge_headers(tuple(header_slice[0]), tuple(header_slice[1]))
    headers = _fill_forward(headers)
    if all(h == "" for h in headers):
        headers = [f"Column{i+1}" for i in range(len(headers))]
    return headers, data_start, max_cols, start_col


def _is_header_like(row: tuple) -> bool:
    score = _header_score(row)
    filled, numeric_ratio = _row_stats(row)
    return score >= 2 and filled > 0 and numeric_ratio < 0.5


def _is_data_like(row: tuple) -> bool:
    filled, numeric_ratio = _row_stats(row)
    if filled == 0:
        return False
    short, long, max_len = _cell_length_stats(row)
    long_ratio = long / filled if filled else 0.0
    short_ratio = short / filled if filled else 0.0
    return (long_ratio >= 0.3 and max_len >= 40) or (short_ratio < 0.2 and numeric_ratio < 0.5)


def _detect_header_span(rows: List[tuple], header_idx: int, max_cols: int) -> tuple[int, int]:
    def find_span(row: tuple) -> tuple[int | None, int | None]:
        start = None
        end = None
        for i, cell in enumerate(row[:max_cols]):
            if cell is None or str(cell).strip() == "":
                continue
            if start is None:
                start = i + 1
            end = i + 1
        return start, end

    row0 = rows[header_idx]
    row1 = rows[header_idx + 1] if header_idx + 1 < len(rows) else None
    start0, end0 = find_span(row0)
    if row1 is not None:
        start1, end1 = find_span(row1)
    else:
        start1, end1 = None, None

    start_candidates = [s for s in (start0, start1) if s is not None]
    end_candidates = [e for e in (end0, end1) if e is not None]
    if not start_candidates or not end_candidates:
        return 1, max_cols

    return min(start_candidates), max(end_candidates)


def _detect_max_cols(rows: List[tuple], max_scan: int = 30, min_cols: int = 7) -> int:
    max_col = 0
    for row in rows[:max_scan]:
        last = 0
        for idx in range(len(row), 0, -1):
            cell = row[idx - 1]
            if cell is None or str(cell).strip() == "":
                continue
            last = idx
            break
        if last > max_col:
            max_col = last
    if max_col < min_cols:
        return min_cols
    return max_col


def _rows_to_dicts(
    rows: List[tuple],
    header_range: tuple[str, str] | None = None,
    return_debug: bool = False,
) -> List[Dict[str, Any]] | tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if not rows:
        return []

    max_cols = _detect_max_cols(rows)
    debug_info: Dict[str, Any] = {}
    data_start_col = 1
    if header_range:
        headers, data_start, max_cols, data_start_col = _apply_manual_header(rows, header_range)
        debug_info["header_mode"] = "manual"
    else:
        header_idx, header_rows = _detect_header_candidate(rows)
        if header_rows == 2 and header_idx + 1 < len(rows):
            row0_filled, _ = _row_stats(rows[header_idx])
            row1_filled, _ = _row_stats(rows[header_idx + 1])
            row0_score = _header_score(rows[header_idx])
            row1_score = _header_score(rows[header_idx + 1])
            if (
                row0_score == 0
                and row1_score >= 2
                and row1_filled >= 3
                and row0_filled <= max(2, row1_filled // 2)
            ):
                header_idx += 1
                header_rows = 1
                debug_info["header_adjusted"] = "skip_low_score_prefix"
        if header_rows == 2 and header_idx + 1 < len(rows):
            row1 = rows[header_idx + 1]
            row1_score = _header_score(row1)
            if not _is_header_like(row1) or _is_data_like(row1) or row1_score < 2:
                header_rows = 1
                debug_info["header_adjusted"] = "force_single_header"
        if header_rows == 2 and header_idx + 1 < len(rows):
            merged = _merge_headers(rows[header_idx], rows[header_idx + 1])
            header_score = _header_score(tuple(merged))
        else:
            header_score = _header_score(rows[header_idx])
        debug_info["header_mode"] = "auto"
        debug_info["max_cols"] = max_cols
        debug_info["header_candidates"] = [
            {"index": i, "score": _header_row_score(r)} for i, r in enumerate(rows[:5])
        ]
        debug_info["header_selected"] = {
            "index": header_idx,
            "rows": header_rows,
            "score": header_score,
        }
        data_start_col, data_end_col = _detect_header_span(rows, header_idx, max_cols)
        if header_rows == 2 and header_idx + 1 < len(rows):
            row0 = rows[header_idx][data_start_col - 1 : data_end_col]
            row1 = rows[header_idx + 1][data_start_col - 1 : data_end_col]
            headers = _merge_headers(tuple(row0), tuple(row1))
            data_start = header_idx + 2
        else:
            headers = [
                str(h).strip() if h is not None else ""
                for h in rows[header_idx][data_start_col - 1 : data_end_col]
            ]
            data_start = header_idx + 1
        max_cols = data_end_col - data_start_col + 1
        headers = _fill_forward(headers)
        debug_info["data_start"] = data_start
        debug_info["data_start_col"] = data_start_col
        debug_info["data_end_col"] = data_end_col
        debug_info["headers_preview"] = headers[:20]
        debug_info["header_row_preview"] = [
            str(h).strip() if h is not None else "" for h in rows[header_idx][:20]
        ]
        if header_rows == 2 and header_idx + 1 < len(rows):
            debug_info["header_row_next_preview"] = [
                str(h).strip() if h is not None else "" for h in rows[header_idx + 1][:20]
            ]
        if all(h == "" for h in headers):
            headers = [f"Column{i+1}" for i in range(len(headers))]

    carry_headers = {
        "번호",
        "개방 데이터셋명",
        "정보시스템명",
        "테이블명(한글)",
        "테이블명(영문)",
    }
    last_seen: Dict[str, Any] = {}
    results: List[Dict[str, Any]] = []
    for row in rows[data_start:]:
        row_dict: Dict[str, Any] = {}
        row_slice = row[data_start_col - 1 : data_start_col - 1 + max_cols]
        for i, value in enumerate(row_slice):
            key = headers[i] if i < len(headers) else f"Column{i+1}"
            if key == "":
                key = f"Column{i+1}"
            if (value is None or value == "") and key in carry_headers and key in last_seen:
                value = last_seen[key]
            if value is not None and value != "":
                row_dict[key] = value
                if key in carry_headers:
                    last_seen[key] = value
        if row_dict:
            raw_parts = ["" if v is None else str(v) for v in row_slice]
            for i, key in enumerate(headers):
                if i >= max_cols:
                    break
                if key in carry_headers and raw_parts[i] == "" and key in last_seen:
                    raw_parts[i] = str(last_seen[key])
            row_dict["__raw_values__"] = raw_parts
            raw_joined = " | ".join(raw_parts)
            raw_joined = _collapse_separators(raw_joined, " | ")
            row_dict["__raw__"] = raw_joined.strip(" | ")
            results.append(row_dict)

    if return_debug:
        return results, debug_info
    return results


def read_rows_from_bytes(
    xlsx_bytes: bytes,
    sheet_name: str | None,
    header_range: tuple[str, str] | None = None,
    return_debug: bool = False,
) -> List[Dict[str, Any]] | tuple[List[Dict[str, Any]], Dict[str, Any]]:
    workbook = load_workbook(BytesIO(xlsx_bytes), read_only=True, data_only=True)
    if sheet_name:
        if sheet_name not in workbook.sheetnames:
            raise ValueError(f"Sheet not found: {sheet_name}")
        sheet = workbook[sheet_name]
    else:
        sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    return _rows_to_dicts(rows, header_range=header_range, return_debug=return_debug)


def read_csv_rows_from_bytes(
    csv_bytes: bytes,
    header_range: tuple[str, str] | None = None,
    return_debug: bool = False,
) -> List[Dict[str, Any]] | tuple[List[Dict[str, Any]], Dict[str, Any]]:
    text = None
    for encoding in ("utf-8-sig", "utf-8", "cp949"):
        try:
            text = csv_bytes.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError("Unable to decode CSV. Try UTF-8 or CP949.")

    reader = csv.reader(StringIO(text))
    rows = list(reader)
    tuple_rows = [tuple(r) for r in rows]
    return _rows_to_dicts(tuple_rows, header_range=header_range, return_debug=return_debug)


def _normalize_group_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _coerce_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    text = str(value).strip()
    if text.isdigit():
        return int(text)
    try:
        as_float = float(text)
    except ValueError:
        return None
    if as_float.is_integer():
        return int(as_float)
    return None


def _find_numeric_sequence_key(rows: List[Dict[str, Any]], max_scan: int = 30) -> str | None:
    if not rows:
        return None
    sample = rows[:max_scan]
    keys = [key for key in sample[0].keys() if not key.startswith("__")]
    best_key = None
    best_score = 0.0
    for key in keys:
        seq = []
        for row in sample:
            num = _coerce_int(row.get(key))
            if num is None:
                continue
            seq.append(num)
        if len(seq) < 4:
            continue
        if len(seq) / len(sample) < 0.6:
            continue
        increments = sum(1 for prev, curr in zip(seq, seq[1:]) if curr == prev + 1)
        score = increments / (len(seq) - 1)
        if score >= 0.7 and score > best_score:
            best_score = score
            best_key = key
    return best_key


def group_rows(
    rows: List[Dict[str, Any]],
    group_key: str | None,
) -> List[Dict[str, Any]]:
    groups: List[Dict[str, Any]] = []
    current_key = None
    current_rows: List[Dict[str, Any]] = []

    for row in rows:
        if group_key:
            key_value = row.get(group_key)
        else:
            key_value = None
        if key_value is None or key_value == "":
            raw_values = row.get("__raw_values__", [])
            if raw_values:
                raw_key = raw_values[0]
                if raw_key is not None and str(raw_key).strip() != "":
                    key_value = raw_key
        key_value = _normalize_group_value(key_value)
        if key_value == "":
            if current_rows:
                current_rows.append(row)
            continue

        if current_key is None:
            current_key = key_value
            current_rows = [row]
            continue

        if key_value != current_key:
            groups.append({"group_key": current_key, "rows": current_rows})
            current_key = key_value
            current_rows = [row]
        else:
            current_rows.append(row)

    if current_rows:
        groups.append({"group_key": current_key, "rows": current_rows})

    return groups


def _pick_default_group_key(rows: List[Dict[str, Any]]) -> str | None:
    if not rows:
        return None
    candidates = ["번호"]
    first_row = rows[0]
    for key in candidates:
        if key in first_row:
            return key
    numeric_key = _find_numeric_sequence_key(rows)
    if numeric_key:
        return numeric_key
    candidates = ["데이터셋명", "개방 데이터셋명"]
    for key in candidates:
        if key in first_row:
            return key
    for key in first_row.keys():
        if key.startswith("__"):
            continue
        if str(key).strip() == "":
            continue
        return key
    return None


def _is_column_key(key: str) -> bool:
    return "컬럼명" in key or "column" in key.lower()


def _pick_column_values(row: Dict[str, Any]) -> tuple[str | None, str | None]:
    col_kr = None
    col_en = None
    for key, value in row.items():
        if key.startswith("__"):
            continue
        if value is None or value == "":
            continue
        lower_key = key.lower()
        if "컬럼명" in key and ("한글" in key or "국문" in key):
            col_kr = str(value)
        elif "컬럼명" in key and ("영문" in key or "영어" in key):
            col_en = str(value)
        elif "column" in lower_key and "name" in lower_key and "kr" in lower_key:
            col_kr = str(value)
        elif "column" in lower_key and "name" in lower_key and "en" in lower_key:
            col_en = str(value)
    return col_kr, col_en


def _find_value(row: Dict[str, Any], tokens: List[str]) -> str | None:
    for key, value in row.items():
        if key.startswith("__") or value is None or value == "":
            continue
        if all(token in key for token in tokens):
            return str(value)
    return None


def _extract_common_info(group: Dict[str, Any]) -> Dict[str, str]:
    fields = [
        ("번호", ["번호"]),
        ("개방 데이터셋명", ["개방", "데이터셋", "명"]),
        ("정보시스템명", ["정보시스템"]),
        ("테이블명(한글)", ["테이블", "한글"]),
        ("테이블명(영문)", ["테이블", "영문"]),
    ]
    for row in group["rows"]:
        info = {}
        for label, tokens in fields:
            value = _find_value(row, tokens)
            if value:
                info[label] = value
        if info:
            return info
    return {}


def build_common_columns(group: Dict[str, Any]) -> tuple[Dict[str, str], List[str]]:
    columns = []
    for row in group["rows"]:
        col_kr, col_en = _pick_column_values(row)
        if col_kr or col_en:
            if col_kr and col_en:
                columns.append(f"{col_kr} ({col_en})")
            elif col_kr:
                columns.append(str(col_kr))
            else:
                columns.append(str(col_en))

    common_info = _extract_common_info(group)
    return common_info, columns


def build_row_text(group: Dict[str, Any]) -> str:
    common_info, columns = build_common_columns(group)
    payload = {
        "common": common_info,
        "columns": columns,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def build_raw_rows_text(group: Dict[str, Any]) -> str:
    lines = []
    for row in group["rows"]:
        raw = row.get("__raw__")
        if raw:
            lines.append(str(raw))
    return "\n".join(lines)


def load_prompt_template() -> str:
    global _PROMPT_CACHE
    if _PROMPT_CACHE is not None:
        return _PROMPT_CACHE
    try:
        with open(DEFAULT_PROMPT_PATH, "r", encoding="utf-8") as f:
            _PROMPT_CACHE = f.read().strip()
            return _PROMPT_CACHE
    except FileNotFoundError:
        _PROMPT_CACHE = (
            "You are given grouped rows from a dataset definition sheet.\n"
            "Generate exactly 5 concise keywords that best represent the dataset, "
            "and a 200-character description. Use Korean language. "
            "Return only JSON with keys 'keywords' (array of 5 strings) "
            "and 'description' (string).\n"
            "Row: {row_text}\n"
        )
        return _PROMPT_CACHE


def build_prompt(group: Dict[str, Any], org_name: str | None = None) -> str:
    row_text = build_row_text(group)
    common_info, _ = build_common_columns(group)
    dataset_name = common_info.get("개방 데이터셋명", "")
    template = load_prompt_template()
    prompt = template.replace("{row_text}", row_text)
    prompt = prompt.replace("{기관명}", org_name or "")
    prompt = prompt.replace("{개방 데이터셋명}", dataset_name)
    return prompt


def parse_json_content(content: str) -> Dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(content[start : end + 1])


def _is_gemini_base_url(base_url: str) -> bool:
    return "generativelanguage.googleapis.com" in base_url


def call_openai(prompt: str, base_url: str, api_key: str, model: str) -> Dict[str, Any]:
    if _is_gemini_base_url(base_url):
        url = f"{base_url.rstrip('/')}/models/{model}:generateContent"
        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": prompt}]},
            ]
        }
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        print(f"[gemini] model={model}")
        usage = data.get("usageMetadata")
        if usage:
            print(f"[gemini] usageMetadata={json.dumps(usage, ensure_ascii=False)}")
        content = data["candidates"][0]["content"]["parts"][0]["text"]
        return parse_json_content(content)

    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": "You are a precise assistant."},
            {"role": "user", "content": prompt},
        ],
    }
    response = requests.post(url, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return parse_json_content(content)


def generate_summaries(
    rows: List[Dict[str, Any]],
    group_key: str | None,
    base_url: str,
    api_key: str,
    model: str,
    include_rows: bool = False,
    sleep_seconds: float = 0.0,
    include_prompt: bool = False,
    org_name: str | None = None,
    header_debug: Dict[str, Any] | None = None,
) -> List[Dict[str, Any]]:
    if not rows:
        return []

    if group_key is None:
        group_key = _pick_default_group_key(rows)
    groups = group_rows(rows, group_key)
    results: List[Dict[str, Any]] = []
    for idx, group in enumerate(groups, start=1):
        prompt = build_prompt(group, org_name=org_name)
        result = call_openai(prompt, base_url, api_key, model)
        common_info, columns = build_common_columns(group)
        prompt_text = build_prompt(group, org_name=org_name) if include_prompt else None
        item = {
            "row_index": idx,
            "group_key": group.get("group_key"),
            "common": common_info,
            "columns": columns,
            "keywords": result.get("keywords", []),
            "description": result.get("description", ""),
        }
        if prompt_text is not None:
            item["prompt"] = prompt_text
        if header_debug is not None:
            item["debug"] = header_debug
        if include_rows:
            item["rows"] = group.get("rows")
        results.append(item)
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)
    return results


def generate_mock_summaries(
    rows: List[Dict[str, Any]],
    group_key: str | None,
    include_rows: bool = False,
    include_prompt: bool = False,
    org_name: str | None = None,
    header_debug: Dict[str, Any] | None = None,
) -> List[Dict[str, Any]]:
    if not rows:
        return []

    if group_key is None:
        group_key = _pick_default_group_key(rows)
    groups = group_rows(rows, group_key)
    results: List[Dict[str, Any]] = []
    for idx, group in enumerate(groups, start=1):
        keyword_set = []
        for row in group["rows"]:
            for key, value in row.items():
                if key.startswith("__"):
                    continue
                if value is None or value == "":
                    continue
                if key not in keyword_set and len(keyword_set) < 8:
                    keyword_set.append(str(key))
        description = build_row_text(group)
        common_info, columns = build_common_columns(group)
        prompt_text = build_prompt(group, org_name=org_name) if include_prompt else None
        item = {
            "row_index": idx,
            "group_key": group.get("group_key"),
            "common": common_info,
            "columns": columns,
            "keywords": keyword_set,
            "description": description,
        }
        if prompt_text is not None:
            item["prompt"] = prompt_text
        if header_debug is not None:
            item["debug"] = header_debug
        if include_rows:
            item["rows"] = group.get("rows")
        results.append(item)
    return results
