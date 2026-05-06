# Runbook — Common Issues & Debugging

## Quick Start Check

```bash
# 1. All infra healthy?
docker compose ps

# 2. Backend responding?
curl http://localhost:5004/api/health

# 3. AI service responding?
curl http://localhost:8000/health

# 4. Frontend loading?
open http://localhost:5173
```

---

## Issue: Backend won't start — "ECONNREFUSED postgres"

**Cause:** PostgreSQL container not yet healthy or not running.

```bash
# Check container status
docker compose ps postgres

# If not running
docker compose up -d postgres mongodb redis qdrant

# Wait for healthy
docker compose ps   # look for "healthy" status

# Then restart backend
cd backend && npm run dev
```

---

## Issue: `npm run migrate` fails — "relation already exists"

**Safe to ignore.** Migrations use `IF NOT EXISTS` guards. Re-running is idempotent.

If you see a genuine error (e.g., wrong column type):

```bash
# Check migration table
psql $POSTGRES_URI -c "SELECT filename, applied_at FROM _migrations ORDER BY id;"

# Manually apply a specific migration
psql $POSTGRES_URI -f backend/migrations/001_auth_upgrade.sql
```

---

## Issue: Chat sends message but no AI response appears

**Checklist:**
1. Open browser DevTools → Network tab → filter by `stream`
2. Is a GET `/api/chat/stream?...` request visible?
   - **No request at all**: Access token may be null. Check `localStorage` for `refresh_token`. Refresh the page — AuthContext does a silent restore on mount.
   - **Request returns 401**: Token expired and refresh also failed → log out and log back in.
   - **Request returns 400**: Question < 5 chars.
   - **Request returns 500**: Check backend logs: `docker compose logs backend`
3. SSE stream opens but no tokens appear: check `event: error` in the stream response body.

```bash
# Test the stream endpoint directly
curl -N -H "Authorization: Bearer <token>" \
  "http://localhost:5004/api/chat/stream?question=I+have+a+headache&language=en"
```

---

## Issue: AI service returns fallback every time

**Expected** when `AI_API_KEY=replace_with_api_key`. The agent falls back to rule-based responses — this is correct behaviour for local dev without an API key.

To use a real LLM:
1. Get an OpenAI API key from platform.openai.com
2. Set `AI_API_KEY=sk-...` in `ai-service/.env`
3. Restart the AI service: `uvicorn main:app --reload --port 8000`

---

## Issue: Qdrant search returns no results

```bash
# Check collection exists and has data
curl http://localhost:6333/collections/medical_knowledge

# If count is 0, re-seed
cd ai-service && python scripts/seed_knowledge.py

# Check Qdrant logs
docker compose logs qdrant
```

---

## Issue: Port already in use (EADDRINUSE)

```bash
# Find what's using port 5004
netstat -ano | findstr :5004   # Windows
lsof -i :5004                  # Mac/Linux

# If it's a Docker container
docker compose stop backend

# Then run locally
cd backend && npm run dev
```

---

## Issue: Frontend build fails in CI

The `npm ci --legacy-peer-deps` flag is needed because `react-leaflet` has a peer dep conflict with React 18. This is expected — the flag is set in CI YAML. Locally run:

```bash
cd frontend && npm install --legacy-peer-deps
```

---

## Issue: 2FA QR code setup but TOTP always says invalid

- Ensure the server clock and your phone clock are in sync (NTP)
- The TOTP window is `±1 step` (30s tolerance)
- If you lost your authenticator app: disable 2FA via direct DB update:

```sql
UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE email = 'your@email.com';
```

---

## Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f ai-service

# Local backend (structured JSON)
cd backend && npm run dev   # logs go to stdout

# Local AI service
uvicorn main:app --reload   # loguru to stdout
```

---

## Database Access

```bash
# PostgreSQL
psql postgresql://postgres:postgres@localhost:5433/public_health

# MongoDB
mongosh mongodb://localhost:27017/public_health_chatbot

# Redis
redis-cli -p 6379

# Qdrant UI
open http://localhost:6333/dashboard
```

---

## Reset Everything (Nuclear Option)

```bash
make clean   # stops all containers and deletes all volumes
make infra   # restarts infra
make migrate
make seed
make seed-qdrant
```
