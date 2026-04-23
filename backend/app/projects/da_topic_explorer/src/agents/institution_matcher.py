"""Agent 1: 기관 매칭 에이전트"""

import json
from typing import Any

from loguru import logger

from .base import BaseAgent, AgentResult


class InstitutionMatcherAgent(BaseAgent):
    """협업 가능 기관을 식별하고 매칭하는 에이전트"""

    @property
    def name(self) -> str:
        return "InstitutionMatcher"

    @property
    def system_prompt(self) -> str:
        return """당신은 공공기관 간 데이터 협력 전문가이자 기관 분석가입니다.

주어진 기관들의 프로파일과 실제 보유한 데이터 카탈로그를 분석하여:
1. 각 기관의 핵심 역할과 관심 분야를 파악합니다
2. [지식 깊이 진단] 수집된 기관 프로파일 정보가 실제 정책/목표를 파악하기에 표면적인지 깊이 있는지를 진단합니다
3. [역방향 기반 매칭] 특정 기관의 사업계획서나 정책 정보가 부족하다면, 해당 기관이 제공 가능한 '데이터 카탈로그'를 바탕으로 타 기관의 사업 내용과 매칭을 수행합니다 (데이터 주도 매칭)
4. 기관 간 가장 현실적인 협력 시너지가 발생할 수 있는 조합을 찾습니다

응답은 반드시 다음 JSON 형식으로 작성하세요:
{
    "institutions": [
        {
            "name": "기관명",
            "core_domain": "핵심 도메인",
            "key_data_assets": ["주요 데이터 자산 1", "주요 데이터 자산 2"],
            "policy_interests": ["정책 관심사 1", "정책 관심사 2"],
            "profile_depth": "충분/부족 (부족할 경우 Alert)",
            "profile_alert": "정보가 표면적이라 실제 분석 주제 발굴에 제약이 예상됩니다. 추가 자료(사업계획서 등) 입력을 권장합니다. (해당될 경우에만 작성)"
        }
    ],
    "collaboration_pairs": [
        {
            "institution_a": "기관A",
            "institution_b": "기관B",
            "synergy_score": 0.85,
            "synergy_reason": "시너지 발생 이유",
            "domain_keywords": ["두 기관이 공유하는 업무 도메인 핵심 키워드", "예: 자격시험", "시험장", "응시"],
            "potential_topics": ["잠재 분석 주제 1 (테이블명 수준으로 구체적으로)", "잠재 분석 주제 2"]
        }
    ],
    "summary": "전체 협력 가능성 요약 및 추가 자료가 필요한 기관 리스트"
}"""

    def run(self, context: dict[str, Any]) -> AgentResult:
        """기관 매칭 실행"""
        logger.info(f"[{self.name}] 기관 매칭 시작")

        try:
            # 1. 기관 프로파일 검색
            institution_results = self.search_knowledge(
                query="기관 소개 주요 사업 정책 관심사",
                collection_type="institutions",
                n_results=10
            )

            # 2. 카탈로그 요약 로드 (테이블명 목록만, 컬럼 상세 제외 — 컨텍스트 절약)
            full_data_catalog = self.get_catalog_summary_for_agent1()

            # 3. 분석 사례 검색 (협력 사례 참고)
            case_results = self.search_knowledge(
                query="기관 협력 데이터 분석 사례",
                collection_type="analysis_cases",
                n_results=5
            )

            # 4. 컨텍스트 구성
            prompt = f"""다음 정보를 바탕으로 협업 가능한 기관 조합을 분석해주세요.

## 기관 프로파일 정보
{self.format_search_results(institution_results)}

## 보유 데이터 카탈로그 요약 (테이블 목록)
사업계획 정보가 부족한 기관은 이 테이블 목록을 기반으로 역방향 매칭에 활용하세요.
collaboration_pairs의 domain_keywords는 두 기관이 공유하는 업무 도메인 키워드를 3~7개 명시하세요:
{full_data_catalog}

## 참고: 기존 분석 사례
{self.format_search_results(case_results)}

위 정보를 종합하여 기관 간 협력 가능성을 분석하고, JSON 형식으로 응답해주세요."""

            # 5. LLM 호출
            response = self.call_llm(prompt)

            # 6. JSON 파싱
            try:
                # JSON 블록 추출
                if "```json" in response:
                    json_str = response.split("```json")[1].split("```")[0]
                elif "```" in response:
                    json_str = response.split("```")[1].split("```")[0]
                else:
                    json_str = response

                data = json.loads(json_str.strip())
            except json.JSONDecodeError:
                logger.warning(f"[{self.name}] JSON 파싱 실패, 원본 응답 사용")
                data = {"raw_response": response}

            logger.info(f"[{self.name}] 기관 매칭 완료")
            return AgentResult(
                agent_name=self.name,
                success=True,
                data=data,
                raw_response=response
            )

        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {e}")
            return AgentResult(
                agent_name=self.name,
                success=False,
                error=str(e)
            )
