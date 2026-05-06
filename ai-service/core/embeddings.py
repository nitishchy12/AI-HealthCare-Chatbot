from __future__ import annotations

from loguru import logger

_model = None


def load_model(model_name: str) -> None:
    """Load the embedding model once at startup via lifespan."""
    global _model
    from sentence_transformers import SentenceTransformer
    logger.info(f"Loading embedding model: {model_name}")
    _model = SentenceTransformer(model_name)
    logger.info("Embedding model loaded")


def embed(text: str) -> list[float]:
    if _model is None:
        raise RuntimeError("Embedding model not loaded — call load_model() at startup")
    return _model.encode(text, normalize_embeddings=True).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    if _model is None:
        raise RuntimeError("Embedding model not loaded")
    return _model.encode(texts, normalize_embeddings=True).tolist()
