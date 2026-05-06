from __future__ import annotations

from loguru import logger
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, ScoredPoint, VectorParams

from config import Settings

_client: QdrantClient | None = None


def init_client(settings: Settings) -> None:
    global _client
    logger.info(f"Connecting to Qdrant at {settings.qdrant_url}")
    _client = QdrantClient(url=settings.qdrant_url, timeout=10)
    _bootstrap_collection(settings)
    logger.info("Qdrant client ready")


def get_client() -> QdrantClient:
    if _client is None:
        raise RuntimeError("Qdrant client not initialised")
    return _client


def _bootstrap_collection(settings: Settings) -> None:
    client = get_client()
    existing = [c.name for c in client.get_collections().collections]
    if settings.collection_name not in existing:
        client.create_collection(
            collection_name=settings.collection_name,
            vectors_config=VectorParams(
                size=settings.embedding_dim,
                distance=Distance.COSINE,
            ),
        )
        logger.info(f"Created Qdrant collection '{settings.collection_name}'")
    else:
        logger.info(f"Qdrant collection '{settings.collection_name}' already exists")


def search(
    query_vector: list[float],
    collection_name: str,
    top_k: int = 5,
    language: str | None = None,
) -> list[ScoredPoint]:
    client = get_client()
    query_filter = None
    if language:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        query_filter = Filter(
            must=[FieldCondition(key="language", match=MatchValue(value=language))]
        )
    return client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=top_k,
        query_filter=query_filter,
        with_payload=True,
    )
