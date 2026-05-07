# HealthBot — AI-Driven Public Health Platform

A full-stack, production-grade health awareness platform that combines a React frontend, a Node.js/Express REST API, and a Python FastAPI AI microservice. The AI layer is built on a stateful LangGraph agent with RAG (retrieval-augmented generation), Qdrant vector search, and real-time SSE streaming — all running locally with a single Docker Compose command.

**What it does:** Users can ask health questions in natural language, run a guided multi-step symptom assessment, review their health history on a timeline, find nearby hospitals on an interactive map, and receive AI-generated responses that cite verified medical sources.

---

## Technical Highlights

- **8-node LangGraph agent** — intent classification, safety guard (PII scrubbing, self-harm detection), Qdrant retriever, tool planner, parallel executor, LLM synthesizer, validator, and responder. Emergency and unsafe queries short-circuit before any LLM call.
- **SSE streaming** — AI responses stream token-by-token via Server-Sent Events. Uses `fetch` (not `EventSource`) to allow `Authorization` headers.
- **Auth system** — Argon2id password hashing, 15-minute access JWT (in-memory) + 7-day refresh token (SHA-256 hashed in PostgreSQL), token rotation on every refresh, account lockout after 5 failed logins, TOTP-based 2FA via speakeasy.
- **Conversation persistence** — multi-turn conversations stored in MongoDB with full message history, soft-delete, and context window management (last 10 messages passed to AI).
- **Real-time layer** — Socket.IO for bidirectional events (`assessment:created`, `notification:new`, `chat:typing`, admin presence). BullMQ workers for daily tip generation, weekly reports, and 72-hour follow-up reminders.
- **Vector knowledge base** — 200+ curated medical knowledge chunks (English + Hindi) embedded with `all-MiniLM-L6-v2` (local, no API cost) and indexed in Qdrant.
- **105 automated tests** — 41 Jest + Supertest (backend), 29 pytest (AI service), 35 Vitest (frontend components).
- **6-job CI pipeline** — backend tests, frontend build, AI service tests, Docker build validation, agent evaluation gate, and Playwright E2E tests.
- **Web push notifications** — VAPID-based push subscriptions for daily health tips and follow-up reminders.
- **Admin panel** — sidebar with 7 tabs: Overview, Users (suspend/role), Hospitals, Diseases, Tips, AI Settings (prompt versioning), and Audit Log.

---

## Architecture

```
Browser
  |
  v
React Frontend (Vite + Tailwind)        port 5173
  |
  v  REST + SSE + WebSocket
Node.js API (Express + Socket.IO)       port 5004
  |                |
  |                v
  |         Python AI Service           port 8000
  |         (FastAPI + LangGraph)
  |                |
  v                v
PostgreSQL    MongoDB    Redis    Qdrant
(users,       (conver-   (cache,  (medical
 hospitals,    sations,   queues,  knowledge
 sessions)     messages)  memory)  vectors)
```

**LangGraph agent flow:**

