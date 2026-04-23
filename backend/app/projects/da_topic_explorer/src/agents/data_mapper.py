"""Agent 3: 데이터 매핑 에이전트"""

import json
from typing import Any

from loguru import logger

from .base import BaseAgent, AgentResult


class DataMapperAgent(BaseAgent):
    """분석 주제에 필요한 데이터셋을 매핑하는 에이전트"""

    @property
    def name(self) -> str:
        return "DataMapper"

    @property
    def system_prompt(self) -> str:
        return """당신은 공공데이터 분석 데이터 매핑 및 교차 검증(Cross-Validation) 전문가입니다.

절대 준수 사항 (데이터 매핑 검증)
1. [Strict Grounding Constraints] 당신의 가장 중요한 임무는 앞선 단계에서 제안된 분석 주제에 필요한 데이터가 제공된 '가용 데이터 카탈로그 전체 목록'에 "정확한 명칭"으로 존재하는지 검증(Validation)하는 것입니다.
2. 메타데이터에 존재하지 않는 가상의 데이터셋이나 필드를 상상해서 제안하거나 허용하는 것을 엄격히 금지합니다.
3. 제안된 주제에 필요한 핵심 데이터가 카탈로그에 없다면, 해당 주제의 실현 가능성(feasibility_score)을 대폭 낮추고 lack_of_data 속성에 구체적인 이유를 적어야 합니다.
4. [데이터 심층 이해 검증] 테이블/컬럼명이 비슷해 보인다고 무조건 매핑하지 마세요. 도메인 지식을 활용하여 해당 데이터의 성격, 집계 단위(예: 일별/월별, 지역별 등), 데이터 발생 원천 등을 깊이 이해하고, 분석 주제를 실질적으로 해결하는 데 무리가 없는지 깐깐하게 평가하세요.

주어진 분석 주제에 대해:
1. 주제 발굴에서 제안된 필요 데이터가 전체 카탈로그에 실제 존재하는지 1:1로 확인합니다.
2. 데이터 간 결합 방안을 설계합니다(실제 컬럼 기반).
3. 데이터의 컨텍스트를 파악하여 실질적 분석 품질 및 가용성을 평가합니다.

응답은 반드시 다음 JSON 형식으로 작성하세요:
{
    "topic_id": "TOPIC_001",
    "topic_title": "분석 주제명",
    "validation_result": "성공(모든 데이터 존재 및 활용 적합) / 실패(가상 데이터 포함 또는 의미상 부적합)",
    "lack_of_data": "실패 시 기재(예: 카탈로그에 없는 데이터 내역 혹은 집계 기준이 맞지 않는 이유)",
    "data_requirements": [
        {
            "dataset_name": "실제 카탈로그의 100% 일치하는 데이터셋명",
            "source_institution": "제공 기관",
            "key_columns": ["실제 존재하는 주요 컬럼1", "실제 존재하는 주요 컬럼2"],
            "purpose": "활용 목적 (데이터의 맥락 분석 결과 포함 기재)"
        }
    ],
    "data_integration": {
        "join_keys": ["결합키1(A기관)", "결합키2(B기관)"],
        "integration_method": "구체적인 결합 방법 및 집계 단위 맞춤 방안 구체화"
    },
    "feasibility_score": 0.8,
    "feasibility_notes": "데이터 매칭률 및 의미적 적합성 기반 실현 가능성 냉정한 평가 및 멘트"
}"""

    def run(self, context: dict[str, Any]) -> AgentResult:
        """데이터 매핑 실행"""
        logger.info(f"[{self.name}] 데이터 매핑 시작")

        try:
            # 이전 에이전트 결과 활용
            topics_data = context.get("topic_discoverer", {})
            topics = topics_data.get("topics", [])

            if not topics:
                logger.warning(f"[{self.name}] 분석할 주제가 없습니다")
                return AgentResult(
                    agent_name=self.name,
                    success=False,
                    error="분석할 주제가 없습니다"
                )

            all_mappings = []

            for topic in topics:
                topic_id = topic.get("id", "UNKNOWN")
                topic_title = topic.get("title", "제목 없음")

                # 1. 관련 데이터 카탈로그는 전체 텍스트로 로드 (Zero-shot Injection)
                full_data_catalog = self.get_full_data_catalog_text()

                # 2. 유사 분석 사례 검색
                case_results = self.search_knowledge(
                    query=f"{topic_title} 분석 방법론 데이터 결합",
                    collection_type="analysis_cases",
                    n_results=5
                )

                # 3. 컨텍스트 구성
                prompt = f"""다음 분석 주제에 필요한 데이터셋을 매핑해주세요.

## 분석 주제
- ID: {topic_id}
- 제목: {topic_title}
- 설명: {topic.get('description', 'N/A')}
- 데이터 제공 기관: {topic.get('collaboration', {}).get('data_provider', 'N/A')}
- 데이터 활용 기관: {topic.get('collaboration', {}).get('data_user', 'N/A')}
- 기대 효과: {', '.join(topic.get('expected_outcomes', []))}

## 전체 가용 데이터 카탈로그 목록 (Cross Validation 기준)
절대 아래 목록에 없는 데이터 명칭을 창작하지 마세요. 없는 경우 없다고 명확히 리포트하세요:
{full_data_catalog}

## 참고: 유사 분석 사례
{self.format_search_results(case_results)}

위 정보를 바탕으로 필요한 데이터셋과 분석 방법론을 JSON 형식으로 응답해주세요."""

                # 4. LLM 호출
                response = self.call_llm(prompt)

                # 5. JSON 파싱
                try:
                    if "```json" in response:
                        json_str = response.split("```json")[1].split("```")[0]
                    elif "```" in response:
                        json_str = response.split("```")[1].split("```")[0]
                    else:
                        json_str = response

                    mapping = json.loads(json_str.strip())
                    all_mappings.append(mapping)
                except json.JSONDecodeError:
                    logger.warning(f"[{self.name}] JSON 파싱 실패 (주제: {topic_id})")
                    all_mappings.append({
                        "topic_id": topic_id,
                        "topic_title": topic_title,
                        "raw_response": response
                    })

            logger.info(f"[{self.name}] 데이터 매핑 완료: {len(all_mappings)}개 주제")
            return AgentResult(
                agent_name=self.name,
                success=True,
                data={"mappings": all_mappings}
            )

        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {e}")
            return AgentResult(
                agent_name=self.name,
                success=False,
                error=str(e)
            )
