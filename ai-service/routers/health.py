from fastapi import APIRouter
from loguru import logger

from config import get_settings
from schemas.assessment import HealthCheckResponse

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse, tags=["System"])
async def health_check() -> HealthCheckResponse:
    settings = get_settings()
    qdrant_status = "unknown"
    redis_status = "unknown"

    try:
        from core.vector_store import get_client
        get_client().get_collections()
        qdrant_status = "connected"
    except Exception:
        qdrant_status = "unavailable"

    try:
        import redis as redis_lib
        r = redis_lib.from_url(settings.redis_url, socket_connect_timeout=1)
        r.ping()
        redis_status = "connected"
    except Exception:
        redis_status = "unavailable"

    return HealthCheckResponse(
        status="OK",
        embedding_model=settings.embedding_model,
        qdrant=qdrant_status,
        redis=redis_status,
    )
