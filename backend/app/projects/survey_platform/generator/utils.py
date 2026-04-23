# -*- coding: utf-8 -*-
import uuid
from datetime import datetime
from typing import Dict, Any, List, Union

def replace_placeholders(text: str, replacements: Dict[str, Any]) -> str:
    """
    텍스트 내의 플레이스홀더를 치환합니다.
    예: "[INSTITUTION_NAME] 설문" -> "한국농수산식품유통공사 설문"
    """
    if not isinstance(text, str):
        return text
        
    result = text
    for placeholder, value in replacements.items():
        if isinstance(value, str):
            result = result.replace(placeholder, value)
    return result

def generate_unique_id(prefix: str = "") -> str:
    """
    8자리의 고유 ID를 생성합니다.
    """
    unique_id = str(uuid.uuid4())[:8]
    if prefix:
        return f"{prefix}_{unique_id}"
    return unique_id

def get_current_timestamp() -> str:
    """
    ISO 8601 형식의 현재 타임스탬프를 반환합니다.
    """
    return datetime.now().isoformat()

def validate_survey_json(survey: Dict[str, Any]) -> bool:
    """
    설문 JSON의 필수 필드가 포함되어 있는지 검증합니다.
    """
    required_fields = ["survey_metadata", "questions", "logic_rules"]
    return all(field in survey for field in required_fields)

def list_to_comma_string(items: List[Any]) -> str:
    """
    리스트를 콤마로 구분된 문자열로 변환합니다.
    """
    return ",".join(map(str, items))

def comma_string_to_list(csv_str: str) -> List[str]:
    """
    콤마로 구분된 문자열을 리스트로 변환합니다.
    """
    if not csv_str:
        return []
    return [item.strip() for item in csv_str.split(",") if item.strip()]
