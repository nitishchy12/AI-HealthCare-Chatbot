from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── JWT (shared secret with Node backend) ──────────────────────
    jwt_secret: str                      # required — no default, fails at startup if missing
    jwt_algorithm: str = "HS256"

    # ── AI Provider ────────────────────────────────────────────────
    ai_provider: str = "openai"          # "openai" | "anthropic"
    ai_api_key: str                      # required — no default, fails at startup if missing
    ai_model: str = "gpt-4o-mini"

    # ── Vector DB ──────────────────────────────────────────────────
    qdrant_url: str = "http://localhost:6333"
    collection_name: str = "medical_knowledge"
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dim: int = 384
    load_embedding_on_startup: bool = False
    top_k: int = 5

    # ── Redis ──────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 300          # 5 minutes

    # ── Node backend URL (for tool HTTP calls) ─────────────────────
    node_url: str = "http://localhost:5004"

    # ── Prompts ────────────────────────────────────────────────────
    prompt_version: str = "health-awareness-v2"

    # ── Service ────────────────────────────────────────────────────
    app_env: str = "development"
    port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings()
