from __future__ import annotations

from threading import Lock

from loguru import logger

_model = None
_model_name: str | None = None
_model_lock = Lock()


def load_model(model_name: str) -> None:
    """Load the embedding model once and reuse it."""
    global _model, _model_name
    if _model is not None and _model_name == model_name:
        return

    with _model_lock:
        if _model is not None and _model_name == model_name:
            return

        logger.info(f"Loading embedding model: {model_name}")
        logger.info("This can take a minute on first import, especially with torch on Windows.")

        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(model_name)
        _model_name = model_name
        logger.info("Embedding model loaded")


def _ensure_model():
    if _model is None:
        from config import get_settings

        load_model(get_settings().embedding_model)
    return _model


def embed(text: str) -> list[float]:
    model = _ensure_model()
    return model.encode(text, normalize_embeddings=True).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    model = _ensure_model()
    return model.encode(texts, normalize_embeddings=True).tolist()
