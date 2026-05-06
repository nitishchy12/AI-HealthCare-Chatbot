from __future__ import annotations

from typing import Any
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    # ── Input ─────────────────────────────────────────────────────
    question: str
    language: str                    # "en" | "hi"
    user_id: int
    user_token: str                  # Bearer token forwarded to Node tool calls
    conversation_id: str
    conversation_history: list[dict] # [{role, content}, ...]

    # ── Intent classification ─────────────────────────────────────
    intent: str                      # symptom_query | general_health_question |
                                     # medication_query | emergency | follow_up |
                                     # small_talk | unsafe_request

    # ── Safety ───────────────────────────────────────────────────
    is_safe: bool
    pii_scrubbed_question: str
    safety_message: str              # crisis message if self-harm detected

    # ── Retrieval ─────────────────────────────────────────────────
    retrieved_chunks: list[dict]     # [{text, source, url, score}, ...]

    # ── Planning & Execution ──────────────────────────────────────
    planned_tools: list[dict]        # [{"tool": str, "args": dict}, ...]
    tool_results: dict[str, Any]     # {tool_name: result}

    # ── Synthesis ─────────────────────────────────────────────────
    structured_output: dict[str, Any]
    synthesis_attempts: int          # validator retry counter

    # ── Output flags ──────────────────────────────────────────────
    requires_emergency: bool
    requires_refusal: bool
    citations: list[dict]

    # ── Metadata ──────────────────────────────────────────────────
    prompt_version: str
    error: str | None
    latency_ms: int
    node_latencies: dict[str, int]   # per-node timing for observability
