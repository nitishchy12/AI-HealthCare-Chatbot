"""
All 8 LangGraph agent nodes.
Each node receives AgentState and returns a dict of updated state keys.
"""
from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any

from loguru import logger

from agent.state import AgentState
from agent.tools import (
    TOOL_REGISTRY,
    compute_risk_score,
    search_hospitals,
)
from config import get_settings
from core.embeddings import embed
from core.vector_store import search
from prompts import get_active_version, load_prompt
from schemas.assessment import AssessmentResponse

# ── Helpers ───────────────────────────────────────────────────────

EMERGENCY_KEYWORDS = {
    "heart attack", "chest pain", "can't breathe", "cannot breathe",
    "difficulty breathing", "stroke", "unconscious", "seizure",
    "severe bleeding", "anaphylaxis", "suicide attempt", "overdose",
}

UNSAFE_KEYWORDS = {
    "how to make poison", "how to harm", "how to kill", "drug synthesis",
    "how to overdose on purpose",
}

SELF_HARM_KEYWORDS = {
    "want to die", "kill myself", "end my life", "suicide",
    "self-harm", "cut myself", "hurt myself",
}

DIAGNOSIS_CLAIM_PATTERNS = [
    r"\byou (definitely|certainly|surely) have\b",
    r"\bdiagnosed with\b",
    r"\byou are suffering from\b",
]

CRISIS_HOTLINES = (
    "🆘 **You are not alone.** Please reach out:\n"
    "- **iCall (India):** 9152987821\n"
    "- **Vandrevala Foundation:** 1860-2662-345\n"
    "- **Emergency:** 112\n\n"
    "Your life matters. Please talk to someone who can help."
)


def _has_keyword(text: str, keywords: set[str]) -> bool:
    t = text.lower()
    return any(kw in t for kw in keywords)