```
Question
  -> Intent Classifier
      -> [emergency]  Emergency Response  (no LLM)
      -> [unsafe]     Safety Refusal      (no LLM)
      -> [other]      Safety Guard
                        -> Retriever (Qdrant top-5)
                           -> Planner (select tools)
                              -> Executor (parallel asyncio.gather)
                                 -> Synthesizer (LLM + versioned prompt)
                                    -> Validator (schema, citation check)
                                       -> Responder (format + log)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Radix UI, TanStack Query, react-hook-form + Zod, date-fns |
| Backend | Node.js 20, Express 4, Socket.IO, Mongoose, pg, Argon2id, JWT (access + refresh) |
| AI Service | Python 3.11, FastAPI, LangGraph, LangChain, sentence-transformers (MiniLM-L6-v2) |
| Databases | PostgreSQL 16, MongoDB 7, Redis 7, Qdrant 1.9 |
| Background | BullMQ (daily tips, weekly reports, follow-up reminders) |
| Testing | Jest + Supertest, pytest, Vitest + React Testing Library |
| Maps | Leaflet + OpenStreetMap (no API key), Haversine nearby search |
| Push | Web Push API + VAPID (web-push npm package) |
| E2E | Playwright (Chromium) |
| CI/CD | GitHub Actions — 6 jobs including Playwright E2E gate |
| Containers | Docker Compose — 7 services with health checks |

---

## Project Structure

```
.
├── backend/                 Node.js Express API
│   ├── migrations/          SQL migrations (up/down)
│   ├── scripts/             migrate.js, migrate-mongo-chats.js
│   ├── src/
│   │   ├── config/          constants.js — all thresholds, no magic numbers
│   │   ├── controllers/     auth, chat (SSE), conversations, history, reports
│   │   ├── middlewares/     authMiddleware, lastSeenMiddleware, validate
│   │   ├── models/          Conversation, Message, Feedback (Mongoose)
│   │   ├── services/        ai.service.js (fallback), conversation.service.js, session.service.js
│   │   └── workers/         BullMQ queues — daily-tips, weekly-report, followup-check
│   └── tests/               7 test files, 41 tests total
│
├── frontend/                React + Vite SPA
│   ├── src/
│   │   ├── components/ui/   Button, Input, Card, RiskBadge, ConfidenceBar,
│   │   │                    MarkdownRenderer, CitationPopover, CodeBlock,
│   │   │                    Skeleton, EmptyState, ErrorBoundary
│   │   ├── components/      Navbar, ConversationSidebar, MessageBubble
│   │   ├── context/         AuthContext (silent refresh), ThemeContext, LanguageContext
│   │   ├── hooks/           useStreamingChat (fetch-based SSE)
│   │   ├── lib/             cn.js, tokenStore.js (in-memory access token)
│   │   ├── pages/           Dashboard, Chat, SymptomChecker, History, Reports,
│   │   │                    Hospitals, HealthTips, Profile, Admin, Login, Register
│   │   └── test/            35 Vitest component tests
│   └── vite.config.js       Tailwind + Vitest config
│
├── ai-service/              Python FastAPI AI microservice
│   ├── agent/               state.py, nodes.py (8 nodes), tools.py (7 tools),
│   │                        memory.py (Redis conv history), graph.py (LangGraph)
│   ├── core/                auth.py, embeddings.py, vector_store.py
│   ├── eval/                golden_dataset.json (30 cases), evaluate.py, test_eval.py
│   ├── prompts/             health_agent_v1.txt, health_agent_v2.txt
│   ├── scripts/             seed_knowledge.py (200+ medical chunks, EN + HI)
│   └── tests/               29 pytest tests (mocked, no infrastructure required)
│
├── docs/                    Architecture, data model, security.md, runbook, ADRs
│   └── screenshots/         UI screenshots (see docs/screenshots/)
├── .github/workflows/       6-job CI pipeline (includes Playwright E2E)
├── docker-compose.yml       6 services with health checks (MongoDB on Atlas)
└── Makefile                 dev, test, migrate, seed, logs, clean targets
```

---

## Quickstart — Local Development

Run databases in Docker, services locally (fastest for development).

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop

### 1. Clone and configure

```bash
git clone https://github.com/nitishchy12/AI-HealthCare-Chatbot
cd AI-Healthcare-Chatbot

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-service/.env.example ai-service/.env
```

Edit `backend/.env` and set `JWT_SECRET` to a strong random string (32+ characters). This must match `JWT_SECRET` in `ai-service/.env`.

### 2. Start infrastructure

```bash
docker compose up -d postgres redis qdrant
```

MongoDB is hosted on Atlas — no local container needed. Wait approximately 15 seconds for health checks:

```bash
docker compose ps    # all four should show "healthy"
```

### 3. Backend

```bash
cd backend
npm install
npm run migrate      # applies SQL migrations (idempotent)
npm run seed         # seeds 30 hospitals, 15 diseases, 20 health tips
npm run dev          # starts on http://localhost:5004
```

### 4. AI Service

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python scripts/seed_knowledge.py    # seeds Qdrant with 200+ medical chunks (run once)
uvicorn main:app --reload --port 8000
```

On macOS/Linux, activate the virtual environment with `source .venv/bin/activate`.

Without an OpenAI/Anthropic API key the service uses a rule-based fallback automatically. Set `AI_API_KEY` in `ai-service/.env` to enable LLM responses.

