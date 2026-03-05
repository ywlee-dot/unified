"""Chunk storage for storing document chunks with Korean text."""

import hashlib
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class ChunkStore:
    """Store and retrieve document chunks with full text content."""

    def __init__(self, storage_path: str = "data/evaluation_rag/chunks"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.index_file = self.storage_path / "index.json"
        self.index = self._load_index()

    def _load_index(self) -> dict:
        if self.index_file.exists():
            try:
                with open(self.index_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load index: {e}")
                return {}
        return {}

    def _save_index(self):
        try:
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(self.index, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save index: {e}")

    def store_chunks(self, source: str, chunks: list[dict]) -> None:
        doc_id = self._get_doc_id(source)
        chunks_file = self.storage_path / f"{doc_id}.json"

        try:
            with open(chunks_file, "w", encoding="utf-8") as f:
                json.dump(chunks, f, ensure_ascii=False, indent=2)

            self.index[source] = {
                "doc_id": doc_id,
                "source": source,
                "chunks_file": str(chunks_file),
                "num_chunks": len(chunks),
            }
            self.index[doc_id] = self.index[source]
            self._save_index()
            logger.info(f"Stored {len(chunks)} chunks for {source}")
        except Exception as e:
            logger.error(f"Failed to store chunks: {e}")
            raise

    def get_chunk(self, source: str, chunk_index: int) -> str | None:
        doc_id = self._get_doc_id(source)

        if doc_id not in self.index:
            logger.warning(f"Document {source} not found in index")
            return None

        chunks_file = Path(self.index[doc_id]["chunks_file"])

        try:
            with open(chunks_file, "r", encoding="utf-8") as f:
                chunks = json.load(f)
            if 0 <= chunk_index < len(chunks):
                return chunks[chunk_index]["text"]
            else:
                logger.warning(f"Chunk index {chunk_index} out of range for {source}")
                return None
        except Exception as e:
            logger.error(f"Failed to get chunk: {e}")
            return None

    def get_chunks_batch(self, requests: list[tuple[str, int]]) -> list[str | None]:
        results = []
        for source, chunk_index in requests:
            results.append(self.get_chunk(source, chunk_index))
        return results

    def _get_doc_id(self, source: str) -> str:
        return hashlib.md5(source.encode("utf-8")).hexdigest()

    def clear_all(self):
        try:
            for file in self.storage_path.glob("*.json"):
                file.unlink()
            self.index = {}
            logger.info("Cleared all chunks")
        except Exception as e:
            logger.error(f"Failed to clear chunks: {e}")
