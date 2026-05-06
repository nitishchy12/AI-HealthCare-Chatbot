# Agent Design — LangGraph Health Agent

## Overview

The AI service uses a **stateful LangGraph agent** with 8 nodes and conditional routing. The agent is the central intelligence of the platform — it runs on every `/api/chat/assess` request and replaces a naive prompt-template approach.

## Node Responsibilities

| Node | Input | Output | Notes |
|---|---|---|---|
| **intent_classifier** | question | intent enum | Rule-based fast path for emergency/unsafe; LLM call only for ambiguous cases |
| **safety_guard** | question | scrubbed question, is_safe | Regex PII scrub (phone, email, Aadhaar); self-harm keyword detection |
| **retriever** | scrubbed question | retrieved_chunks[] | Qdrant top-5 by cosine similarity; metadata filter by language |
| **planner** | intent, question | planned_tools[] | Deterministic rules: symptom_query → diseases + risk_score; emergency → hospitals |
| **executor** | planned_tools | tool_results{} | `asyncio.gather` for parallelism; Redis cache with 5-min TTL per tool+args |
| **synthesizer** | chunks + tools + history | structured_output | Versioned prompt template; JSON mode; falls back to rule-based if no API key |
| **validator** | structured_output | validated output | Pydantic schema; strips invalid citations; softens diagnosis claims |
| **responder** | validated output | AssessmentResponse | Formats citations; appends disclaimer; logs node latencies |

## Short-Circuit Paths

```
emergency keywords detected  → EMERGENCY_RESPONSE (no LLM cost)
unsafe keywords detected     → SAFETY_REFUSAL (no LLM cost)
self-harm keywords detected  → SAFETY_REFUSAL + crisis hotlines
```

These paths complete in <10ms — before any embedding or LLM call.

## Tools

| Tool | Source | Cache TTL |
|---|---|---|
| `search_diseases(query)` | Node `/api/diseases` (Postgres) | 5 min |
| `search_hospitals(city, specialty)` | Node `/api/hospitals` (Postgres) | 5 min |
| `get_user_history(token, days)` | Node `/api/history` (MongoDB) | 1 min |
| `get_user_profile(token)` | Node `/api/profile` (Postgres) | 2 min |
| `compute_risk_score(symptoms, answers)` | Pure Python (rule-based) | none |
| `translate(text, lang)` | Dictionary lookup | none |
| `summarize_conversation(messages)` | LLM call | none |

## Prompt Versioning

Prompts live in `ai-service/prompts/`:
- `health_agent_v1.txt` — conservative baseline
- `health_agent_v2.txt` — citation-format with structured JSON schema in prompt

Active version: `config.PROMPT_VERSION = "health-awareness-v2"`

A/B testing: send `X-Prompt-Version: v1` header to override for that request. Both versions are logged with each response.

## Evaluation

Golden dataset: `eval/golden_dataset.json` — 30 labeled cases covering:
- Low/Medium/High risk queries
- Emergency queries (must short-circuit)
- Unsafe/self-harm queries (must refuse, 100% rate)
- Hindi language queries

Metrics computed by `eval/evaluate.py`:

| Metric | Target | Measured with |
|---|---|---|
| Risk accuracy | ≥ 80% | Exact match vs. expected_risk |
| Refusal rate | 100% | Unsafe prompts correctly refused |
| Emergency detection | ≥ 80% | Emergency short-circuit triggered |
| p50 latency | < 2000ms | Measured per case |

CI gate (`eval/test_eval.py`) fails the build if risk accuracy drops below 80%.

## Failure Modes

| Failure | Handling |
|---|---|
| Qdrant unavailable | Retriever returns [] → agent continues with no context; fallback fires |
| Redis unavailable | Tool cache bypassed; memory.py no-ops; each request is fresh |
| LLM API error / no key | Synthesizer returns "" → rule-based fallback in `_fallback_response()` |
| Malformed LLM JSON | validator retries synthesizer once; after 2 failures → fallback |
| Tool HTTP 4xx/5xx | executor logs warning and returns None for that tool; agent continues |
| PII detected | safety_guard scrubs before any LLM call; PII never logged or stored |