### 5. Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev          # starts on http://localhost:5173
```

### Access

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5004/api |
| API Docs (Swagger) | http://localhost:5004/api/docs |
| AI Service | http://localhost:8000 |
| AI Service Docs | http://localhost:8000/docs |

### First run

1. Register an account at `/register`
2. To set admin role (for the Admin Panel), run:

```sql
-- Connect with: psql postgresql://postgres:postgres@localhost:5433/public_health
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Docker Images

```bash
docker pull nitishchy12/health-backend:latest
docker pull nitishchy12/health-frontend:latest
docker pull nitishchy12/health-ai:latest
```

---

## Full Docker Stack

```bash
docker compose --profile app up --build
```

After first startup, seed the databases:

```bash
docker exec health-backend npm run migrate
docker exec health-backend npm run seed
docker exec health-ai python scripts/seed_knowledge.py
```

---

## Features

- [x] JWT auth + Argon2id + token rotation + TOTP 2FA + account lockout
- [x] Multi-turn AI chat with SSE streaming and conversation history
- [x] 8-node LangGraph agent (intent → safety → retriever → synthesizer → responder)
- [x] 5-step symptom checker wizard with animated transitions
- [x] Interactive hospital map (Leaflet + OpenStreetMap, geolocation, Haversine nearby)
- [x] Health reports with 4-tab dashboard, Recharts, activity heatmap, and PDF export
- [x] AI Insights tab: 14-day health summary with anomaly detection
- [x] Admin panel with 7 tabs: stats, user management, CRUD, AI settings, audit log
- [x] Conversation search (MongoDB text index) with inline sidebar search
- [x] Web push notifications (VAPID) for daily tips and follow-up reminders
- [x] Dark mode, Hindi language support, mobile-responsive layout
- [x] 200+ curated medical knowledge chunks (English + Hindi) in Qdrant
- [x] BullMQ background workers: daily tips, weekly reports, follow-up reminders
- [x] Regional health alerts (dengue, AQI, influenza season) on dashboard
- [x] 105 automated tests + 5-flow Playwright E2E suite

---

## Known Limitations

- **Qdrant knowledge base**: 200+ curated chunks vs clinical-grade thousands; RAG fallback used for uncovered topics
- **No HIPAA certification**: This is a health awareness demo, not a regulated medical device
- **Web push requires HTTPS**: Works on localhost but must be deployed with TLS in production
- **AI responses are not clinically validated**: Every response includes a disclaimer; do not use for medical decisions
- **No doctor escalation**: High-risk assessments show hospitals but do not connect to practitioners
- **Free-tier AI**: Without a real API key the service uses a rule-based fallback; responses improve significantly with GPT-4o or Claude

---

## Roadmap

- [ ] Voice input (Web Speech API) for hands-free symptom reporting
- [ ] Doctor escalation for high-risk cases (telemedicine API integration)
- [ ] Geolocation-based automatic hospital suggestions on dashboard
- [ ] Medication reminder notifications via push
- [ ] Expanded knowledge base to 1,000+ chunks with ICMR and WHO source verification
- [ ] Offline PWA support for areas with intermittent connectivity
- [ ] Multi-language support beyond English and Hindi (Tamil, Bengali, Telugu)

---

## Screenshots

Screenshots available in [docs/screenshots/](docs/screenshots/).

---

## Security

See [docs/security.md](docs/security.md) for the full STRIDE threat model, implemented controls, and deployment security checklist.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Makefile

```
make dev            start infra in Docker, then backend + frontend + ai-service locally
make test           run all test suites (Jest + pytest)
make test-backend   backend tests only
make test-ai        ai-service tests only
make migrate        run SQL migrations
make seed           seed hospitals, diseases, health tips
make seed-qdrant    seed Qdrant vector database
make eval           run agent evaluation on golden dataset
make logs           tail all Docker container logs
make clean          stop all containers and delete volumes (destructive)
```

---

## Environment Variables

### `backend/.env`

```env
PORT=5004
NODE_ENV=development

# Must match ai-service JWT_SECRET exactly
JWT_SECRET=change_me_strong_secret_min_32_chars

POSTGRES_URI=postgresql://postgres:postgres@localhost:5433/public_health
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/healthbot?retryWrites=true&w=majority&appName=Cluster0
REDIS_URL=redis://localhost:6379

# Supported: openai | anthropic
AI_PROVIDER=openai
AI_API_KEY=replace_with_api_key
AI_MODEL=gpt-4o-mini
AI_SERVICE_URL=http://localhost:8000

FRONTEND_URL=http://localhost:5173
DB_STARTUP_RETRIES=15
DB_STARTUP_DELAY_MS=4000
```

