# Architecture — AI-Driven Public Health Chatbot

## System Context (C4 Level 1)

```mermaid
flowchart LR
  subgraph Users
    U[Patient / Public]
    A[Admin]
  end

  subgraph HealthBot System
    FE[React Frontend\nVite + Tailwind]
    BE[Node.js API\nExpress + Socket.IO]
    AI[AI Service\nFastAPI + LangGraph]
  end

  subgraph Data
    PG[(PostgreSQL)]
    MG[(MongoDB)]
    RD[(Redis)]
    QD[(Qdrant)]
  end

  subgraph External
    LLM[OpenAI / Anthropic]
    OSM[OpenStreetMap]
  end

  U  --> FE
  A  --> FE
  FE --> BE
  BE --> AI
  BE --> PG & MG & RD
  AI --> QD & RD
  AI --> LLM
  FE --> OSM
```

## Container Diagram (C4 Level 2)

| Container | Tech | Port | Responsibility |
|---|---|---|---|
| Frontend | React 18 + Vite + Tailwind | 5173 | SPA — all UI pages |
| Backend API | Node.js 20 + Express | 5004 | Auth, chat, CRUD, SSE streaming |
| AI Service | Python 3.11 + FastAPI | 8000 | LangGraph agent, RAG, embeddings |
| PostgreSQL | v16 | 5433 | Users, sessions, hospitals, diseases, audit |
| MongoDB | v7 | 27017 | Conversations, messages, symptom checks |
| Redis | v7 | 6379 | Session memory, tool cache, BullMQ queues |
| Qdrant | v1.9 | 6333 | Medical knowledge vectors (384-dim MiniLM) |

## Chat Streaming Sequence

```mermaid
sequenceDiagram
  participant U as Browser
  participant FE as React
  participant BE as Node API
  participant AI as AI Service

  U->>FE: Send message
  FE->>FE: Add user bubble (optimistic)
  FE->>BE: GET /api/chat/stream?question=X&conversation_id=Y
  note over BE: Auth middleware validates JWT
  BE->>BE: Resolve/create conversation
  BE->>BE: buildResponse() — rule-based fallback
  loop Token streaming (~55 chunks/s)
    BE-->>FE: event: token {text}
  end
  BE-->>FE: event: metadata {riskLevel, citations…}
  BE-->>FE: event: done {conversationId}
  BE->>BE: appendMessages() to MongoDB
  BE->>FE: Socket.IO assessment:created
```

## LangGraph Agent Flow

```mermaid
flowchart TD
  Q([Question]) --> IC{Intent Classifier}
  IC -->|emergency| ER[Emergency Response] --> Z([Done])
  IC -->|unsafe| SR[Safety Refusal] --> Z
  IC -->|other| SG[Safety Guard\nPII scrub]
  SG --> RV[Retriever\nQdrant top-5]
  RV --> PL[Planner\nchoose tools]
  PL --> EX[Executor\nasyncio.gather]
  EX --> SY[Synthesizer\nLLM + prompt]
  SY --> VA{Validator}
  VA -->|valid| RE[Responder] --> Z
  VA -->|retry < 2| SY
  VA -->|failed| FB[Fallback] --> Z
```

## Data Flow — Symptom Check

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant BE as Backend
  participant SC as SymptomController

  U->>FE: Completes 4-step wizard
  FE->>BE: POST /api/symptoms {symptoms, feverDays, chestPain…}
  BE->>SC: analyzeSymptoms()
  SC->>SC: compute riskScore (rule-based)
  SC->>SC: chooseDisease(symptoms, answers)
  SC->>BE: {riskScore, riskLevel, possibleDisease, recommendations}
  BE->>FE: 201 Created
  FE->>FE: Show results + risk bar animation
```
