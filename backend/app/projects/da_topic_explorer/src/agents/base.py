"""에이전트 기본 클래스"""

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import google.generativeai as genai
from loguru import logger

from ..catalog_parser import CatalogParser
from ..config import settings
from ..document_loader import DocumentLoaderFactory, DocType
from ..vector_store import VectorStore


@dataclass
class AgentResult:
    """에이전트 실행 결과"""
    agent_name: str
    success: bool
    data: dict = field(default_factory=dict)
    error: str | None = None
    raw_response: str | None = None


class BaseAgent(ABC):
    """에이전트 기본 클래스"""

    def __init__(
        self,
        vector_store: VectorStore,
        model: str = "gemini-2.0-flash"
    ):
        self.vector_store = vector_store
        self.model = model
        self._client = None
        self._configured = False

    def _configure_api(self):
        """Google API 설정"""
        if not self._configured:
            api_key = os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise ValueError(
                    "GOOGLE_API_KEY 환경변수가 설정되지 않았습니다. "
                    ".env 파일에 GOOGLE_API_KEY=your_key 형식으로 설정하세요."
                )
            genai.configure(api_key=api_key)
            self._configured = True

    @property
    def client(self) -> genai.GenerativeModel:
        """Gemini 클라이언트 레이지 로딩"""
        if self._client is None:
            self._configure_api()
            self._client = genai.GenerativeModel(
                model_name=self.model,
                system_instruction=self.system_prompt
            )
        return self._client

    @property
    @abstractmethod
    def name(self) -> str:
        """에이전트 이름"""
        pass

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """시스템 프롬프트"""
        pass

    def search_knowledge(
        self,
        query: str,
        collection_type: str | None = None,
        n_results: int = 5
    ) -> list[dict]:
        """지식 기반 검색"""
        return self.vector_store.search(
            query=query,
            collection_type=collection_type,
            n_results=n_results
        )

    def format_search_results(self, results: list[dict]) -> str:
        """검색 결과를 텍스트로 포맷팅"""
        if not results:
            return "검색 결과 없음"

        formatted = []
        for i, r in enumerate(results, 1):
            institution = r["metadata"].get("institution_name", "N/A")
            doc_type = r["metadata"].get("doc_type_kr", r["metadata"].get("doc_type", "N/A"))
            score = r["score"]
            content = r["content"][:500] + "..." if len(r["content"]) > 500 else r["content"]

            formatted.append(
                f"[{i}] 기관: {institution} | 유형: {doc_type} | 유사도: {score:.3f}\n"
                f"내용: {content}\n"
            )
        return "\n".join(formatted)

    def call_llm(self, user_message: str, max_tokens: int = 4096, max_retries: int = 3) -> str:
        """LLM 호출 (재시도 로직 포함)"""
        import time
        from google.api_core import exceptions

        logger.debug(f"[{self.name}] LLM 호출 시작")
        
        last_exception = None
        for attempt in range(max_retries):
            try:
                response = self.client.generate_content(
                    user_message,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=max_tokens,
                        temperature=0.7
                    )
                )
                result = response.text
                logger.debug(f"[{self.name}] LLM 응답 수신 ({len(result)} 자) - 시도 {attempt + 1}")
                return result
            except (exceptions.ResourceExhausted, exceptions.ServiceUnavailable, exceptions.InternalServerError) as e:
                last_exception = e
                wait_time = (attempt + 1) * 2 # 단순 지수 백오프
                logger.warning(f"[{self.name}] LLM 호출 실패 (시도 {attempt + 1}/{max_retries}): {str(e)}. {wait_time}초 후 재시도...")
                time.sleep(wait_time)
            except Exception as e:
                logger.error(f"[{self.name}] LLM 예기치 않은 오류: {str(e)}")
                raise e
        
        logger.error(f"[{self.name}] LLM 호출 최종 실패: {str(last_exception)}")
        raise last_exception

    def get_filtered_catalog_for_prompt(
        self,
        institution_names: list[str],
        domain_keywords: list[str],
    ) -> str:
        """
        catalog_index.json에서 기관명 + 도메인 키워드로 필터링한 카탈로그를
        프롬프트 삽입용 구조화 텍스트로 반환.
        Agent 2에서 사용.
        """
        catalog_index = CatalogParser.load_catalog_index(settings.paths.catalog_index_path)
        if not catalog_index:
            logger.warning("catalog_index.json 없음 — Phase 1을 먼저 실행하세요.")
            return "카탈로그 인덱스 없음. Phase 1 재실행 필요."

        filtered = CatalogParser.filter_by_keywords(
            catalog_index, institution_names, domain_keywords
        )
        if not filtered:
            logger.warning(
                f"필터링 결과 없음 (기관: {institution_names}, 키워드: {domain_keywords}) "
                "— 전체 카탈로그 반환"
            )
            filtered = CatalogParser.filter_by_keywords(catalog_index, institution_names, [])

        return CatalogParser.format_for_prompt(filtered)

    def get_catalog_summary_for_agent1(self) -> str:
        """
        catalog_index.json의 테이블명 요약 텍스트 반환.
        Agent 1에서 기관 매칭 시 사용 (컬럼 상세 없이 테이블 목록만).
        """
        catalog_index = CatalogParser.load_catalog_index(settings.paths.catalog_index_path)
        if not catalog_index:
            # fallback: 기존 raw text 방식
            return self._get_full_data_catalog_text_legacy()
        return CatalogParser.format_summary_for_agent1(catalog_index)

    def _get_full_data_catalog_text_legacy(self) -> str:
        """catalog_index 없을 때 기존 방식 폴백 (raw text)"""
        catalog_path = settings.paths.data_catalog_dir
        if not catalog_path.exists():
            return "데이터 카탈로그 정보가 없습니다."
        docs = list(DocumentLoaderFactory.load_directory(catalog_path, "data_catalog"))
        if not docs:
            return "데이터 카탈로그 정보가 없습니다."
        texts = []
        for doc in docs:
            institution = doc.metadata.get("institution_name", "N/A")
            texts.append(f"### 기관: {institution}\n\n{doc.content}\n")
        return "\n".join(texts)

    @abstractmethod
    def run(self, context: dict[str, Any]) -> AgentResult:
        """에이전트 실행"""
        pass
