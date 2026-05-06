"""
Tests for the AI service RAG pipeline.
All external dependencies are mocked via conftest.py fixtures.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from tests.conftest import AUTH_HEADER, VALID_TOKEN


# ── 1. Health check ───────────────────────────────────────────────
def test_health_check_returns_200(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "OK"
    assert "embedding_model" in data


# ── 2. Auth — no token → 401 TOKEN_MISSING ────────────────────────
def test_assess_no_token_returns_401(client):
    res = client.post("/api/chat/assess", json={"question": "I have a fever"})
    assert res.status_code == 401
    detail = res.json()["detail"]
    assert detail["error"] == "TOKEN_MISSING"


# ── 3. Auth — bad token → 401 TOKEN_INVALID ───────────────────────
def test_assess_bad_token_returns_401(client):
    res = client.post(
        "/api/chat/assess",
        json={"question": "I have a fever"},
        headers={"Authorization": "Bearer not.a.real.token"},
    )
    assert res.status_code == 401
    detail = res.json()["detail"]
    assert detail["error"] == "TOKEN_INVALID"


# ── 4. Validation — question too short → 422 ─────────────────────
def test_assess_short_question_returns_422(client):
    res = client.post(
        "/api/chat/assess",
        json={"question": "hi"},
        headers=AUTH_HEADER,
    )
    assert res.status_code == 422


# ── 5. Successful RAG call — fallback (no AI key) ─────────────────
def test_assess_fallback_response_shape(client):
    """
    AI_API_KEY is set to placeholder so _call_ai returns "" → fallback fires.
    Verifies that AssessmentResponse shape is correct even without real AI.
    """
    res = client.post(
        "/api/chat/assess",
        json={"question": "I have fever and headache for two days", "language": "en"},
        headers=AUTH_HEADER,
    )
    assert res.status_code == 200
    data = res.json()

    # Required fields present
    assert isinstance(data["answer_md"], str)
    assert isinstance(data["symptoms_detected"], list)
    assert isinstance(data["possible_causes"], list)
    assert data["risk_level"] in ("Low", "Medium", "High")
    assert isinstance(data["confidence"], float)
    assert 0.0 <= data["confidence"] <= 1.0
    assert isinstance(data["recommended_actions"], list)
    assert isinstance(data["citations"], list)
    assert isinstance(data["disclaimer"], str)
    assert isinstance(data["latency_ms"], int)
    assert data["latency_ms"] >= 0

    # Response header
    assert "x-latency-ms" in res.headers


# ── 6. Successful RAG — mocked AI response ───────────────────────
def test_assess_with_mocked_ai_response(client):
    """Patches _call_ai to return a valid JSON string; verifies full parsing."""
    import json
    mock_ai_json = json.dumps({
        "answer_md": "Fever is commonly caused by viral infections [1].",
        "symptoms_detected": ["fever", "headache"],
        "possible_causes": ["viral infection", "flu"],
        "risk_level": "Medium",
        "risk_reasoning": "Fever with headache lasting 2 days warrants monitoring.",
        "confidence": 0.78,
        "recommended_actions": ["Rest", "Stay hydrated", "Monitor temperature"],
        "when_to_seek_care": "If fever exceeds 40°C or lasts more than 5 days.",
        "specialists_suggested": ["General Physician"],
        "follow_up_questions": ["Do you have any other symptoms?"],
    })

    with patch("routers.chat._call_ai", new=AsyncMock(return_value=mock_ai_json)):
        res = client.post(
            "/api/chat/assess",
            json={"question": "I have fever and headache for two days", "language": "en"},
            headers=AUTH_HEADER,
        )

    assert res.status_code == 200
    data = res.json()
    assert data["risk_level"] == "Medium"
    assert data["confidence"] == 0.78
    assert "fever" in data["symptoms_detected"]
    assert len(data["citations"]) == 2   # from the 2 fake Qdrant hits in conftest


# ── 7. Agent exception → RAG fallback fires without 500 ──────────
def test_assess_agent_exception_triggers_rag_fallback(client):
    """When run_agent raises, the router falls back to RAG without 500."""
    with (
        patch("routers.chat.run_agent", side_effect=RuntimeError("Agent crashed")),
        patch("routers.chat.embed",     return_value=[0.0] * 384),
        patch("routers.chat.search",    return_value=[]),
        patch("routers.chat._call_ai",  new=AsyncMock(return_value="")),
    ):
        res = client.post(
            "/api/chat/assess",
            json={"question": "My chest hurts when I breathe deeply", "language": "en"},
            headers=AUTH_HEADER,
        )

    assert res.status_code == 200
    data = res.json()
    # Fallback should still return valid shape
    assert data["risk_level"] in ("Low", "Medium", "High")
    assert isinstance(data["answer_md"], str)
    assert data["answer_md"] != ""


# ── 8. Hindi language → Hindi disclaimer in response ─────────────
def test_assess_hindi_disclaimer(client):
    """Router must use Hindi disclaimer when language=hi."""
    # Override mock to have empty disclaimer so router's language logic fires
    hindi_state = {
        "structured_output": {
            "answer_md": "बुखार वायरल संक्रमण के कारण हो सकता है।",
            "symptoms_detected": ["बुखार"],
            "possible_causes": ["वायरल संक्रमण"],
            "risk_level": "Medium",
            "risk_reasoning": "बुखार 2 दिनों से है।",
            "confidence": 0.7,
            "recommended_actions": ["आराम करें"],
            "when_to_seek_care": "अगर बुखार 40°C से अधिक हो।",
            "specialists_suggested": ["सामान्य चिकित्सक"],
            "follow_up_questions": [],
            "disclaimer": "",  # empty — lets the router pick the right language
            "prompt_version": "v2",
            "latency_ms": 42,
        },
        "citations": [],
        "requires_emergency": False,
        "requires_refusal":   False,
        "intent":             "symptom_query",
        "node_latencies":     {},
    }
    with patch("routers.chat.run_agent", new=AsyncMock(return_value=hindi_state)):
        res = client.post(
            "/api/chat/assess",
            json={"question": "मुझे बुखार और सिरदर्द है", "language": "hi"},
            headers=AUTH_HEADER,
        )
    assert res.status_code == 200
    data = res.json()
    assert "चिकित्सा" in data["disclaimer"] or "जानकारी" in data["disclaimer"]


# ── 9. Conversation history is accepted ──────────────────────────
def test_assess_with_conversation_history(client):
    history = [
        {"role": "user", "content": "I have been having headaches"},
        {"role": "assistant", "content": "How long have you had the headaches?"},
    ]
    res = client.post(
        "/api/chat/assess",
        json={
            "question": "The headaches started 3 days ago with fever",
            "language": "en",
            "conversation_history": history,
        },
        headers=AUTH_HEADER,
    )
    assert res.status_code == 200
    assert res.json()["risk_level"] in ("Low", "Medium", "High")
