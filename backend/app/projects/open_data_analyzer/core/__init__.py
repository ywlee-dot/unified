"""Core processing modules for Open Data Analyzer."""

from .api_client import call_gemini, parse_json_content
from .config import (
    GEMINI_BASE_URL,
    GEMINI_MODEL,
    DEFAULT_BATCH_SIZE,
    SYSTEM_PATTERNS,
    SYSTEM_PREFIXES,
    SYSTEM_KOREAN_KEYWORDS,
    SHEET_NAMES,
    COLUMN_PREVIEW_LIMITS,
)
from .file_utils import read_sheet_rows, find_col, normalize_spaces
from .excel_loader import find_stage_sheet, load_stage_sheet
from .stage1 import run_stage1, extract_tables_from_excel, SimpleTable, is_system_table, normalize_table_key, calculate_similarity, find_matching_table, merge_table_data, calculate_confidence
from .stage2 import run_stage2
from .stage3 import run_stage3
from .stage4 import run_stage4
from .stage5 import run_stage5

__all__ = [
    "call_gemini",
    "parse_json_content",
    "GEMINI_BASE_URL",
    "GEMINI_MODEL",
    "DEFAULT_BATCH_SIZE",
    "SYSTEM_PATTERNS",
    "SYSTEM_PREFIXES",
    "SYSTEM_KOREAN_KEYWORDS",
    "SHEET_NAMES",
    "COLUMN_PREVIEW_LIMITS",
    "read_sheet_rows",
    "find_col",
    "normalize_spaces",
    "find_stage_sheet",
    "load_stage_sheet",
    "run_stage1",
    "extract_tables_from_excel",
    "SimpleTable",
    "is_system_table",
    "normalize_table_key",
    "calculate_similarity",
    "find_matching_table",
    "merge_table_data",
    "calculate_confidence",
    "run_stage2",
    "run_stage3",
    "run_stage4",
    "run_stage5",
]
