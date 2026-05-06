from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from config import get_settings
from routers import chat, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load heavy resources once at startup; release on shutdown."""
    settings = get_settings()

    # 1. Embedding model
    try:
        from core.embeddings import load_model
        load_model(settings.embedding_model)
    except Exception as e:
        logger.warning(f"Embedding model failed to load: {e} — fallback mode active")

    # 2. Qdrant client
    try:
        from core.vector_store import init_client
        init_client(settings)
    except Exception as e:
        logger.warning(f"Qdrant unavailable: {e} — vector search disabled")

    logger.info(f"AI service started (env={settings.app_env}, provider={settings.ai_provider})")
    yield
    logger.info("AI service shutting down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="HealthBot AI Service",
        version="1.0.0",
        description="RAG-powered health awareness AI microservice",
        lifespan=lifespan,
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Node backend is the only caller — locked down in prod via network policy
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(health.router)
    app.include_router(chat.router, prefix="/api")

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
