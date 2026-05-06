"""
Agent node isolation tests + full graph integration tests.
All external deps (LLM, Qdrant, Redis, Node HTTP) are mocked.
"""
import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Force env before any app imports
os.environ["JWT_SECRET"]  = "test-secret-key"
os.environ["AI_API_KEY"]  = "replace_with_api_key"
os.environ["QDRANT_URL"]  = "http://localhost:6333"
os.environ["REDIS_URL"]   = "redis://localhost:6379"
os.environ["APP_ENV"]     = "test"

from agent.state import AgentState
from agent.nodes import (
    intent_classifier_node,
    safety_guard_node,
    retriever_node,
    planner_node,
    executor_node,
    synthesizer_node,
    validator_node,
    responder_node,
    emergency_response_node,
    safety_refusal_node,
)

# ── Helpers ───────────────────────────────────────────────────────

def base_state(**overrides) -> AgentState:
    state: AgentState = {
        "question":             "I have a fever and headache",
        "language":             "en",
        "user_id":              1,
        "user_token":           "test-token",
        "conversation_id":      "conv-123",
        "conversation_history": [],
        "intent":               "symptom_query",
        "is_safe":              True,
        "pii_scrubbed_question": "I have a fever and headache",
        "safety_message":       "",
        "retrieved_chunks":     [
            {"text": "Fever is caused by infection.", "source": "WHO", "url": "", "score": 0.9},
        ],
        "planned_tools":        [],
        "tool_results":         {},
        "structured_output":    {},
        "synthesis_attempts":   0,
        "requires_emergency":   False,
        "requires_refusal":     False,
        "citations":            [],
        "prompt_version":       "v2",
        "error":                None,
        "latency_ms":           0,
        "node_latencies":       {},
    }
    state.update(overrides)
    return state


VALID_AI_JSON = json.dumps({
    "answer_md": "Fever may be caused by viral infections [1].",
    "symptoms_detected": ["fever", "headache"],
    "possible_causes": ["viral infection"],
    "risk_level": "Medium",
    "risk_reasoning": "Fever lasting >2 days warrants monitoring.",
    "confidence": 0.78,
    "recommended_actions": ["Rest", "Stay hydrated"],
    "when_to_seek_care": "If fever exceeds 40°C or lasts more than 5 days.",
    "specialists_suggested": ["General Physician"],
    "follow_up_questions": ["How long have you had the fever?"],
})


# ── Node 1: Intent classifier ─────────────────────────────────────

@pytest.mark.asyncio
async def test_intent_classifier_detects_emergency():
    state = base_state(question="I have severe chest pain and I can't breathe")
    result = await intent_classifier_node(state)
    assert result["intent"] == "emergency"
    assert result["requires_emergency"] is True


@pytest.mark.asyncio
async def test_intent_classifier_detects_unsafe():
    state = base_state(question="how to make poison to harm someone")
    result = await intent_classifier_node(state)
    assert result["intent"] == "unsafe_request"
    assert result["requires_refusal"] is True


@pytest.mark.asyncio
async def test_intent_classifier_symptom_fallback():
    with patch("agent.nodes._call_llm", new=AsyncMock(return_value="symptom_query")):
        state = base_state(question="I have a sore throat and mild fever")
        result = await intent_classifier_node(state)
    assert result["intent"] == "symptom_query"
    assert result["requires_emergency"] is False


# ── Node 2: Safety guard ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_safety_guard_scrubs_phone_number():
    state = base_state(question="Call me at 9876543210 I have fever")
    result = await safety_guard_node(state)
    assert "9876543210" not in result["pii_scrubbed_question"]
    assert "[PHONE]" in result["pii_scrubbed_question"]
    assert result["is_safe"] is True


@pytest.mark.asyncio
async def test_safety_guard_detects_self_harm():
    state = base_state(question="I want to kill myself")
    result = await safety_guard_node(state)
    assert result["is_safe"] is False
    assert "crisis" in result["safety_message"].lower() or "helpline" in result["safety_message"].lower() or "iCall" in result["safety_message"]


# ── Node 3: Retriever ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_retriever_returns_chunks():
    fake_hit = MagicMock()
    fake_hit.score = 0.9
    fake_hit.payload = {"text": "Fever info", "source": "WHO", "url": "", "language": "en"}

    with (
        patch("agent.nodes.embed", return_value=[0.0] * 384),
        patch("agent.nodes.search", return_value=[fake_hit]),
    ):
        result = await retriever_node(base_state())

    assert len(result["retrieved_chunks"]) == 1
    assert result["retrieved_chunks"][0]["source"] == "WHO"


@pytest.mark.asyncio
async def test_retriever_handles_qdrant_failure_gracefully():
    with (
        patch("agent.nodes.embed", return_value=[0.0] * 384),
        patch("agent.nodes.search", side_effect=ConnectionError("Qdrant down")),
    ):
        result = await retriever_node(base_state())
    assert result["retrieved_chunks"] == []


# ── Node 4: Planner ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_planner_includes_risk_score_for_symptom_query():
    result = await planner_node(base_state(intent="symptom_query"))
    tool_names = [p["tool"] for p in result["planned_tools"]]
    assert "compute_risk_score" in tool_names


