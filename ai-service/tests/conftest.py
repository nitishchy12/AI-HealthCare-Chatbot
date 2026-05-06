"""
Shared fixtures for ai-service tests.
All external deps (embeddings, Qdrant, Redis, AI provider) are mocked
so tests run fully offline without any infrastructure.
"""
import json
import sys
import os

# Force-set all env vars BEFORE any app module is imported.
# Using os.environ[] not setdefault so CLI env vars don't bleed in.
os.environ["JWT_SECRET"]  = "test-secret-key"
os.environ["AI_API_KEY"]  = "replace_with_api_key"   # triggers fallback path
os.environ["QDRANT_URL"]  = "http://localhost:6333"
os.environ["REDIS_URL"]   = "redis://localhost:6379"
os.environ["APP_ENV"]     = "test"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from jose import jwt as _jwt

TEST_SECRET = "test-secret-key"


def make_token(user_id: int = 1, role: str = "user") -> str:
    return _jwt.encode(
        {"id": user_id, "email": "test@example.com", "role": role},
        TEST_SECRET,
        algorithm="HS256",
    )


VALID_TOKEN  = make_token(1, "user")
ADMIN_TOKEN  = make_token(99, "admin")
AUTH_HEADER  = {"Authorization": f"Bearer {VALID_TOKEN}"}
ADMIN_HEADER = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


# ── Fake Qdrant hits ──────────────────────────────────────────────
def _fake_hits():
    h1 = MagicMock()
    h1.score = 0.91
    h1.payload = {
        "text": "Fever is caused by viral or bacterial infections. Rest and fluids recommended.",
        "source": "WHO Health Topics",
        "topic": "fever",
        "url": "https://www.who.int",
        "language": "en",
    }
    h2 = MagicMock()
    h2.score = 0.85
    h2.payload = {
        "text": "Paracetamol reduces fever. Seek care if fever exceeds 40°C.",
        "source": "NHS Fever Guide",
        "topic": "fever",
        "url": "https://www.nhs.uk",
        "language": "en",
    }
    return [h1, h2]


# ── Shared mock objects ───────────────────────────────────────────
_mock_embed_result = MagicMock()
_mock_embed_result.tolist = lambda: [0.0] * 384


@pytest.fixture
def client():
    """
    FastAPI TestClient with ALL external deps patched:
    - load_model / init_client → no-ops (don't overwrite module vars)
    - embed / embed_batch      → return zero-vectors
    - search                   → return two fake Qdrant hits
    - Redis                    → no-op (cache miss always)
    """
    # Invalidate settings cache so force-set env vars are picked up
    from config import get_settings
    get_settings.cache_clear()

    # Pre-baked agent final state returned by mocked run_agent
    _mock_final_state = {
        "structured_output": {
            "answer_md": "Fever may be caused by viral infections [1].",
            "symptoms_detected": ["fever"],
            "possible_causes": ["viral infection"],
            "risk_level": "Medium",
            "risk_reasoning": "Fever lasting >2 days warrants monitoring.",
            "confidence": 0.78,
            "recommended_actions": ["Rest", "Stay hydrated"],
            "when_to_seek_care": "If fever exceeds 40°C.",
            "specialists_suggested": ["General Physician"],
            "follow_up_questions": ["How long have you had the fever?"],
            "disclaimer": "For awareness only.",
            "prompt_version": "v2",
            "latency_ms": 42,
        },
        "citations": [
            {"id": 1, "source": "WHO Health Topics", "snippet": "Fever info.", "url": "https://who.int"},
            {"id": 2, "source": "NHS Fever Guide",   "snippet": "More fever info.", "url": "https://nhs.uk"},
        ],
        "requires_emergency": False,
        "requires_refusal":   False,
        "intent":             "symptom_query",
        "node_latencies":     {},
    }

    with (
        # Prevent lifespan from loading real model / connecting to Qdrant
        patch("core.embeddings.load_model", return_value=None),
        patch("core.vector_store.init_client", return_value=None),

        # Patch run_agent at the router level — endpoint tests verify router logic,
        # not agent internals (those are covered by test_agent.py)
        patch("routers.chat.run_agent", new=AsyncMock(return_value=_mock_final_state)),

        # Redis: always miss so we exercise the full pipeline
        patch("routers.chat._get_redis", return_value=None),
    ):
        from main import app
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c