### `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:5004/api
```

### `ai-service/.env`

```env
# Must match backend JWT_SECRET
JWT_SECRET=change_me_strong_secret_min_32_chars

AI_PROVIDER=openai
AI_API_KEY=replace_with_api_key
AI_MODEL=gpt-4o-mini

QDRANT_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379
NODE_URL=http://localhost:5004
PROMPT_VERSION=health-awareness-v2

APP_ENV=development
PORT=8000
```

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register, returns access + refresh tokens |
| POST | `/api/auth/login` | Public | Login (rate-limited), returns access + refresh tokens |
| POST | `/api/auth/refresh` | Public | Exchange refresh token for new pair (token rotation) |
| POST | `/api/auth/logout` | Public | Revoke current session |
| POST | `/api/auth/logout-all` | Required | Revoke all sessions for this user |
| POST | `/api/auth/2fa/setup` | Required | Generate TOTP QR code |
| POST | `/api/auth/2fa/verify` | Required | Enable 2FA |
| POST | `/api/auth/2fa/disable` | Required | Disable 2FA (requires password + TOTP) |
| POST | `/api/auth/2fa/login` | Public | Second-factor login |

### Chat and Conversations

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/chat` | Required | Create assessment (saves to conversation) |
| GET | `/api/chat/stream?question=X&conversation_id=Y` | Required | SSE streaming response |
| GET | `/api/chat/history` | Required | Paginated legacy chat history |
| DELETE | `/api/chat/history` | Required | Clear all chat history |
| POST | `/api/chat/messages/:id/feedback` | Required | Rate a message (-1, 0, or 1) |
| GET | `/api/conversations` | Required | List conversations (paginated) |
| POST | `/api/conversations` | Required | Create conversation |
| GET | `/api/conversations/:id` | Required | Get conversation with messages |
| PATCH | `/api/conversations/:id` | Required | Rename conversation |
| DELETE | `/api/conversations/:id` | Required | Soft-delete conversation |

### Health Data

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/symptoms` | Required | Submit symptom check (multi-factor risk scoring) |
| GET | `/api/symptoms` | Required | List user symptom checks |
| GET | `/api/history` | Required | Merged health history (conversations + symptom checks) |
| GET | `/api/reports` | Required | Analytics report (risk trend, symptom frequency, activity) |
| GET | `/api/profile` | Required | Get user profile |
| PUT | `/api/profile` | Required | Update profile |

### Admin (role = admin required)

| Method | Endpoint | Description |
|---|---|---|
| POST / PUT / DELETE | `/api/hospitals` | Hospital CRUD |
| POST / PUT / DELETE | `/api/diseases` | Disease CRUD |
| POST / PUT / DELETE | `/api/tips` | Health tip CRUD |

### System

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Service health + DB status |
| GET | `/api/docs` | Swagger UI (development only) |

### AI Service

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Service health, Qdrant + Redis status |
| POST | `/api/chat/assess` | JWT Required | Full LangGraph agent assessment |

---

## Auth Flow

```
Login
  -> { token (15m JWT, stored in memory), refreshToken (opaque, stored in localStorage) }

On every API request
  -> axios interceptor adds: Authorization: Bearer <token>

On 401 TOKEN_EXPIRED
  -> interceptor calls POST /api/auth/refresh automatically
  -> retries original request with new token
  -> if refresh also fails -> clear storage, redirect to /login

On page reload
  -> AuthContext reads refreshToken from localStorage
  -> calls POST /api/auth/refresh silently
  -> restores session without user interaction