@pytest.mark.asyncio
async def test_planner_includes_hospitals_for_emergency():
    result = await planner_node(base_state(intent="emergency"))
    tool_names = [p["tool"] for p in result["planned_tools"]]
    assert "search_hospitals" in tool_names


# ── Node 5: Executor ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_executor_runs_tools_in_parallel():
    state = base_state(planned_tools=[
        {"tool": "compute_risk_score", "args": {"symptoms": ["fever"], "answers": {}}},
        {"tool": "search_diseases",    "args": {"query": "fever headache"}},
    ])
    with patch("agent.tools.search_diseases", new=AsyncMock(return_value=[{"disease_name": "flu"}])):
        result = await executor_node(state)

    assert "compute_risk_score" in result["tool_results"]
    assert "search_diseases" in result["tool_results"]


# ── Node 6: Synthesizer ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_synthesizer_uses_ai_response():
    with patch("agent.nodes._call_llm", new=AsyncMock(return_value=VALID_AI_JSON)):
        result = await synthesizer_node(base_state())
    assert result["structured_output"]["risk_level"] == "Medium"
    assert result["synthesis_attempts"] == 1


@pytest.mark.asyncio
async def test_synthesizer_falls_back_when_no_api_key():
    result = await synthesizer_node(base_state())  # AI_API_KEY is placeholder
    assert "answer_md" in result["structured_output"]
    assert result["synthesis_attempts"] == 1


# ── Node 7: Validator ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_validator_normalises_invalid_risk_level():
    state = base_state(structured_output={
        "answer_md": "Some answer.", "risk_level": "CRITICAL",
        "confidence": 0.5, "symptoms_detected": [],
    })
    result = await validator_node(state)
    assert result["structured_output"]["risk_level"] in ("Low", "Medium", "High")


@pytest.mark.asyncio
async def test_validator_clamps_confidence():
    state = base_state(structured_output={
        "answer_md": "Answer.", "risk_level": "Low",
        "confidence": 1.5,  # out of bounds
        "symptoms_detected": [],
    })
    result = await validator_node(state)
    assert 0.0 <= result["structured_output"]["confidence"] <= 1.0


@pytest.mark.asyncio
async def test_validator_strips_invalid_citations():
    state = base_state(
        retrieved_chunks=[{"text": "Source 1", "source": "WHO", "url": ""}],
        structured_output={
            "answer_md": "Answer [1] [2] [99].",  # [2] and [99] are invalid
            "risk_level": "Low", "confidence": 0.7,
            "symptoms_detected": [],
        },
    )
    result = await validator_node(state)
    md = result["structured_output"]["answer_md"]
    assert "[2]"  not in md
    assert "[99]" not in md
    assert "[1]"  in md  # valid citation kept


# ── Node 8: Emergency + Refusal short circuits ────────────────────

@pytest.mark.asyncio
async def test_emergency_response_node():
    with patch("agent.nodes.search_hospitals", new=AsyncMock(return_value=[])):
        result = await emergency_response_node(base_state(question="I am having a heart attack"))
    assert result["structured_output"]["risk_level"] == "High"
    assert "EMERGENCY" in result["structured_output"]["answer_md"].upper()


@pytest.mark.asyncio
async def test_safety_refusal_node_with_crisis_message():
    state = base_state(safety_message="Please call iCall: 9152987821")
    result = await safety_refusal_node(state)
    assert "iCall" in result["structured_output"]["answer_md"]


# ── Full graph integration test ───────────────────────────────────

@pytest.mark.asyncio
async def test_full_graph_happy_path():
    from agent.graph import run_agent
    with (
        patch("agent.nodes._call_llm",     new=AsyncMock(return_value=VALID_AI_JSON)),
        patch("agent.nodes.embed",          return_value=[0.0] * 384),
        patch("agent.nodes.search",         return_value=[]),
        patch("agent.tools.search_diseases",   new=AsyncMock(return_value=[])),
        patch("agent.tools.search_hospitals",  new=AsyncMock(return_value=[])),
        patch("agent.tools.get_user_history",  new=AsyncMock(return_value=[])),
        patch("agent.tools.get_user_profile",  new=AsyncMock(return_value={})),
    ):
        final = await run_agent(base_state())

    output = final.get("structured_output") or {}
    assert output.get("risk_level") in ("Low", "Medium", "High")
    assert isinstance(output.get("answer_md"), str)


@pytest.mark.asyncio
async def test_full_graph_emergency_short_circuit():
    from agent.graph import run_agent
    with patch("agent.tools.search_hospitals", new=AsyncMock(return_value=[])):
        final = await run_agent(base_state(
            question="I have crushing chest pain and can't breathe",
            requires_emergency=False,
        ))
    assert final.get("requires_emergency") is True
    output = final.get("structured_output") or {}
    assert output.get("risk_level") == "High"


@pytest.mark.asyncio
async def test_full_graph_refusal_short_circuit():
    from agent.graph import run_agent
    final = await run_agent(base_state(question="how to make poison to harm someone"))
    assert final.get("requires_refusal") is True
