"""Prompt builder for evaluation using Gemini."""

import logging

logger = logging.getLogger(__name__)


class PromptBuilder:
    """Build prompts for Gemini-based evaluation."""

    def build_system_prompt(self) -> str:
        return """당신은 공공 데이터 평가 전문가입니다.

주어진 평가 기준을 바탕으로 데이터를 분석하고, 구체적이고 실행 가능한 개선사항을 제시합니다.

**평가 원칙**:
1. 정확성: 데이터가 사실과 일치하는지 확인
2. 완전성: 필수 정보가 모두 포함되어 있는지 확인
3. 일관성: 데이터 형식과 구조가 일관적인지 확인
4. 적시성: 데이터가 최신 상태인지 확인

**중요**: 반드시 다음 JSON 스키마를 정확히 따라 응답해야 합니다.
"""

    def build_evaluation_prompt(
        self, input_data: str, context: str, category: str | None = None
    ) -> str:
        if not input_data or not input_data.strip():
            raise ValueError("input_data cannot be empty")

        if not context or not context.strip():
            raise ValueError("context cannot be empty")

        system_prompt = self.build_system_prompt()

        category_instruction = ""
        if category:
            category_names = {
                "quality": "데이터 품질",
                "openness": "개방·활용",
                "analysis": "분석·활용",
                "sharing": "공유",
                "management": "관리체계",
            }
            category_ko = category_names.get(category, category)

            category_instruction = f"""
**중요 지침**:
이 평가는 **{category_ko} 영역**에 대한 것입니다.
아래 평가 기준 중 {category_ko}과 관련된 기준만 적용하세요.
다른 영역의 기준은 무시하세요:
- 󰊱: 개방·활용
- 󰊲: 품질
- 󰊳: 분석·활용
- 󰊴: 공유
- 󰊵: 관리체계

{category_ko} 관련 기준만 사용하여 평가하고 점수를 매기세요.
"""

        evaluation_prompt = f"""{system_prompt}

**JSON 스키마** (반드시 이 구조를 따르세요):
{{
    "summary": "string (전체 평가 요약 2-3 문장)",
    "issues": ["string (발견된 문제점)"],
    "improvements": [
        {{
            "category": "string (카테고리)",
            "issue": "string (구체적인 문제점)",
            "recommendation": "string (실행 가능한 개선사항)",
            "priority": "string (critical|high|medium|low)"
        }}
    ],
    "score": "integer (0-100)"
}}

**예시 응답**:
{{
    "summary": "필수 정보 중 일부가 누락되어 있습니다. 연락처와 홈페이지 정보가 없으며, 주소가 불완전합니다.",
    "issues": ["연락처 정보 누락", "홈페이지 정보 누락", "주소가 '서울시'만 있어 상세 주소 부족"],
    "improvements": [
        {{
            "category": "데이터 완전성",
            "issue": "연락처 정보 누락",
            "recommendation": "대표 전화번호 및 이메일 주소를 추가하세요",
            "priority": "high"
        }}
    ],
    "score": 45
}}

---
{category_instruction}
**평가 기준**:
{context}

**입력 데이터**:
{input_data}

---

위 평가 기준에 따라 입력 데이터를 분석하고, 지정된 JSON 스키마로 평가 결과를 출력하세요.
순수 JSON 객체만 반환하고, 마크다운 코드 블록이나 추가 설명은 포함하지 마세요.
"""

        return evaluation_prompt
