"""
Chat assessment endpoint.
Phase 5: delegates to the full LangGraph agent.
Phase 4 RAG kept as `_rag_fallback` in case agent errors.
"""
from __future__ import annotations

import hashlib
import json
import time
from typing import Annotated

import redis as redis_lib
from fastapi import APIRouter, Depends, Response, status
from loguru import logger

from agent.graph import run_agent
from agent.state import AgentState
from config import Settings, get_settings
from core.auth import CurrentUser
from core.embeddings import embed
from core.vector_store import search
from schemas.assessment import AssessmentRequest, AssessmentResponse, Citation

router = APIRouter(prefix="/chat", tags=["Chat"])

DISCLAIMER_EN = (
    "This information is for health awareness only and not a substitute "
    "for professional medical advice. Always consult a qualified doctor."
)
DISCLAIMER_HI = (
    "यह जानकारी केवल स्वास्थ्य जागरूकता के लिए है और पेशेवर चिकित्सा "
    "सलाह का विकल्प नहीं है।"
)


# ── Cache ─────────────────────────────────────────────────────────

def _cache_key(question: str, language: str) -> str:
    h = hashlib.sha256(f"{question}:{language}".encode()).hexdigest()[:16]
    return f"assess:{h}"


def _get_redis(settings: Settings) -> redis_lib.Redis | None:
    try:
        r = redis_lib.from_url(settings.redis_url, socket_connect_timeout=1, decode_responses=True)
        r.ping()
        return r
    except Exception:
        return None


# ── Phase 4 RAG fallback (used if agent fails) ────────────────────

def _build_prompt(question: str, context_chunks: list[dict], history: list[dict], language: str) -> str:
    lang_label = "Hindi" if language == "hi" else "English"
    sources_text = ""
    for i, chunk in enumerate(context_chunks, 1):
        sources_text += f"\n[SOURCE {i}] {chunk.get('source','?')}\n{chunk.get('text','')}\n"
    history_text = ""
    for msg in history[-6:]:
        role = "User" if msg.get("role") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('content','')}\n"
    return (
        f"You are a public health awareness assistant. Respond in {lang_label}.\n"
        f"Use ONLY provided medical sources. Do not diagnose.\n\n"
        f"MEDICAL SOURCES:{sources_text}\n\n"
        f"CONVERSATION HISTORY:\n{history_text or '(none)'}\n\n"
        f"USER QUESTION: {question}\n\n"
        f"Return JSON: answer_md, symptoms_detected, possible_causes, "
        f"risk_level, risk_reasoning, confidence, recommended_actions, "
        f"when_to_seek_care, specialists_suggested, follow_up_questions"
    )


async def _call_ai(prompt: str, settings: Settings) -> str:
    if not settings.ai_api_key or settings.ai_api_key == "replace_with_api_key":
        return ""
    if settings.ai_provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ai_api_key)
        msg = client.messages.create(
            model=settings.ai_model, max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text if msg.content else ""
    from openai import OpenAI
    client = OpenAI(api_key=settings.ai_api_key)
    resp = client.chat.completions.create(
        model=settings.ai_model, temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "Return health info as JSON."},
            {"role": "user", "content": prompt},
        ],
    )
    return resp.choices[0].message.content or ""


def _fallback_response(question: str, context_chunks: list[dict], language: str) -> dict:
    q = question.lower()
    risk = "High" if any(w in q for w in ("chest", "breath", "unconscious", "seizure", "heart attack", "stroke")) \
        else "Medium" if any(w in q for w in ("fever", "vomit", "severe", "persistent", "infection")) \
        else "Low"
    answer = "Based on available health information:\n\n"
    for i, chunk in enumerate(context_chunks[:3], 1):
        answer += f"[{i}] {chunk.get('text', '')[:200]}…\n\n"
    if not context_chunks:
        answer = "Please consult a healthcare professional for personalised advice."
    return {
        "answer_md": answer,
        "symptoms_detected": [],
        "possible_causes": [],
        "risk_level": risk,
        "risk_reasoning": "Assessed from keyword patterns in your question.",
        "confidence": 0.5,
        "recommended_actions": ["Consult a qualified doctor", "Stay hydrated", "Monitor symptoms"],
        "when_to_seek_care": "Seek immediate care if symptoms worsen rapidly.",
        "specialists_suggested": ["General Physician"],
        "follow_up_questions": [],
    }


# ── Main endpoint ─────────────────────────────────────────────────

