"""
LangGraph state machine — wires all 8 nodes with conditional routing.

Flow:
  START → intent_classifier
    → [emergency]      → emergency_response → END
    → [unsafe_request] → safety_refusal     → END
    → [other]          → safety_guard + retriever (parallel) → planner
                         → executor → synthesizer → validator → responder → END
    validator can retry synthesizer once before falling back.
"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from agent.nodes import (
    emergency_response_node,
    executor_node,
    intent_classifier_node,
    planner_node,
    responder_node,
    retriever_node,
    safety_guard_node,
    safety_refusal_node,
    synthesizer_node,
    validator_node,
)
from agent.state import AgentState


# ── Conditional edges ─────────────────────────────────────────────

def route_after_intent(state: AgentState) -> str:
    if state.get("requires_emergency"):
        return "emergency_response"
    if state.get("requires_refusal"):
        return "safety_refusal"
    return "safety_guard"


def route_after_safety(state: AgentState) -> str:
    """After safety_guard, always go to retriever."""
    return "retriever"


def route_after_validator(state: AgentState) -> str:
    """
    Retry synthesizer once if output is clearly malformed.
    Fallback to responder after 2 attempts.
    """
    output = state.get("structured_output") or {}
    attempts = state.get("synthesis_attempts") or 0

    # Valid if answer_md is non-empty and risk_level is valid
    is_valid = (
        bool(output.get("answer_md"))
        and output.get("risk_level") in ("Low", "Medium", "High")
    )

    if not is_valid and attempts < 2:
        return "synthesizer"  # retry once

    return "responder"


# ── Build graph ───────────────────────────────────────────────────

def build_graph() -> StateGraph:
    g = StateGraph(AgentState)

    # Add all nodes
    g.add_node("intent_classifier",    intent_classifier_node)
    g.add_node("safety_guard",         safety_guard_node)
    g.add_node("retriever",            retriever_node)
    g.add_node("planner",              planner_node)
    g.add_node("executor",             executor_node)
    g.add_node("synthesizer",          synthesizer_node)
    g.add_node("validator",            validator_node)
    g.add_node("responder",            responder_node)
    g.add_node("emergency_response",   emergency_response_node)
    g.add_node("safety_refusal",       safety_refusal_node)

    # Entry
    g.add_edge(START, "intent_classifier")

    # After intent — branch
    g.add_conditional_edges(
        "intent_classifier",
        route_after_intent,
        {
            "emergency_response": "emergency_response",
            "safety_refusal":     "safety_refusal",
            "safety_guard":       "safety_guard",
        },
    )

    # Emergency + refusal → done
    g.add_edge("emergency_response", END)
    g.add_edge("safety_refusal",     END)

    # Safety guard → retriever (sequential — safety result informs retrieval)
    g.add_edge("safety_guard", "retriever")

    # Main pipeline
    g.add_edge("retriever",   "planner")
    g.add_edge("planner",     "executor")
    g.add_edge("executor",    "synthesizer")
    g.add_edge("synthesizer", "validator")

    # Validator → retry or finish
    g.add_conditional_edges(
        "validator",
        route_after_validator,
        {
            "synthesizer": "synthesizer",
            "responder":   "responder",
        },
    )

    g.add_edge("responder", END)

    return g


# ── Compiled graph singleton ──────────────────────────────────────

_compiled_graph = None


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph().compile()
    return _compiled_graph


async def run_agent(initial_state: AgentState) -> AgentState:
    """Run the full agent and return the final state."""
    graph = get_graph()
    final = await graph.ainvoke(initial_state)
    return final
