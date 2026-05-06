# ADR 003 — SSE for AI Streaming, WebSocket for Bidirectional Events

**Date:** 2026-04  
**Status:** Accepted

## Context

Two distinct real-time patterns exist in the app:
1. **AI response streaming** — one-way, server → client, long-lived per message.
2. **Live events** — bidirectional: `assessment:created`, `notification:new`, `presence:update`, `chat:typing`.

## Decision

Use **Server-Sent Events (SSE)** for AI streaming and **Socket.IO (WebSocket)** for all other live events.

## Reasoning

SSE advantages over WebSocket for streaming:
- Native browser `EventSource` API — no library required.
- Works over HTTP/1.1 and HTTP/2 (including through most proxies and CDNs).
- Automatically reconnects on disconnect.
- Simpler server implementation: `res.write("event: token\ndata: {...}\n\n")`.
- One-way semantics match the use case — the client only needs to receive tokens.

We use `fetch` (not native `EventSource`) to allow custom `Authorization` headers, which `EventSource` doesn't support.

Socket.IO retained for bidirectional events because:
- Supports fallback to polling when WebSocket is blocked.
- Room-based broadcasting (`user:{id}`, `admin`) is built-in.
- Typed events with `on/emit` pattern cleaner than raw WebSocket.

## Consequences

**Positive:**
- Streaming works through all proxy layers (SSE is HTTP).
- Socket.IO handles reconnection, rooms, and namespaces cleanly.

**Negative:**
- Two real-time mechanisms to maintain.
- SSE requires HTTP/1.1 persistent connection — some load balancers need `X-Accel-Buffering: no`.
