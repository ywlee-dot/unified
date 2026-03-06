"""Query processor for preprocessing and embedding queries."""

import logging
import re

logger = logging.getLogger(__name__)


class QueryProcessingError(Exception):
    pass


class QueryProcessor:
    """Processor for cleaning and embedding search queries."""

    CATEGORY_KEYWORDS = {
        "quality": ["품질", "데이터품질", "값 관리", "진단", "데이터 값"],
        "openness": ["개방", "공공데이터", "오류신고", "제공신청"],
        "analysis": ["분석", "데이터분석", "정책활용", "정책", "활용사례", "분석 활용"],
        "sharing": ["공유", "공유데이터", "로드맵", "데이터공유"],
        "management": ["관리체계", "추진기반", "교육", "관리", "체계"],
    }

    def __init__(self, embedding_service) -> None:
        self.embedding_service = embedding_service

    def preprocess_query(self, query: str) -> str:
        if not query or not query.strip():
            raise ValueError("Query cannot be empty or whitespace-only")
        cleaned = re.sub(r"\s+", " ", query.strip())
        cleaned = re.sub(r"[!?]+", "", cleaned)
        return cleaned

    def detect_category(self, query: str) -> str | None:
        matches = []
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            if any(keyword in query for keyword in keywords):
                matches.append(category)
        if len(matches) == 1:
            logger.info(f"Auto-detected category: {matches[0]} from query: {query}")
            return matches[0]
        elif len(matches) > 1:
            logger.debug(f"Ambiguous category matches: {matches} for query: {query}")
            return None
        else:
            return None

    def process_query(self, query: str) -> dict:
        try:
            processed_query = self.preprocess_query(query)
            category = self.detect_category(processed_query)
            embedding = self.embedding_service.embed_query(processed_query)
            return {"query": processed_query, "embedding": embedding, "category": category}
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Query processing failed: {e}")
            raise QueryProcessingError(f"Failed to process query: {e}") from e

    def process_query_for_items(self, query: str, category: str | None = None) -> dict:
        """Process query for item-level evaluation."""
        try:
            processed_query = self.preprocess_query(query)
            detected_category = self.detect_category(processed_query)
            final_category = category or detected_category
            if final_category:
                logger.info(
                    f"Item query category: {final_category} "
                    f"({'explicit' if category else 'auto-detected'})"
                )
            return {"query": processed_query, "category": final_category}
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Item query processing failed: {e}")
            raise QueryProcessingError(f"Failed to process item query: {e}") from e
