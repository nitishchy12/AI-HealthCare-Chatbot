"""
Agent tools — each is an async function.
All external calls go through the Node backend REST API (user token forwarded)
or are pure-Python computations.
Tool results are cached in Redis with a 5-minute TTL.
"""
from __future__ import annotations

import functools
import hashlib
import json
from typing import Any, Callable

import httpx
from loguru import logger

from config import get_settings

# ── Tool cache decorator ──────────────────────────────────────────

def tool_with_cache(ttl: int = 300):
    """Cache tool results in Redis. No-op if Redis unavailable."""
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            try:
                import redis as redis_lib
                settings = get_settings()
                r = redis_lib.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=1)
                key = f"tool:{fn.__name__}:{_hash(args, kwargs)}"
                cached = r.get(key)
                if cached:
                    logger.debug(f"Tool cache hit: {fn.__name__}")
                    return json.loads(cached)
            except Exception:
                r = None
                key = None

            result = await fn(*args, **kwargs)

            if r and key:
                try:
                    r.setex(key, ttl, json.dumps(result, default=str))
                except Exception:
                    pass

            return result
        return wrapper
    return decorator


def _hash(args: tuple, kwargs: dict) -> str:
    payload = json.dumps({"a": [str(a) for a in args], "k": {k: str(v) for k, v in kwargs.items()}}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _node_base_url() -> str:
    return get_settings().node_url


# ── Tool 1: search_diseases ───────────────────────────────────────

@tool_with_cache(ttl=300)
async def search_diseases(query: str) -> list[dict]:
    """Search PostgreSQL diseases table via Node backend (public endpoint)."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{_node_base_url()}/api/diseases", params={"search": query})
            if r.status_code == 200:
                return r.json().get("data", [])[:5]
    except Exception as e:
        logger.warning(f"search_diseases failed: {e}")
    return []


# ── Tool 2: search_hospitals ──────────────────────────────────────

@tool_with_cache(ttl=300)
async def search_hospitals(city: str, specialty: str = "") -> list[dict]:
    """Search hospitals via Node backend (public endpoint)."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{_node_base_url()}/api/hospitals",
                params={"city": city, "specialization": specialty},
            )
            if r.status_code == 200:
                return r.json().get("data", [])[:5]
    except Exception as e:
        logger.warning(f"search_hospitals failed: {e}")
    return []


# ── Tool 3: get_user_history ──────────────────────────────────────

@tool_with_cache(ttl=60)
async def get_user_history(user_token: str, days: int = 7) -> list[dict]:
    """Fetch user health history via Node backend (authenticated)."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{_node_base_url()}/api/history",
                headers={"Authorization": f"Bearer {user_token}"},
            )
            if r.status_code == 200:
                return r.json().get("data", [])[:10]
    except Exception as e:
        logger.warning(f"get_user_history failed: {e}")
    return []


# ── Tool 4: get_user_profile ──────────────────────────────────────

@tool_with_cache(ttl=120)
async def get_user_profile(user_token: str) -> dict:
    """Fetch user profile via Node backend (authenticated)."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{_node_base_url()}/api/profile",
                headers={"Authorization": f"Bearer {user_token}"},
            )
            if r.status_code == 200:
                return r.json().get("data", {})
    except Exception as e:
        logger.warning(f"get_user_profile failed: {e}")
    return {}


# ── Tool 5: compute_risk_score ────────────────────────────────────

async def compute_risk_score(symptoms: list[str], answers: dict | None = None) -> dict:
    """
    Rule-based risk scoring — deterministic, no LLM, no external calls.
    Mirrors the logic in Node backend's symptom.controller.js.
    """
    answers = answers or {}
    score = min(len(symptoms) * 2, 6)

    if answers.get("feverDays", 0) >= 3:
        score += 2
    if answers.get("breathingDifficulty", False):
        score += 3
    if answers.get("chestPain", False):
        score += 3
    fatigue = answers.get("fatigueLevel", "Low")
    if fatigue == "Medium":
        score += 1
    elif fatigue == "High":
        score += 2

    emergency = answers.get("breathingDifficulty", False) or answers.get("chestPain", False)

    # Keyword boosts
    symptom_text = " ".join(s.lower() for s in symptoms)
    if any(w in symptom_text for w in ("chest", "heart", "unconscious", "seizure", "stroke")):
        score = max(score, 8)
        emergency = True

    score = min(score, 10)
    risk_level = "High" if score >= 8 or emergency else "Medium" if score >= 5 else "Low"

    return {"riskScore": score, "riskLevel": risk_level, "emergency": emergency}


# ── Tool 6: translate ─────────────────────────────────────────────

_TRANSLATIONS: dict[str, str] = {
    "fever": "बुखार", "cough": "खांसी", "headache": "सिरदर्द",
    "chest pain": "सीने में दर्द", "breathing difficulty": "सांस लेने में कठिनाई",
    "vomiting": "उल्टी", "stomach pain": "पेट दर्द", "fatigue": "थकान",
    "Low": "कम", "Medium": "मध्यम", "High": "उच्च",
    "General Physician": "सामान्य चिकित्सक",
    "Cardiologist": "हृदय रोग विशेषज्ञ",
    "Pulmonologist": "फेफड़े के रोग विशेषज्ञ",
    "Neurologist": "न्यूरोलॉजिस्ट",
}


async def translate(text: str, target_lang: str) -> str:
    if target_lang != "hi":
        return text
    lower = text.lower().strip()
    return _TRANSLATIONS.get(lower, _TRANSLATIONS.get(text, text))


# ── Tool 7: summarize_conversation ───────────────────────────────

async def summarize_conversation(messages: list[dict], user_token: str = "") -> str:
    """Summarise a long conversation into 2-3 sentences using the LLM."""
    if not messages:
        return ""

    settings = get_settings()
    if not settings.ai_api_key or settings.ai_api_key == "replace_with_api_key":
        # Fallback: naive last-5 message summary
        recent = messages[-5:]
        lines = [f"{m.get('role','?')}: {m.get('content','')[:80]}" for m in recent]
        return "Recent conversation covered: " + "; ".join(lines)

    transcript = "\n".join(
        f"{m.get('role','?').upper()}: {m.get('content','')[:200]}"
        for m in messages[-20:]
    )
    prompt = f"Summarise this health conversation in 2-3 sentences, preserving key symptoms and risk info:\n\n{transcript}"

    try:
        if settings.ai_provider == "anthropic":
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ai_api_key)
            msg = client.messages.create(
                model=settings.ai_model, max_tokens=150,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text if msg.content else ""
        else:
            from openai import OpenAI
            client = OpenAI(api_key=settings.ai_api_key)
            resp = client.chat.completions.create(
                model=settings.ai_model, temperature=0.1, max_tokens=150,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content or ""
    except Exception as e:
        logger.warning(f"summarize_conversation LLM failed: {e}")
        return ""


# ── Tool registry for planner ─────────────────────────────────────

TOOL_REGISTRY: dict[str, Any] = {
    "search_diseases":      search_diseases,
    "search_hospitals":     search_hospitals,
    "get_user_history":     get_user_history,
    "get_user_profile":     get_user_profile,
    "compute_risk_score":   compute_risk_score,
    "translate":            translate,
    "summarize_conversation": summarize_conversation,
}
