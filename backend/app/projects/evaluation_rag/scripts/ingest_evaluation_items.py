"""Ingest evaluation items from master JSON into Pinecone v2 namespace.

Usage:
    python -m app.projects.evaluation_rag.scripts.ingest_evaluation_items
    python -m app.projects.evaluation_rag.scripts.ingest_evaluation_items --dry-run
    python -m app.projects.evaluation_rag.scripts.ingest_evaluation_items --verify
"""

import argparse
import json
import logging
import sys
from pathlib import Path

from app.config import settings
from app.projects.evaluation_rag.core.embedding_service import EmbeddingService
from app.projects.evaluation_rag.core.pinecone_service import PineconeService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

NAMESPACE = "v2"
EMBEDDING_DIMENSION = 3072

# Path to master data relative to this file: scripts/ -> evaluation_rag/ -> data/
_DATA_PATH = Path(__file__).parent.parent / "data" / "evaluation_items.json"


def load_items() -> list[dict]:
    """Load all evaluation items from the master JSON, flattened with category info."""
    if not _DATA_PATH.exists():
        raise FileNotFoundError(f"Evaluation items JSON not found: {_DATA_PATH}")

    with _DATA_PATH.open(encoding="utf-8") as f:
        data = json.load(f)

    records: list[dict] = []
    for category in data.get("categories", []):
        for item in category.get("items", []):
            records.append({"category": category, "item": item})

    logger.info(
        f"Loaded {len(records)} items across {len(data.get('categories', []))} categories"
        f" from {_DATA_PATH}"
    )
    return records


def ingest(dry_run: bool = False) -> None:
    """Embed and upsert all evaluation items into Pinecone namespace v2."""
    if not settings.GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY is not set — cannot generate embeddings.")
        sys.exit(1)
    if not settings.PINECONE_API_KEY:
        logger.error("PINECONE_API_KEY is not set — cannot connect to Pinecone.")
        sys.exit(1)

    records = load_items()

    if dry_run:
        logger.info("[DRY RUN] Items that would be ingested:")
        current_category = None
        for rec in records:
            cat = rec["category"]["category_en"]
            item = rec["item"]
            if cat != current_category:
                current_category = cat
                logger.info(
                    f"  Category: {cat} ({rec['category']['category_ko']})"
                )
            embedding_text = (
                item["item_name"]
                + " "
                + item["description"]
                + " "
                + item["scoring_criteria"]
            )
            logger.info(
                f"    [{item['item_id']}] {item['item_name']} "
                f"(max_score={item['max_score']}, "
                f"text_len={len(embedding_text)})"
            )
        logger.info(f"[DRY RUN] Total: {len(records)} items — no data written.")
        return

    embedding_svc = EmbeddingService(api_key=settings.GEMINI_API_KEY)
    pinecone_svc = PineconeService(
        api_key=settings.PINECONE_API_KEY,
        environment="",
        index_name=settings.PINECONE_INDEX_NAME,
        dimension=EMBEDDING_DIMENSION,
        metric="cosine",
    )

    vectors: list[tuple[str, list[float], dict]] = []
    current_category = None
    category_count = 0

    for rec in records:
        category = rec["category"]
        item = rec["item"]
        cat_en = category["category_en"]

        if cat_en != current_category:
            if current_category is not None:
                logger.info(
                    f"  Completed category '{current_category}': {category_count} item(s)"
                )
            current_category = cat_en
            category_count = 0
            logger.info(
                f"Processing category: {cat_en} ({category['category_ko']})"
            )

        embedding_text = (
            item["item_name"]
            + " "
            + item["description"]
            + " "
            + item["scoring_criteria"]
        )

        logger.info(f"  Embedding [{item['item_id']}] {item['item_name']} ...")
        try:
            vector = embedding_svc.embed_text(embedding_text, task_type="retrieval_document")
        except Exception as e:
            logger.error(
                f"  Failed to embed [{item['item_id']}] {item['item_name']}: {e}"
            )
            raise

        metadata = {
            "category_en": category["category_en"],
            "category_ko": category["category_ko"],
            "item_id": item["item_id"],
            "item_name": item["item_name"],
            "description": item["description"],
            "max_score": item["max_score"],
            "scoring_criteria": item["scoring_criteria"],
            "text": embedding_text,
            "keywords": ",".join(item.get("keywords", [])),
        }

        vectors.append((item["item_id"], vector, metadata))
        category_count += 1

    # Log final category
    if current_category is not None:
        logger.info(
            f"  Completed category '{current_category}': {category_count} item(s)"
        )

    logger.info(f"Upserting {len(vectors)} vectors to Pinecone (namespace='{NAMESPACE}') ...")
    try:
        pinecone_svc.upsert_batch(vectors, namespace=NAMESPACE)
    except Exception as e:
        logger.error(f"Upsert failed: {e}")
        raise

    logger.info(f"Done. {len(vectors)} items ingested into namespace '{NAMESPACE}'.")


def verify() -> None:
    """Query Pinecone v2 namespace stats and print item counts."""
    if not settings.PINECONE_API_KEY:
        logger.error("PINECONE_API_KEY is not set.")
        sys.exit(1)

    pinecone_svc = PineconeService(
        api_key=settings.PINECONE_API_KEY,
        environment="",
        index_name=settings.PINECONE_INDEX_NAME,
        dimension=EMBEDDING_DIMENSION,
        metric="cosine",
    )

    logger.info(f"Fetching index stats for '{settings.PINECONE_INDEX_NAME}' ...")
    stats = pinecone_svc.get_stats()

    total_vectors = stats.get("total_vector_count", 0)
    namespaces = stats.get("namespaces", {})
    v2_info = namespaces.get(NAMESPACE, {})
    v2_count = v2_info.get("vector_count", 0)

    logger.info(f"Index '{settings.PINECONE_INDEX_NAME}' stats:")
    logger.info(f"  Total vectors (all namespaces): {total_vectors}")
    logger.info(f"  Vectors in namespace '{NAMESPACE}': {v2_count}")
    if namespaces:
        logger.info("  All namespaces:")
        for ns, ns_info in namespaces.items():
            logger.info(f"    {ns}: {ns_info.get('vector_count', 0)} vectors")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ingest evaluation items from master JSON into Pinecone v2 namespace."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print items that would be ingested without actually ingesting.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="After ingesting, query Pinecone v2 namespace stats and print item counts.",
    )
    args = parser.parse_args()

    ingest(dry_run=args.dry_run)

    if args.verify and not args.dry_run:
        verify()
