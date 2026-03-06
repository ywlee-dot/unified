"""Pinecone service for vector storage and retrieval."""

import logging
from typing import Any

from pinecone import Pinecone, ServerlessSpec

logger = logging.getLogger(__name__)


class PineconeError(Exception):
    pass


class PineconeService:
    """Service for managing Pinecone vector database operations."""

    def __init__(
        self,
        api_key: str,
        environment: str,
        index_name: str,
        dimension: int = 768,
        metric: str = "cosine",
    ) -> None:
        self.api_key = api_key
        self.environment = environment
        self.index_name = index_name
        self.dimension = dimension
        self.metric = metric

        self.client = Pinecone(api_key=api_key)
        self._ensure_index_exists()
        self.index = self.client.Index(index_name)

    def _ensure_index_exists(self) -> None:
        try:
            existing_indexes = self.client.list_indexes()
            index_names = [idx.name for idx in existing_indexes]

            if self.index_name not in index_names:
                logger.info(f"Creating Pinecone index: {self.index_name}")
                self.client.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric=self.metric,
                    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                )
                logger.info(f"Index {self.index_name} created successfully")
            else:
                logger.info(f"Using existing index: {self.index_name}")
        except Exception as e:
            logger.error(f"Failed to ensure index exists: {e}")
            raise PineconeError(f"Index initialization failed: {e}") from e

    def upsert(self, vectors: list[tuple[str, list[float], dict[str, Any]]] | list[dict[str, Any]], namespace: str | None = None) -> None:
        try:
            if vectors and isinstance(vectors[0], dict):
                formatted_vectors = vectors
            else:
                formatted_vectors = [
                    {"id": vec_id, "values": vector, "metadata": metadata}
                    for vec_id, vector, metadata in vectors
                ]
            self.index.upsert(vectors=formatted_vectors, namespace=namespace)
            logger.info(f"Upserted {len(vectors)} vectors to Pinecone")
        except Exception as e:
            logger.error(f"Upsert failed: {e}")
            raise PineconeError(f"Failed to upsert vectors: {e}") from e

    def upsert_batch(
        self, vectors: list[tuple[str, list[float], dict[str, Any]]], batch_size: int = 100, namespace: str | None = None
    ) -> None:
        try:
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i : i + batch_size]
                self.upsert(batch, namespace=namespace)
        except Exception as e:
            logger.error(f"Batch upsert failed: {e}")
            raise PineconeError(f"Batch upsert failed: {e}") from e

    def query(
        self,
        query_vector: list[float],
        top_k: int = 5,
        filter: dict[str, Any] | None = None,
        include_metadata: bool = True,
        namespace: str | None = None,
    ) -> list[dict[str, Any]]:
        try:
            results = self.index.query(
                vector=query_vector, top_k=top_k, filter=filter, include_metadata=include_metadata, namespace=namespace
            )
            matches = []
            for match in results.get("matches", []):
                matches.append(
                    {
                        "id": match.get("id"),
                        "score": match.get("score"),
                        "metadata": match.get("metadata", {}),
                    }
                )
            logger.info(f"Found {len(matches)} matches")
            return matches
        except Exception as e:
            logger.error(f"Query failed: {e}")
            raise PineconeError(f"Query failed: {e}") from e

    def delete(self, ids: list[str], namespace: str | None = None) -> None:
        try:
            self.index.delete(ids=ids, namespace=namespace)
            logger.info(f"Deleted {len(ids)} vectors")
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            raise PineconeError(f"Failed to delete vectors: {e}") from e

    def delete_all(self, namespace: str | None = None) -> None:
        try:
            self.index.delete(delete_all=True, namespace=namespace)
            logger.info("Deleted all vectors from index")
        except Exception as e:
            logger.error(f"Delete all failed: {e}")
            raise PineconeError(f"Failed to delete all vectors: {e}") from e

    def get_stats(self) -> dict[str, Any]:
        try:
            stats = self.index.describe_index_stats()
            return stats
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            raise PineconeError(f"Failed to get index stats: {e}") from e
