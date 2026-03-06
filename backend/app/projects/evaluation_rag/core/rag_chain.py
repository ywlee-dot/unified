"""RAG chain for combining retrieval and generation."""

import logging
import urllib.parse
from .chunk_store import ChunkStore

logger = logging.getLogger(__name__)


class RAGChain:
    """Chain for Retrieval-Augmented Generation pipeline."""

    def __init__(self, query_processor, retrieval_service, chunk_store=None) -> None:
        self.query_processor = query_processor
        self.retrieval_service = retrieval_service
        self.chunk_store = chunk_store or ChunkStore()

    def run(self, query: str, top_k: int = 5, category: str | None = None) -> dict:
        processed = self.query_processor.process_query(query)

        detected_category = processed.get("category")
        final_category = category or detected_category

        if final_category:
            logger.info(
                f"Using category filter: {final_category} "
                f"({'explicit' if category else 'auto-detected'})"
            )

        documents = self.retrieval_service.retrieve(
            query=processed["query"], top_k=top_k, category=final_category
        )

        context = self._format_context(documents)

        return {
            "query": processed["query"],
            "context": context,
            "category": final_category,
            "documents": documents,
        }

    def _format_context(self, documents: list[dict]) -> str:
        chunks_to_load = []
        doc_info = []

        for i, doc in enumerate(documents, 1):
            metadata = doc.get("metadata", {})
            score = doc.get("score", 0)
            text = metadata.get("text", "")

            if not text:
                source_encoded = metadata.get("source", "")
                chunk_index = metadata.get("chunk_index")

                if source_encoded and chunk_index is not None:
                    try:
                        source = urllib.parse.unquote(source_encoded)
                    except Exception:
                        source = source_encoded
                    chunks_to_load.append((source, chunk_index))
                    doc_info.append({"index": i, "score": score, "text": None})
                else:
                    doc_info.append({"index": i, "score": score, "text": None})
            else:
                doc_info.append({"index": i, "score": score, "text": text})

        if chunks_to_load:
            logger.debug(f"Batch loading {len(chunks_to_load)} chunks from store")
            loaded_texts = self.chunk_store.get_chunks_batch(chunks_to_load)

            load_idx = 0
            for info in doc_info:
                if info["text"] is None and load_idx < len(loaded_texts):
                    info["text"] = loaded_texts[load_idx]
                    load_idx += 1

        context_parts = []
        for info in doc_info:
            if info["text"] and info["text"].strip():
                context_parts.append(
                    f"[{info['index']}] (Score: {info['score']:.2f})\n{info['text']}"
                )
            else:
                logger.warning(f"No text available for document {info['index']}")

        if not context_parts:
            logger.error("No context could be retrieved from documents")
            raise ValueError(
                "No context available. Please ensure documents are properly ingested."
            )

        return "\n\n".join(context_parts)

    def run_items(self, query: str, category: str | None = None) -> dict:
        """Run RAG pipeline for item-level evaluation."""
        processed = self.query_processor.process_query_for_items(query, category)
        final_category = processed["category"]
        processed_query = processed["query"]

        results = self.retrieval_service.retrieve_items(
            query=processed_query,
            category=final_category,
        )

        seen_ids: set[str] = set()
        items: list[dict] = []
        category_ko = ""

        for result in results:
            metadata = result.get("metadata", {})
            item_id = metadata.get("item_id", result.get("id", ""))
            if item_id in seen_ids:
                continue
            seen_ids.add(item_id)

            cat_ko = metadata.get("category_ko", "")
            if cat_ko and not category_ko:
                category_ko = cat_ko

            items.append(
                {
                    "item_id": item_id,
                    "item_name": metadata.get("item_name", ""),
                    "category": metadata.get("category_en", ""),
                    "category_ko": cat_ko,
                    "scoring_criteria": metadata.get("scoring_criteria", ""),
                    "max_score": metadata.get("max_score"),
                    "description": metadata.get("description", ""),
                }
            )

        logger.info(
            f"run_items: query='{processed_query}' category={final_category} "
            f"items={len(items)}"
        )

        return {
            "query": processed_query,
            "category": final_category,
            "items": items,
            "category_ko": category_ko,
        }
