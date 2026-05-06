"""
Redis-backed conversation memory.
Stores last 20 messages per conversation; summarises older messages when overflow.
"""
from __future__ import annotations

import json
from loguru import logger

from config import get_settings

_MAX_MESSAGES = 20
_SUMMARY_KEEP = 5   # keep last N messages after summarising older ones


def _get_redis():
    import redis as redis_lib
    settings = get_settings()
    return redis_lib.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=1)


def _key(conversation_id: str) -> str:
    return f"conv:{conversation_id}"


def load_history(conversation_id: str, limit: int = _MAX_MESSAGES) -> list[dict]:
    """Return last `limit` messages for this conversation."""
    if not conversation_id:
        return []
    try:
        r = _get_redis()
        raw = r.lrange(_key(conversation_id), -limit, -1)
        return [json.loads(m) for m in raw]
    except Exception as e:
        logger.warning(f"load_history failed: {e}")
        return []


def save_message(conversation_id: str, role: str, content: str) -> None:
    """Append a message and trim the list to MAX_MESSAGES."""
    if not conversation_id:
        return
    try:
        r = _get_redis()
        k = _key(conversation_id)
        r.rpush(k, json.dumps({"role": role, "content": content}))
        r.ltrim(k, -_MAX_MESSAGES, -1)
        r.expire(k, 7 * 24 * 3600)  # 7-day TTL
    except Exception as e:
        logger.warning(f"save_message failed: {e}")


def get_length(conversation_id: str) -> int:
    try:
        return _get_redis().llen(_key(conversation_id))
    except Exception:
        return 0


def should_summarize(conversation_id: str) -> bool:
    return get_length(conversation_id) >= _MAX_MESSAGES


def replace_with_summary(conversation_id: str, summary: str) -> None:
    """
    Called after summarize_conversation tool runs.
    Replaces the Redis list with: [system summary] + last _SUMMARY_KEEP messages.
    """
    if not conversation_id:
        return
    try:
        r = _get_redis()
        k = _key(conversation_id)
        recent = [json.loads(m) for m in r.lrange(k, -_SUMMARY_KEEP, -1)]
        r.delete(k)
        r.rpush(k, json.dumps({"role": "system", "content": f"[SUMMARY] {summary}"}))
        for msg in recent:
            r.rpush(k, json.dumps(msg))
        r.expire(k, 7 * 24 * 3600)
    except Exception as e:
        logger.warning(f"replace_with_summary failed: {e}")