@router.post("/assess", response_model=AssessmentResponse)
async def assess(
    body: AssessmentRequest,
    current_user: CurrentUser,
    settings: Annotated[Settings, Depends(get_settings)],
    response: Response,
    x_prompt_version: str | None = None,  # A/B testing via header
) -> AssessmentResponse:
    start = time.monotonic()

    # 1. Cache check
    cache = _get_redis(settings)
    cache_key = _cache_key(body.question, body.language)
    if cache:
        cached = cache.get(cache_key)
        if cached:
            logger.info("Cache hit", extra={"key": cache_key})
            return AssessmentResponse(**json.loads(cached))

    # 2. Build initial agent state
    prompt_version = (
        (x_prompt_version or settings.prompt_version)
        .replace("health-awareness-", "")
        .replace("health_agent_", "")
    )
    if prompt_version not in ("v1", "v2"):
        prompt_version = "v2"

    initial_state: AgentState = {
        "question":             body.question,
        "language":             body.language,
        "user_id":              current_user.get("id", 0),
        "user_token":           "",  # token not forwarded to tools for now (Phase 6)
        "conversation_id":      "",
        "conversation_history": [m.model_dump() for m in body.conversation_history],
        "intent":               "",
        "is_safe":              True,
        "pii_scrubbed_question": body.question,
        "safety_message":       "",
        "retrieved_chunks":     [],
        "planned_tools":        [],
        "tool_results":         {},
        "structured_output":    {},
        "synthesis_attempts":   0,
        "requires_emergency":   False,
        "requires_refusal":     False,
        "citations":            [],
        "prompt_version":       prompt_version,
        "error":                None,
        "latency_ms":           0,
        "node_latencies":       {},
    }

    # 3. Run agent
    parsed: dict = {}
    citations: list[Citation] = []
    try:
        final_state = await run_agent(initial_state)
        parsed    = final_state.get("structured_output") or {}
        raw_cites = final_state.get("citations") or []
        citations = [Citation(**c) for c in raw_cites if isinstance(c, dict)]
    except Exception as e:
        logger.error(f"Agent failed: {e} — using RAG fallback")
        # Phase 4 RAG fallback
        try:
            qv = embed(body.question)
            hits = search(qv, settings.collection_name, settings.top_k, body.language)
            chunks = [{**h.payload, "score": h.score} for h in hits if h.payload]
        except Exception:
            chunks = []

        prompt = _build_prompt(
            body.question, chunks,
            [m.model_dump() for m in body.conversation_history],
            body.language,
        )
        raw = await _call_ai(prompt, settings)
        if raw:
            try:
                parsed = json.loads(raw)
            except Exception:
                pass
        if not parsed:
            parsed = _fallback_response(body.question, chunks, body.language)

        citations = [
            Citation(id=i+1, source=c.get("source","?"), snippet=c.get("text","")[:180], url=c.get("url",""))
            for i, c in enumerate(chunks)
        ]

    # 4. Safe defaults
    parsed.setdefault("answer_md", "Please consult a healthcare professional.")
    parsed.setdefault("symptoms_detected", [])
    parsed.setdefault("possible_causes", [])
    parsed.setdefault("risk_level", "Low")
    parsed.setdefault("risk_reasoning", "")
    parsed.setdefault("confidence", 0.5)
    parsed.setdefault("recommended_actions", [])
    parsed.setdefault("when_to_seek_care", "")
    parsed.setdefault("specialists_suggested", [])
    parsed.setdefault("follow_up_questions", [])

    if parsed["risk_level"] not in ("Low", "Medium", "High"):
        parsed["risk_level"] = "Low"

    latency = int((time.monotonic() - start) * 1000)
    disclaimer = DISCLAIMER_HI if body.language == "hi" else DISCLAIMER_EN

    # Exclude fields we're setting explicitly to avoid duplicate keyword args
    _explicit = {"citations", "disclaimer", "prompt_version", "latency_ms"}
    result = AssessmentResponse(
        **{k: v for k, v in parsed.items() if k in AssessmentResponse.model_fields and k not in _explicit},
        citations=citations,
        disclaimer=parsed.get("disclaimer") or disclaimer,
        prompt_version=parsed.get("prompt_version") or prompt_version,
        latency_ms=latency,
    )

    # 5. Cache result
    if cache:
        try:
            cache.setex(cache_key, settings.cache_ttl_seconds, result.model_dump_json())
        except Exception:
            pass

    response.headers["X-Latency-Ms"] = str(latency)
    return result
