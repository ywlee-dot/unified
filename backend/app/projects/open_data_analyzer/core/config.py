"""
프로젝트 전역 설정 상수

모든 파일에서 사용되는 하드코딩된 값들을 중앙에서 관리합니다.
환경변수로 오버라이드 가능합니다.
"""

import os
import re
from typing import List, Tuple

# ============================================================================
# Gemini API 설정
# ============================================================================

GEMINI_BASE_URL = (
    os.environ.get("GEMINI_BASE_URL")
    or "https://generativelanguage.googleapis.com/v1beta"
)

GEMINI_MODEL = os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"

GEMINI_TIMEOUT_SECONDS = float(os.environ.get("GEMINI_TIMEOUT", "180"))

GEMINI_MAX_RETRIES = int(os.environ.get("GEMINI_RETRIES", "2"))

GEMINI_RETRY_BACKOFF = float(os.environ.get("GEMINI_RETRY_BACKOFF", "2.0"))

# ============================================================================
# 배치 처리 설정
# ============================================================================

DEFAULT_BATCH_SIZE = int(os.environ.get("GEMINI_MULTI_TABLE_CHUNK", "8"))

# 배치·단건 호출을 동시에 몇 개까지 병렬로 실행할지
# 3 정도가 안전한 초기값. Gemini rate limit 여유 있으면 5~8로 상향 가능.
DEFAULT_CONCURRENCY = int(os.environ.get("GEMINI_CONCURRENCY", "3"))

PROMPT_LOG_MAX_CHARS = int(os.environ.get("GEMINI_PROMPT_LOG_MAX_CHARS", "12000"))

# ============================================================================
# 시스템 테이블 필터링 패턴
# ============================================================================

SYSTEM_PATTERNS: List[re.Pattern] = [
    re.compile(r"_TEMP|_TMP|_TEST", re.IGNORECASE),
    re.compile(r"_BAK|_BACKUP", re.IGNORECASE),
    re.compile(r"_LOG", re.IGNORECASE),
    re.compile(r"_VIEW|_VW", re.IGNORECASE),
]

SYSTEM_PREFIXES: Tuple[str, ...] = ("SYS_", "SYS$", "DBA_", "ALL_")

SYSTEM_KOREAN_KEYWORDS: List[str] = [
    "임시",
    "백업",
    "로그",
    "뷰",
]

# ============================================================================
# 출력 시트명 설정
# ============================================================================

SHEET_NAMES = {
    "stage1": "1단계_개방가능여부",
    "stage2": "2단계_주제영역",
    "stage3": "3단계_개방데이터셋",
    "stage4": "4단계_조인검토",
    "stage5": "5단계_최종점검",
}

# ============================================================================
# 프롬프트 생성 설정
# ============================================================================

COLUMN_PREVIEW_LIMITS = {
    "stage1": 60,
    "stage2": 40,
    "stage3": 80,
    "stage4": 50,
    "stage5": 60,
}
