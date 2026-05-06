# ADR 004 — LangGraph for Agent Orchestration

**Date:** 2026-04  
**Status:** Accepted

## Context

The health agent requires:
- Conditional routing (emergency → short circuit before LLM cost)
- Parallel tool execution (asyncio.gather)
- Retry loops (validator → synthesizer up to 2 times)
- Shared state across all nodes (AgentState TypedDict)

## Decision

Use **LangGraph** (built on LangChain) instead of plain LangChain chains or a custom state machine.

## Reasoning

LangGraph provides:
- **StateGraph** with typed state flowing through every node — single source of truth.
- **Conditional edges** — `route_after_intent()` returns a node name; LangGraph handles the dispatch.
- **Built-in retry** — validator can route back to synthesizer cleanly.
- **Async-native** — `ainvoke()` runs the entire graph asynchronously.
- **Checkpointer** — future-proof for persistent conversation resumption.

Plain LangChain chains lack conditional branching and typed shared state. A custom state machine would reinvent LangGraph without its tooling.

## Consequences

**Positive:**
- Agent flow is a declarative graph — readable and testable node by node.
- Emergency/unsafe short-circuits save LLM cost on ~15% of queries.
- Each node is independently testable with mocked LLM.

**Negative:**
- LangGraph API evolves quickly — pinned to `>=0.2` in requirements.txt.
- Learning curve for developers unfamiliar with graph-based agents.
- `langsmith` transitive dependency requires pytest plugin workaround (`pytest.ini: addopts = -p no:langsmith`).
