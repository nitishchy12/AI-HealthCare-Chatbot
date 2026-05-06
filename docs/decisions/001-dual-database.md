# ADR 001 — Dual Database: PostgreSQL + MongoDB

**Date:** 2026-04  
**Status:** Accepted

## Context

We need to store two fundamentally different types of data:
1. **Structured, relational data** — users, hospitals, diseases, audit logs. Requires ACID guarantees, foreign keys, and strong schema enforcement.
2. **Semi-structured, high-volume document data** — AI chat responses, conversation history. Schema evolves with each AI model version; payload shape varies.

## Decision

Use **PostgreSQL** for structured relational data and **MongoDB** for flexible document storage.

## Consequences

**Positive:**
- PostgreSQL enforces constraints (UNIQUE email, FK integrity) critical for auth correctness.
- MongoDB's flexible schema means we can add new AI response fields (e.g., `citations`, `prompt_version`) without migrations.
- Each database is optimised for its workload.

**Negative:**
- Two connection pools to manage.
- No cross-database transactions (mitigated by eventual consistency patterns — we write to Mongo after Postgres, with rollback logging).
- Slightly more complex local setup (two Docker containers).

## Alternatives Considered

- **PostgreSQL only with JSONB**: Would work but loses Mongo's native document querying, change streams, and horizontal scale path.
- **MongoDB only**: Loses ACID for auth, making session management and audit logging risky.