```

---

## Security Implementation

| Control | Implementation |
|---|---|
| Password hashing | Argon2id — 64 MB memory, 3 iterations (OWASP 2023 recommended) |
| Bcrypt migration | Existing bcrypt hashes transparently re-hashed on next login |
| Access token | 15-minute JWT, stored in module memory (not localStorage) |
| Refresh token | 7-day opaque token, SHA-256 hashed before storage in PostgreSQL |
| Token rotation | Every refresh revokes the old session and issues a new one |
| Account lockout | 5 failed logins triggers 15-minute lockout |
| 2FA | TOTP via speakeasy — QR code setup, disable requires password + TOTP |
| Rate limiting | Global 500 req/15min, auth routes 20 req/15min, chat 10 req/min |
| Input validation | Joi (backend), Zod (frontend) |
| PII scrubbing | Regex-based (phone, email, national IDs) in AI safety guard node |
| CORS | Allowlisted to FRONTEND_URL only, with explicit allowed headers |
| Security headers | Helmet with custom CSP (no inline scripts after Tailwind build) |
| Audit logging | All admin CRUD actions and history clearing logged to audit_logs table |

---

## Testing

```bash
# Backend (Jest + Supertest) — no running services required, all mocked
cd backend && npm test

# AI Service (pytest) — no running services required, all mocked
cd ai-service && python -m pytest tests/ -v

# Frontend (Vitest + React Testing Library) — no DOM required
cd frontend && npm test

# Agent evaluation (golden dataset — 30 labeled cases)
cd ai-service && python eval/evaluate.py
```

| Suite | Framework | Tests | Coverage focus |
|---|---|---|---|
| Backend auth | Jest + Supertest | 13 | Register, login, lockout, refresh, token errors |
| Backend chat/stream | Jest + Supertest | 9 | SSE headers, token events, feedback endpoint |
| Backend conversations | Jest + Supertest | 9 | CRUD, auth guard, soft delete |
| Backend chat | Jest + Supertest | 2 | Create assessment, clear history |
| Backend symptom | Jest + Supertest | 5 | Risk scoring, emergency detection, validation |
| Backend history | Jest + Supertest | 3 | Auth guard, merged response shape |
| AI agent | pytest | 20 | Each node in isolation + 3 full graph integration tests |
| AI RAG endpoint | pytest | 9 | Auth, validation, fallback, mocked AI, Hindi |
| Frontend components | Vitest | 35 | Button, Input, RiskBadge, ConfidenceBar, Skeleton, EmptyState |

---

## Database Migrations

Migrations are tracked in the `_migrations` table and run in filename order. They are idempotent — safe to re-run.

```bash
cd backend && npm run migrate
```

Migration files in `backend/migrations/`:
- `001_auth_upgrade.sql` — adds first_name, last_name, totp_secret, failed_login_attempts, locked_until, last_seen_at to users
- `002_user_sessions.sql` — creates user_sessions table for refresh token management
- `003_audit_logs_upgrade.sql` — structured audit log columns

---

## Documentation

`docs/` contains:

- `architecture.md` — Mermaid system context, container diagram, chat streaming sequence, LangGraph flow
- `data-model.md` — PostgreSQL ERD, MongoDB schemas, design rationale
- `agent-design.md` — node responsibilities, tool table, prompt versioning, evaluation methodology, failure modes
- `runbook.md` — debugging guide for 8 common issues with exact commands
- `decisions/` — Architecture Decision Records:
  - ADR 001: Dual database (PostgreSQL + MongoDB)
  - ADR 002: Separate Python AI microservice
  - ADR 003: SSE over WebSocket for streaming
  - ADR 004: LangGraph for agent orchestration

---

## CI/CD

`.github/workflows/ci.yml` runs on every push to main and every pull request.

| Job | What it runs |
|---|---|
| backend-tests | Jest + Supertest (41 tests) with Postgres + MongoDB service containers |
| frontend-build | Vite production build |
| ai-service-tests | pytest (29 tests) — fully mocked, no infrastructure needed |
| docker-build | Builds all three Docker images to catch Dockerfile regressions |
| agent-eval | Runs golden dataset evaluation — fails if risk accuracy drops below 80% |

---

## Disclaimer

HealthBot is a health awareness tool. It is not a medical diagnosis system. Every AI response includes a disclaimer directing users to consult a qualified healthcare professional. The system is designed to follow safe AI principles: no diagnostic certainty claims, PII scrubbing before LLM calls, self-harm detection with crisis hotline routing, and human-in-the-loop for all high-risk situations.

---

## License

MIT — see [LICENSE](LICENSE) for details.
