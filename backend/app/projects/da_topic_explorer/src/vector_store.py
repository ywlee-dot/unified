"""벡터 저장소 모듈"""

from pathlib import Path
from typing import Literal

import chromadb
from chromadb.config import Settings as ChromaSettings
from loguru import logger
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

from .config import settings
from .preprocessor import TextChunk


CollectionType = Literal["institutions", "data_catalog", "analysis_cases"]


class EmbeddingModel:
    """임베딩 모델 래퍼 클래스"""

    def __init__(
        self,
        model_name: str | None = None,
        device: str | None = None
    ):
        self.model_name = model_name or settings.embedding.model_name
        self.device = device or settings.embedding.device
        self.query_prefix = settings.embedding.query_prefix
        self.passage_prefix = settings.embedding.passage_prefix
        self._model = None

    @property
    def model(self) -> SentenceTransformer:
        """모델 레이지 로딩"""
        if self._model is None:
            logger.info(f"임베딩 모델 로딩: {self.model_name}")
            self._model = SentenceTransformer(
                self.model_name,
                device=self.device
            )
        return self._model

    def embed_passages(self, texts: list[str]) -> list[list[float]]:
        """패시지(문서) 임베딩"""
        # E5 모델은 passage: 프리픽스 필요
        prefixed_texts = [f"{self.passage_prefix}{t}" for t in texts]
        embeddings = self.model.encode(
            prefixed_texts,
            normalize_embeddings=settings.embedding.normalize_embeddings,
            show_progress_bar=False
        )
        return embeddings.tolist()

    def embed_query(self, query: str) -> list[float]:
        """쿼리 임베딩"""
        # E5 모델은 query: 프리픽스 필요
        prefixed_query = f"{self.query_prefix}{query}"
        embedding = self.model.encode(
            prefixed_query,
            normalize_embeddings=settings.embedding.normalize_embeddings,
            show_progress_bar=False
        )
        return embedding.tolist()


class CustomEmbeddingFunction:
    """ChromaDB용 커스텀 임베딩 함수"""

    def __init__(self, embedding_model: EmbeddingModel):
        self.embedding_model = embedding_model

    def __call__(self, input: list[str]) -> list[list[float]]:
        """ChromaDB에서 호출할 때 사용"""
        return self.embedding_model.embed_passages(input)


class VectorStore:
    """ChromaDB 벡터 저장소"""

    def __init__(
        self,
        persist_directory: Path | None = None,
        embedding_model: EmbeddingModel | None = None
    ):
        self.persist_directory = persist_directory or settings.paths.db_dir
        self.embedding_model = embedding_model or EmbeddingModel()

        # 디렉토리 생성
        self.persist_directory.mkdir(parents=True, exist_ok=True)

        # ChromaDB 클라이언트 초기화
        self.client = chromadb.PersistentClient(
            path=str(self.persist_directory),
            settings=ChromaSettings(anonymized_telemetry=False)
        )

        # 컬렉션 캐시
        self._collections: dict[str, chromadb.Collection] = {}

        logger.info(f"VectorStore 초기화 완료: {self.persist_directory}")

    def _get_collection_name(self, collection_type: CollectionType) -> str:
        """컬렉션 이름 반환"""
        mapping = {
            "institutions": settings.chromadb.institutions_collection,
            "data_catalog": settings.chromadb.data_catalog_collection,
            "analysis_cases": settings.chromadb.analysis_cases_collection,
        }
        return mapping[collection_type]

    def get_collection(self, collection_type: CollectionType) -> chromadb.Collection:
        """컬렉션 가져오기 (없으면 생성)"""
        collection_name = self._get_collection_name(collection_type)

        if collection_name not in self._collections:
            self._collections[collection_name] = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        return self._collections[collection_name]

    def delete_collection(self, collection_type: CollectionType) -> None:
        """컬렉션 삭제"""
        collection_name = self._get_collection_name(collection_type)
        try:
            self.client.delete_collection(collection_name)
            if collection_name in self._collections:
                del self._collections[collection_name]
            logger.info(f"컬렉션 삭제됨: {collection_name}")
        except (ValueError, Exception) as e:
            # NotFoundError 포함 모든 예외 처리
            if "does not exist" in str(e) or "NotFound" in str(type(e).__name__):
                logger.debug(f"삭제할 컬렉션이 없음: {collection_name}")
            else:
                raise

    def add_chunks(
        self,
        chunks: list[TextChunk],
        collection_type: CollectionType,
        batch_size: int = 100
    ) -> int:
        """청크들을 벡터 저장소에 추가"""
        if not chunks:
            return 0

        collection = self.get_collection(collection_type)
        added_count = 0

        # 배치 처리
        for i in tqdm(range(0, len(chunks), batch_size), desc=f"임베딩 ({collection_type})"):
            batch = chunks[i:i + batch_size]

            ids = [chunk.id for chunk in batch]
            documents = [chunk.content for chunk in batch]
            metadatas = [chunk.metadata for chunk in batch]

            # 임베딩 생성
            embeddings = self.embedding_model.embed_passages(documents)

            # ChromaDB에 추가
            collection.add(
                ids=ids,
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas
            )
            added_count += len(batch)

        logger.info(f"{collection_type}에 {added_count}개 청크 추가됨")
        return added_count

    def search(
        self,
        query: str,
        collection_type: CollectionType | None = None,
        n_results: int = 5,
        where: dict | None = None
    ) -> list[dict]:
        """벡터 검색"""
        # 쿼리 임베딩
        query_embedding = self.embedding_model.embed_query(query)

        results = []

        # 특정 컬렉션 또는 모든 컬렉션 검색
        if collection_type:
            collection_types = [collection_type]
        else:
            collection_types = ["institutions", "data_catalog", "analysis_cases"]

        for ct in collection_types:
            try:
                collection = self.get_collection(ct)
                if collection.count() == 0:
                    continue

                search_results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=n_results,
                    where=where,
                    include=["documents", "metadatas", "distances"]
                )

                # 결과 정리
                for i in range(len(search_results["ids"][0])):
                    results.append({
                        "id": search_results["ids"][0][i],
                        "content": search_results["documents"][0][i],
                        "metadata": search_results["metadatas"][0][i],
                        "distance": search_results["distances"][0][i],
                        "collection": ct,
                        "score": 1 - search_results["distances"][0][i],  # cosine similarity
                    })
            except Exception as e:
                logger.warning(f"{ct} 검색 실패: {e}")

        # 점수순 정렬
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:n_results]

    def get_stats(self) -> dict[str, int]:
        """각 컬렉션의 청크 수 반환"""
        stats = {}
        for collection_type in ["institutions", "data_catalog", "analysis_cases"]:
            try:
                collection = self.get_collection(collection_type)
                stats[collection_type] = collection.count()
            except Exception:
                stats[collection_type] = 0
        return stats

    def reset_all(self) -> None:
        """모든 컬렉션 초기화"""
        for collection_type in ["institutions", "data_catalog", "analysis_cases"]:
            self.delete_collection(collection_type)
        logger.info("모든 컬렉션 초기화 완료")
