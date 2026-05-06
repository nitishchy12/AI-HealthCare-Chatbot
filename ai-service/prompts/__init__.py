from __future__ import annotations

import os
from pathlib import Path
from loguru import logger

_PROMPT_DIR = Path(__file__).parent
_cache: dict[str, str] = {}


def load_prompt(version: str) -> str:
    """Load and cache a versioned prompt template."""
    if version in _cache:
        return _cache[version]

    path = _PROMPT_DIR / f"health_agent_{version}.txt"
    if not path.exists():
        logger.warning(f"Prompt file not found: {path} — falling back to v1")
        path = _PROMPT_DIR / "health_agent_v1.txt"

    text = path.read_text(encoding="utf-8")
    _cache[version] = text
    logger.info(f"Loaded prompt: {path.name}")
    return text


def get_active_version() -> str:
    from config import get_settings
    return get_settings().prompt_version.replace("health-awareness-", "")


def clear_cache() -> None:
    _cache.clear()
