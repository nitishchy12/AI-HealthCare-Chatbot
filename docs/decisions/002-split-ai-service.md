# ADR 002 — Separate Python AI Microservice

**Date:** 2026-04  
**Status:** Accepted

## Context

The AI layer requires sentence-transformers (a C extension), Qdrant client, LangGraph, and asyncio-native tool parallelism — all Python-first libraries. The backend is Node.js.

## Decision

Build a **separate Python FastAPI microservice** (`ai-service/`) for all AI logic. Node backend calls it via internal HTTP (`POST /api/chat/assess`). Auth is shared via the same JWT secret.

## Consequences

**Positive:**
- Python ML ecosystem (sentence-transformers, LangGraph, presidio) runs natively with no Node shim.
- Each service can be scaled independently.
- Separation of concerns: Node handles auth/CRUD, Python handles intelligence.
- Python team (future) can own AI service without touching Node.

**Negative:**
- One additional Docker container to manage.
- Internal HTTP hop adds ~1-5ms latency.
- Two `.env` files to keep in sync (`JWT_SECRET` must match).
- The streaming endpoint (`GET /api/chat/stream`) currently uses Node's own AI fallback (`ai.service.js`) to stream without waiting for the Python service. Phase 6 pipes the stream from the Node fallback; full Python streaming deferred to Phase 6+.

## Alternatives Considered

- **Node.js AI only**: LangGraph has no stable Node port; sentence-transformers requires Python.
- **Serverless function for AI**: Cold starts incompatible with streaming SSE; session memory (Redis) hard to maintain.