async def _call_llm(prompt: str, max_tokens: int = 1500, json_mode: bool = True) -> str:
    settings = get_settings()
    if not settings.ai_api_key or settings.ai_api_key == "replace_with_api_key":
        return ""

    if settings.ai_provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=settings.ai_api_key)
        msg = client.messages.create(
            model=settings.ai_model, max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text if msg.content else ""
    else:
        from openai import OpenAI
        client = OpenAI(api_key=settings.ai_api_key)
        kwargs: dict[str, Any] = {
            "model": settings.ai_model,
            "temperature": 0.2,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": "You are a health awareness assistant. Return JSON only."},
                {"role": "user", "content": prompt},
            ],
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content or ""


def _format_sources(chunks: list[dict]) -> str:
    if not chunks:
        return "(No specific sources retrieved)"
    return "\n".join(
        f"[{i+1}] {c.get('source','?')} — {c.get('text','')[:300]}"
        for i, c in enumerate(chunks)
    )


def _format_history(history: list[dict]) -> str:
    if not history:
        return "(No prior conversation)"
    return "\n".join(
        f"{m.get('role','?').upper()}: {m.get('content','')[:150]}"
        for m in history[-6:]
    )


def _format_tool_results(results: dict) -> str:
    if not results:
        return "(No tool results)"
    parts = []
    for tool, data in results.items():
        parts.append(f"[{tool}]: {json.dumps(data, default=str)[:400]}")
    return "\n".join(parts)


# ── Node 1: INTENT_CLASSIFIER ─────────────────────────────────────

async def intent_classifier_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    question = state.get("question", "")

    # Rule-based fast path (no LLM cost for obvious cases)
    if _has_keyword(question, EMERGENCY_KEYWORDS):
        intent = "emergency"
    elif _has_keyword(question, UNSAFE_KEYWORDS):
        intent = "unsafe_request"
    elif _has_keyword(question, SELF_HARM_KEYWORDS):
        intent = "unsafe_request"
    else:
        intent_prompt = (
            f"Classify this health question into exactly one category:\n"
            f"symptom_query | general_health_question | medication_query | "
            f"emergency | follow_up | small_talk | unsafe_request\n\n"
            f"Question: {question}\n\n"
            f"Reply with only the category name, nothing else."
        )
        raw = await _call_llm(intent_prompt, max_tokens=20, json_mode=False)
        raw = raw.strip().lower()
        valid = {"symptom_query","general_health_question","medication_query",
                 "emergency","follow_up","small_talk","unsafe_request"}
        intent = raw if raw in valid else "symptom_query"

    latencies = dict(state.get("node_latencies") or {})
    latencies["intent_classifier"] = int((time.monotonic() - t0) * 1000)

    logger.info(f"Intent classified: {intent}")
    return {
        "intent": intent,
        "requires_emergency": intent == "emergency",
        "requires_refusal":   intent == "unsafe_request",
        "pii_scrubbed_question": question,  # updated by safety_guard
        "node_latencies": latencies,
    }


# ── Node 2: SAFETY_GUARD ──────────────────────────────────────────

async def safety_guard_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    question = state.get("question", "")

    # PII scrubbing (regex-only mode — no presidio ML models needed in dev)
    scrubbed = re.sub(r"\b\d{10}\b", "[PHONE]", question)
    scrubbed = re.sub(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[EMAIL]", scrubbed)
    scrubbed = re.sub(r"\b\d{12}\b", "[ID]", scrubbed)  # Aadhaar-like

    is_safe = True
    safety_message = ""

    if _has_keyword(question, SELF_HARM_KEYWORDS):
        is_safe = False
        safety_message = CRISIS_HOTLINES

    latencies = dict(state.get("node_latencies") or {})
    latencies["safety_guard"] = int((time.monotonic() - t0) * 1000)

    return {
        "is_safe": is_safe,
        "pii_scrubbed_question": scrubbed,
        "safety_message": safety_message,
        "node_latencies": latencies,
    }


# ── Node 3: RETRIEVER ─────────────────────────────────────────────

async def retriever_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    question = state.get("pii_scrubbed_question") or state.get("question", "")
    language = state.get("language", "en")
    settings = get_settings()

    chunks: list[dict] = []
    try:
        query_vector = embed(question)
        hits = search(
            query_vector=query_vector,
            collection_name=settings.collection_name,
            top_k=settings.top_k,
            language=language,
        )
        chunks = [
            {**hit.payload, "score": hit.score}
            for hit in hits
            if hit.payload
        ]
    except Exception as e:
        logger.warning(f"Retriever failed: {e}")

    latencies = dict(state.get("node_latencies") or {})
    latencies["retriever"] = int((time.monotonic() - t0) * 1000)

    logger.info(f"Retrieved {len(chunks)} chunks")
    return {"retrieved_chunks": chunks, "node_latencies": latencies}


# ── Node 4: PLANNER ───────────────────────────────────────────────

async def planner_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    intent   = state.get("intent", "symptom_query")
    question = state.get("pii_scrubbed_question") or state.get("question", "")
    q_lower  = question.lower()

    planned: list[dict] = [
        {"tool": "get_user_profile", "args": {"user_token": state.get("user_token", "")}},
    ]

    if intent in ("symptom_query", "emergency", "follow_up"):
        planned.append({"tool": "search_diseases", "args": {"query": question[:200]}})
        planned.append({"tool": "compute_risk_score", "args": {
            "symptoms": _extract_symptom_keywords(q_lower),
            "answers": {},
        }})

    if intent == "emergency" or any(w in q_lower for w in ("hospital", "doctor", "clinic", "specialist")):
        planned.append({"tool": "search_hospitals", "args": {
            "city": "",
            "specialty": _infer_specialty(q_lower),
        }})

    if state.get("conversation_history"):
        planned.append({"tool": "get_user_history", "args": {
            "user_token": state.get("user_token", ""),
            "days": 7,
        }})

    latencies = dict(state.get("node_latencies") or {})
    latencies["planner"] = int((time.monotonic() - t0) * 1000)

    logger.info(f"Planned tools: {[p['tool'] for p in planned]}")
    return {"planned_tools": planned, "node_latencies": latencies}


def _extract_symptom_keywords(text: str) -> list[str]:
    symptom_words = [
        "fever","cough","headache","chest pain","breathing","vomiting",
        "stomach pain","fatigue","dizziness","rash","nausea","diarrhea",
    ]
    return [w for w in symptom_words if w in text]


def _infer_specialty(text: str) -> str:
    if any(w in text for w in ("chest","heart","cardiac")):
        return "Cardiologist"
    if any(w in text for w in ("breathing","lung","asthma","cough")):
        return "Pulmonologist"
    if any(w in text for w in ("head","brain","neuro","migraine")):
        return "Neurologist"
    return "General Physician"


# ── Node 5: EXECUTOR ──────────────────────────────────────────────

async def executor_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    planned = state.get("planned_tools") or []

    async def _run_tool(plan: dict) -> tuple[str, Any]:
        tool_fn = TOOL_REGISTRY.get(plan["tool"])
        if not tool_fn:
            return plan["tool"], None
        try:
            result = await tool_fn(**plan["args"])
            return plan["tool"], result
        except Exception as e:
            logger.warning(f"Tool {plan['tool']} failed: {e}")
            return plan["tool"], None

    results_list = await asyncio.gather(*[_run_tool(p) for p in planned])
    tool_results = {name: val for name, val in results_list if val is not None}

    latencies = dict(state.get("node_latencies") or {})
    latencies["executor"] = int((time.monotonic() - t0) * 1000)

    logger.info(f"Executed {len(tool_results)} tools: {list(tool_results.keys())}")
    return {"tool_results": tool_results, "node_latencies": latencies}


# ── Node 6: SYNTHESIZER ───────────────────────────────────────────

async def synthesizer_node(state: AgentState) -> dict:
    t0 = time.monotonic()

    prompt_version = state.get("prompt_version") or get_active_version()
    template = load_prompt(prompt_version)

    lang_label = "Hindi" if state.get("language") == "hi" else "English"
    prompt = template.format(
        LANGUAGE=lang_label,
        SOURCES=_format_sources(state.get("retrieved_chunks") or []),
        HISTORY=_format_history(state.get("conversation_history") or []),
        TOOL_RESULTS=_format_tool_results(state.get("tool_results") or {}),
        QUESTION=state.get("pii_scrubbed_question") or state.get("question", ""),
    )

    raw = await _call_llm(prompt, max_tokens=1500)
    parsed: dict = {}
    if raw:
        try:
            parsed = json.loads(raw)
        except Exception:
            logger.warning("Synthesizer LLM returned non-JSON — validator will handle")

    # Fallback if no API key / parse failure
    if not parsed:
        from routers.chat import _fallback_response
        parsed = _fallback_response(
            state.get("question", ""),
            state.get("retrieved_chunks") or [],
            state.get("language", "en"),
        )

    latencies = dict(state.get("node_latencies") or {})
    latencies["synthesizer"] = int((time.monotonic() - t0) * 1000)

    attempts = (state.get("synthesis_attempts") or 0) + 1
    return {
        "structured_output": parsed,
        "synthesis_attempts": attempts,
        "prompt_version": prompt_version,
        "node_latencies": latencies,
    }


# ── Node 7: VALIDATOR ─────────────────────────────────────────────

async def validator_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    output = state.get("structured_output") or {}
    chunks = state.get("retrieved_chunks") or []

    # 1. Required fields present
    required = ["answer_md","symptoms_detected","possible_causes","risk_level","confidence"]
    for field in required:
        if field not in output:
            output[field] = "" if field in ("answer_md","risk_level","risk_reasoning") else []

    # 2. Enforce valid risk_level
    if output.get("risk_level") not in ("Low", "Medium", "High"):
        output["risk_level"] = "Low"

    # 3. Enforce confidence bounds
    try:
        output["confidence"] = max(0.0, min(1.0, float(output.get("confidence", 0.5))))
    except (TypeError, ValueError):
        output["confidence"] = 0.5

    # 4. Hallucination check: citations in answer must trace to retrieved chunks
    answer_md = output.get("answer_md", "")
    cited_ids  = set(re.findall(r"\[(\d+)\]", answer_md))
    valid_ids  = {str(i + 1) for i in range(len(chunks))}
    invalid    = cited_ids - valid_ids
    if invalid:
        # Strip invalid citations — don't regenerate, just clean
        for cid in invalid:
            answer_md = answer_md.replace(f"[{cid}]", "")
        output["answer_md"] = answer_md

    # 5. Refusal check — model must not claim diagnosis certainty
    for pat in DIAGNOSIS_CLAIM_PATTERNS:
        if re.search(pat, answer_md, re.IGNORECASE):
            # Attempt to soften the claim
            answer_md = re.sub(
                pat,
                lambda m: m.group(0).replace("definitely", "possibly").replace("certainly", "possibly"),
                answer_md, flags=re.IGNORECASE,
            )
            output["answer_md"] = answer_md

    latencies = dict(state.get("node_latencies") or {})
    latencies["validator"] = int((time.monotonic() - t0) * 1000)

    return {"structured_output": output, "node_latencies": latencies}


# ── Node 8: RESPONDER ─────────────────────────────────────────────

async def responder_node(state: AgentState) -> dict:
    t0 = time.monotonic()
    output  = state.get("structured_output") or {}
    chunks  = state.get("retrieved_chunks") or []

    citations = [
        {
            "id": i + 1,
            "source": c.get("source", "Medical Reference"),
            "snippet": c.get("text", "")[:180],
            "url": c.get("url", ""),
        }
        for i, c in enumerate(chunks)
    ]

    DISCLAIMER_EN = "⚠️ This is health awareness information only. Consult a qualified healthcare provider for medical advice."
    DISCLAIMER_HI = "⚠️ यह केवल स्वास्थ्य जागरूकता जानकारी है। चिकित्सीय सलाह के लिए किसी योग्य स्वास्थ्य सेवा प्रदाता से परामर्श करें।"
    disclaimer = DISCLAIMER_HI if state.get("language") == "hi" else DISCLAIMER_EN

    total_latency = sum((state.get("node_latencies") or {}).values())
    latencies = dict(state.get("node_latencies") or {})
    latencies["responder"] = int((time.monotonic() - t0) * 1000)

    logger.info(
        "Agent complete",
        extra={
            "risk": output.get("risk_level"),
            "confidence": output.get("confidence"),
            "total_latency_ms": total_latency,
            "tools_used": list((state.get("tool_results") or {}).keys()),
            "intent": state.get("intent"),
        }
    )

    return {
        "citations": citations,
        "structured_output": {
            **output,
            "disclaimer": disclaimer,
            "prompt_version": state.get("prompt_version", ""),
            "latency_ms": total_latency,
        },
        "node_latencies": latencies,
    }


# ── Special nodes: EMERGENCY + SAFETY_REFUSAL ─────────────────────

async def emergency_response_node(state: AgentState) -> dict:
    q = state.get("question", "").lower()
    specialty = _infer_specialty(q)

    hospitals: list[dict] = []
    try:
        hospitals = await search_hospitals(city="", specialty=specialty)
    except Exception:
        pass

    output = {
        "answer_md": (
            "🚨 **EMERGENCY — Seek immediate medical care.**\n\n"
            "Call **112** (India) or go to your nearest emergency room immediately.\n\n"
            "Do not wait. Do not drive yourself if you feel unwell."
        ),
        "symptoms_detected": [],
        "possible_causes":   [],
        "risk_level":        "High",
        "risk_reasoning":    "Emergency keywords detected — immediate care required.",
        "confidence":        0.99,
        "recommended_actions": ["Call 112 immediately", "Go to nearest emergency room", "Do not delay"],
        "when_to_seek_care": "RIGHT NOW — this is an emergency.",
        "specialists_suggested": [specialty],
        "follow_up_questions": [],
        "disclaimer": "Call emergency services immediately.",
        "prompt_version": state.get("prompt_version", ""),
        "latency_ms": 0,
    }

    return {
        "structured_output": output,
        "citations": [],
        "tool_results": {"search_hospitals": hospitals},
    }


async def safety_refusal_node(state: AgentState) -> dict:
    safety_msg = state.get("safety_message", "")

    if safety_msg:
        answer = safety_msg
    else:
        answer = (
            "I'm not able to help with that request. "
            "If you're in distress, please reach out to a mental health professional or emergency services."
        )

    output = {
        "answer_md": answer,
        "symptoms_detected": [],
        "possible_causes":   [],
        "risk_level":        "High",
        "risk_reasoning":    "Request flagged by safety guard.",
        "confidence":        1.0,
        "recommended_actions": ["Seek professional help", "Call a crisis helpline"],
        "when_to_seek_care": "Immediately if you are in danger.",
        "specialists_suggested": ["Mental Health Professional"],
        "follow_up_questions": [],
        "disclaimer": "If you are in immediate danger, call 112.",
        "prompt_version": state.get("prompt_version", ""),
        "latency_ms": 0,
    }

    return {"structured_output": output, "citations": []}
