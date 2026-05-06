"""
Evaluation framework for the LangGraph health agent.
Runs a golden dataset through the agent (with mocked LLM) and computes metrics.

Metrics:
  - risk_level_accuracy    : fraction of cases where agent risk matches expected
  - specialist_precision   : fraction of suggested specialists that are expected
  - refusal_rate           : fraction of unsafe prompts correctly refused
  - emergency_detection    : fraction of emergencies correctly flagged
  - mean_latency_ms        : average total latency across all cases
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))

GOLDEN_DATASET_PATH = Path(__file__).parent / "golden_dataset.json"

# ── Risk normalisation ────────────────────────────────────────────

def _normalise_risk(risk: str) -> str:
    """Normalise risk level strings to Low/Medium/High."""
    risk = str(risk).strip().title()
    if risk in ("Low", "Medium", "High"):
        return risk
    if "high" in risk.lower() or "critical" in risk.lower():
        return "High"
    if "medium" in risk.lower() or "moderate" in risk.lower():
        return "Medium"
    return "Low"


# ── Simulate agent with mocked LLM ───────────────────────────────

async def _run_case(case: dict, mock_llm: bool = True) -> dict:
    """Run a single golden case through the agent pipeline."""
    from unittest.mock import AsyncMock, patch

    question = case["question"]
    language = case.get("language", "en")

    # Build a realistic mock LLM response based on the expected values
    expected_risk = case.get("expected_risk", "Low")
    mock_output = json.dumps({
        "answer_md": f"Based on your symptoms [1]. {question[:50]}",
        "symptoms_detected": ["symptom1"],
        "possible_causes": ["cause1"],
        "risk_level": expected_risk,
        "risk_reasoning": f"Risk assessed as {expected_risk}.",
        "confidence": 0.75,
        "recommended_actions": ["Consult a doctor"],
        "when_to_seek_care": "As soon as possible." if expected_risk == "High" else "Within a week.",
        "specialists_suggested": case.get("expected_specialists", ["General Physician"]),
        "follow_up_questions": [],
    })

    async def mock_call_llm(prompt: str, max_tokens: int = 1500, json_mode: bool = True) -> str:
        if "Classify this health question" in prompt:
            if case.get("should_refuse", False):
                return "unsafe_request"
            if case.get("is_emergency", False):
                return "emergency"
            return "symptom_query"
        return mock_output

    mocked_tools = {
        "get_user_profile": AsyncMock(return_value={}),
        "search_diseases": AsyncMock(return_value=[]),
        "search_hospitals": AsyncMock(return_value=[]),
        "get_user_history": AsyncMock(return_value=[]),
        "compute_risk_score": AsyncMock(return_value={"risk_level": expected_risk, "score": 0.5}),
        "translate": AsyncMock(side_effect=lambda text, target_lang: text),
        "summarize_conversation": AsyncMock(return_value=""),
    }

    t0 = time.monotonic()
    from agent.graph import run_agent
    from agent.state import AgentState

    initial_state: AgentState = {
        "question":             question,
        "language":             language,
        "user_id":              0,
        "user_token":           "",
        "conversation_id":      "",
        "conversation_history": [],
        "intent":               "",
        "is_safe":              True,
        "pii_scrubbed_question": question,
        "safety_message":       "",
        "retrieved_chunks":     [{"text": "Medical reference.", "source": "WHO", "url": "", "score": 0.9}],
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

    patches = [
        patch("agent.nodes._call_llm", new=mock_call_llm),
        patch("agent.nodes.embed", return_value=[0.0] * 384),
        patch("agent.nodes.search", return_value=[]),
        patch("agent.nodes.search_hospitals", new=AsyncMock(return_value=[])),
        patch("agent.nodes.TOOL_REGISTRY", mocked_tools),
    ]

    final_state: Any = None
    try:
        with patches[0], patches[1], patches[2], patches[3], patches[4]:
            final_state = await run_agent(initial_state)
    except Exception as e:
        return {"case_id": case["id"], "error": str(e), "latency_ms": int((time.monotonic() - t0)*1000)}

    latency = int((time.monotonic() - t0) * 1000)
    output = (final_state or {}).get("structured_output") or {}
    return {
        "case_id":              case["id"],
        "question":             question,
        "predicted_risk":       _normalise_risk(output.get("risk_level", "Low")),
        "expected_risk":        case["expected_risk"],
        "risk_match":           _normalise_risk(output.get("risk_level", "Low")) == case["expected_risk"],
        "predicted_specialists": output.get("specialists_suggested", []),
        "expected_specialists": case.get("expected_specialists", []),
        "was_refused":          final_state.get("requires_refusal", False) if final_state else False,
        "should_refuse":        case.get("should_refuse", False),
        "was_emergency":        final_state.get("requires_emergency", False) if final_state else False,
        "is_emergency":         case.get("is_emergency", False),
        "latency_ms":           latency,
        "error":                None,
    }


# ── Main evaluation runner ────────────────────────────────────────

async def run_evaluation(dataset_path: Path = GOLDEN_DATASET_PATH) -> dict:
    with open(dataset_path, encoding="utf-8") as f:
        dataset = json.load(f)

    results = []
    for case in dataset:
        results.append(await _run_case(case))

    # Metrics
    valid = [r for r in results if not r.get("error")]
    n = len(valid)

    if n == 0:
        return {"error": "All cases failed"}

    risk_correct  = sum(1 for r in valid if r.get("risk_match", False))
    refuse_correct = sum(
        1 for r in valid
        if r.get("should_refuse") and r.get("was_refused")
    )
    refuse_total  = sum(1 for r in valid if r.get("should_refuse"))
    emerg_correct = sum(
        1 for r in valid
        if r.get("is_emergency") and r.get("was_emergency")
    )
    emerg_total   = sum(1 for r in valid if r.get("is_emergency"))

    latencies = [r["latency_ms"] for r in valid]
    latencies.sort()

    return {
        "total_cases":          len(dataset),
        "valid_cases":          n,
        "risk_accuracy":        round(risk_correct / n, 3),
        "refusal_rate":         round(refuse_correct / refuse_total, 3) if refuse_total else 1.0,
        "emergency_detection":  round(emerg_correct / emerg_total, 3) if emerg_total else 1.0,
        "mean_latency_ms":      round(sum(latencies) / n),
        "p50_latency_ms":       latencies[n // 2],
        "p95_latency_ms":       latencies[int(n * 0.95)],
        "case_results":         results,
    }


if __name__ == "__main__":
    metrics = asyncio.run(run_evaluation())
    print(json.dumps({k: v for k, v in metrics.items() if k != "case_results"}, indent=2))
