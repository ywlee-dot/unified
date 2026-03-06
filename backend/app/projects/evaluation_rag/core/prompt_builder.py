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
                "management_pub": "관리체계(공공데이터)",
                "management_dba": "관리체계(데이터기반행정)",
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

    def build_item_evaluation_prompt(
        self,
        input_data: str,
        items: list[dict],  # each has: item_id, item_name, category, scoring_criteria, max_score
        category_ko: str | None = None,
    ) -> str:
        """Build a prompt for item-level evaluation.

        Evaluates input_data against each specified item independently, scoring 0-10 per item.
        Suggested temperature for the caller: 0.1 (deterministic scoring).

        Args:
            input_data: The raw data text to evaluate.
            items: List of evaluation items. Each dict must have:
                - item_id (str): unique identifier, e.g. "quality_01"
                - item_name (str): human-readable name
                - category (str): category key
                - scoring_criteria (str): verbatim scoring rubric text
                - max_score (int): maximum score for this item
            category_ko: Optional Korean category label for focus instruction.

        Returns:
            Fully assembled prompt string ready to send to Gemini.

        Raises:
            ValueError: If input_data or items is empty.
        """
        if not input_data or not input_data.strip():
            raise ValueError("input_data cannot be empty")

        if not items:
            raise ValueError("items cannot be empty")

        category_instruction = ""
        if category_ko:
            category_instruction = f"""
**평가 영역**: 이 평가는 **{category_ko}** 영역에 초점을 맞춥니다.
각 항목을 해당 영역의 관점에서 평가하세요.
"""

        items_section_parts = []
        for i, item in enumerate(items, start=1):
            item_id = item["item_id"]
            item_name = item["item_name"]
            max_score = item["max_score"]
            scoring_criteria = item["scoring_criteria"]
            # Truncate long criteria to keep prompt manageable
            if len(scoring_criteria) > 2000:
                scoring_criteria = scoring_criteria[:2000] + "\n... (이하 생략)"
            items_section_parts.append(
                f"### 항목 {i}: {item_name} (item_id: {item_id})\n"
                f"만점: {max_score}점\n"
                f"채점 기준:\n{scoring_criteria}"
            )

        items_section = "\n\n".join(items_section_parts)

        prompt = f"""당신은 공공데이터 평가편람 기반 전문 평가원입니다.
각 평가항목을 독립적으로 해당 항목의 만점 기준에 따라 채점합니다.
**중요**: 각 항목의 만점(max_score)이 다릅니다. 반드시 해당 항목의 만점 범위 내에서 채점하세요.

**JSON 출력 스키마** (반드시 이 구조를 정확히 따르세요):
{{
    "summary": "전체 평가 요약 (2-3문장)",
    "item_scores": [
        {{
            "item_id": "quality_01",
            "item_name": "항목명",
            "score": 13,
            "max_score": 17,
            "reasoning": "이 점수를 부여한 구체적 근거 (입력 데이터에서 확인된 내용 기반)",
            "issues": ["발견된 문제점"],
            "improvements": ["구체적 개선사항"]
        }}
    ]
}}

**예시 응답** (2개 항목, 만점이 다름):
{{
    "summary": "데이터 품질관리 체계는 일부 갖추어져 있으나 값 관리 측면에서 미흡합니다.",
    "item_scores": [
        {{
            "item_id": "quality_01",
            "item_name": "데이터 품질관리 체계",
            "score": 13,
            "max_score": 17,
            "reasoning": "품질관리 조직은 구성되어 있으나 품질진단 절차가 일부 미비합니다.",
            "issues": ["품질진단 절차 미비"],
            "improvements": ["정기 품질진단 절차를 수립하세요"]
        }},
        {{
            "item_id": "quality_02",
            "item_name": "데이터 값 관리",
            "score": 10,
            "max_score": 18,
            "reasoning": "데이터 값의 정확성은 확보되었으나 완전성이 부족합니다.",
            "issues": ["필수 값 누락"],
            "improvements": ["필수 필드의 NULL 비율을 5% 이하로 관리하세요"]
        }}
    ]
}}
{category_instruction}
---

**[평가 항목 목록]**:

{items_section}

---

**[입력 데이터]**:
{input_data}

---

위 평가항목의 채점 기준에 따라 입력 데이터를 항목별로 독립 평가하세요.
각 항목은 0점부터 해당 항목의 만점까지 범위로 채점하고, max_score도 함께 반환하세요.
채점 근거를 구체적으로 작성하세요.
순수 JSON 객체만 반환하세요. 마크다운 코드 블록이나 추가 설명은 포함하지 마세요.
"""

        return prompt
