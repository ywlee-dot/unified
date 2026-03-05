"""Embedding service for generating text embeddings using Gemini."""

import logging

from google import genai
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class EmbeddingError(Exception):
    pass


class EmbeddingService:
    """Service for generating text embeddings using Gemini."""

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-embedding-001",
    ) -> None:
        self.api_key = api_key
        self.model_name = model_name
        self.client = genai.Client(api_key=api_key)

    def embed_text(
        self, text: str, task_type: str = "retrieval_document", max_retries: int = 3
    ) -> list[float]:
        if not text or not text.strip():
            raise ValueError("Text cannot be empty or whitespace-only")
        return self._embed_text_with_retry(text, task_type)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    def _embed_text_with_retry(self, text: str, task_type: str) -> list[float]:
        try:
            result = self.client.models.embed_content(
                model=self.model_name,
                contents=text,
            )
            embedding = result.embeddings[0].values
            logger.debug(f"Generated embedding of dimension {len(embedding)}")
            return list(embedding)
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise EmbeddingError(f"Embedding generation failed: {e}") from e

    def embed_batch(
        self, texts: list[str], batch_size: int = 100, task_type: str = "retrieval_document"
    ) -> list[list[float]]:
        embeddings: list[list[float]] = []
        try:
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                for text in batch:
                    embedding = self.embed_text(text, task_type=task_type)
                    embeddings.append(embedding)
            logger.info(f"Generated {len(embeddings)} embeddings")
            return embeddings
        except Exception as e:
            logger.error(f"Batch embedding failed: {e}")
            raise EmbeddingError(f"Batch embedding failed: {e}") from e

    def embed_query(self, query: str) -> list[float]:
        return self.embed_text(query, task_type="retrieval_query")
