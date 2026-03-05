"""Retrieval service for searching relevant documents."""

import logging

logger = logging.getLogger(__name__)


class RetrievalError(Exception):
    pass


class RetrievalService:
    """Service for retrieving relevant documents from vector database."""

    def __init__(self, pinecone_service, embedding_service) -> None:
        self.pinecone_service = pinecone_service
        self.embedding_service = embedding_service

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        threshold: float = 0.7,
        filter: dict | None = None,
        category: str | None = None,
    ) -> list[dict]:
        try:
            query_embedding = self.embedding_service.embed_query(query)

            metadata_filter = filter.copy() if filter else {}
            if category:
                metadata_filter["category_en"] = category
                logger.info(f"Filtering by category: {category}")

            results = self.pinecone_service.query(
                query_vector=query_embedding,
                top_k=top_k,
                filter=metadata_filter if metadata_filter else None,
            )

            filtered_results = [r for r in results if r["score"] >= threshold]

            if not filtered_results and results:
                fallback_threshold = 0.5
                filtered_results = [r for r in results if r["score"] >= fallback_threshold]

                if filtered_results:
                    logger.warning(
                        f"No results above threshold {threshold}. "
                        f"Using fallback threshold {fallback_threshold}."
                    )
                else:
                    filtered_results = [results[0]]
                    logger.warning(
                        f"No results above fallback threshold. "
                        f"Returning top result with score {results[0]['score']:.2f}"
                    )

            logger.info(
                f"Retrieved {len(filtered_results)}/{len(results)} documents "
                f"(threshold: {threshold})"
            )
            return filtered_results
        except Exception as e:
            logger.error(f"Retrieval failed: {e}")
            raise RetrievalError(f"Failed to retrieve documents: {e}") from e
