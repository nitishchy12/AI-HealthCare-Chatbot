# AI-Driven Public Health Chatbot for Disease Awareness

A full-stack healthcare project designed with practical production-style engineering.

## Tech Stack

- Frontend: React.js (Vite)
- Backend: Node.js + Express.js
- Databases:
  - PostgreSQL for users, hospitals, disease info
  - MongoDB for chat history and AI response logs
- Auth: JWT + bcrypt
- Security: Helmet, CORS, validation, sanitization, rate limiting, request IDs

## Architecture Diagram

```text
[React Frontend]
    |
    v
[Express API Layer]
    |- Auth Controller (JWT + bcrypt)
    |- Chat Controller (AI + fallback + pagination)
    |- Hospital Controller
    |- Disease Controller (admin managed)
    |
    v
[Service Layer]
    |- AI Service (LLM API call + fallback logic)
    |
    +----> [PostgreSQL]
    |        |- users
    |        |- hospitals
    |        |- diseases
    |
    +----> [MongoDB]
             |- chats
```

## Folder Structure

```text
ai-public-health-chatbot/
  frontend/
  backend/
  README.md
```

## Core Features

- User register/login
- JWT protected routes
- Chat interface for health questions
- AI-generated structured response
- Risk level classification (Low / Medium / High)
- Hospital search by city
- Chat history per user
- Chat history pagination (`page`, `limit`)
- Admin panel:
  - Add hospital
  - Add verified disease info
- Input validation and centralized error handling
- AI fallback handling using verified disease data
- Request ID tracking in logs and error responses
- Health check endpoint for ops readiness

## Health Endpoint

- `GET /api/health`

Example response:

```json
{
  "status": "OK",
  "uptime": "12345s",
  "database": "connected"
}
```

## System Flow

1. User logs in and gets JWT token.
2. User asks health question from chatbot page.
3. Backend validates and sanitizes input.
4. AI service returns structured response.
5. Response is stored in MongoDB and sent to frontend.
6. If AI fails, backend uses disease-name matching from PostgreSQL and returns fallback advisory.

## API Response Format

Success format:

```json
{
  "success": true,
  "message": "Chat generated successfully",
  "data": {}
}
```

Error format:

```json
{
  "success": false,
  "message": "Validation error",
  "error": "Email is required",
  "requestId": "abcd-1234"
}
```

## Important Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login` (rate-limited)
- `POST /api/chat` (protected + rate-limited)
- `GET /api/chat/history?page=1&limit=10` (protected)
- `GET /api/hospitals?city=<city>`
- `POST /api/hospitals` (admin only)
- `GET /api/diseases`
- `POST /api/diseases` (admin only)
- `GET /api/health`

## Database Schema Explanation

### PostgreSQL (structured relational data)

- `users`: identity, credentials, role
- `hospitals`: fixed attributes and search by city
- `diseases`: verified disease awareness content used for fallback

### MongoDB (flexible chat records)

- `chats`: each user query + structured AI output + risk level + timestamps

### Why PostgreSQL + MongoDB?

- PostgreSQL gives strong constraints for auth/admin data.
- MongoDB fits dynamic chat payloads and history growth.
- This split keeps data modeling practical and easy to explain.

## AI Prompt and Fallback Logic

- AI integration is API-based (no custom model training).
- Prompt asks for strict JSON output with fixed keys.
- Response parser validates and normalizes risk level.
- If AI fails:
  - query is matched against `diseases.disease_name` using case-insensitive containment logic
  - if matched, return verified disease details
  - else, return a safe general advisory

## Risk Classification Logic

Risk classification is based on rule-based symptom severity mapping combined with AI context interpretation.

- High: emergency-like terms (example: chest pain, breathing difficulty)
- Medium: moderate concern terms (example: fever, persistent pain)
- Low: general awareness level

## Security Implemented

- Password hashing with bcrypt
- JWT authentication middleware
- Role-based middleware for admin routes
- Input validation using Joi
- Input sanitization using sanitize-html
- Rate limiting for chat endpoint
- Additional rate limiting on login endpoint
- Centralized error handling with request ID
- Structured logging

## Operational Readiness

- Startup fails fast if PostgreSQL or MongoDB connection fails
- Graceful shutdown on `SIGINT` / `SIGTERM`
- DB connections are closed before exit
- Health check available for Docker/CI monitoring

## Trade-offs

- LLM API is used instead of self-trained NLP model to keep project scope practical and implementation-focused.
- Rule-based risk mapping is simple and explainable but not a clinical diagnostic model.
- Dual database setup adds slight complexity but improves data-model fit.

## Local Setup

### 1) Backend setup

```bash
cd backend
npm install
copy .env.example .env
npm run seed
npm run dev
```

### 2) Frontend setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

## Environment Variables

### Backend (`backend/.env`)

- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `POSTGRES_URI`
- `MONGO_URI`
- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_MODEL`
- `FRONTEND_URL`

### Frontend (`frontend/.env`)

- `VITE_API_BASE_URL`

## Default Notes for Demo

- Seed script inserts 20 hospitals and 10 disease records.
- Seed script is idempotent and avoids duplicates.
- Register a user normally.
- Admin role can be assigned directly in PostgreSQL `users` table (`role = 'admin'`) for demo.

## Disclaimer

Every AI response includes:

"This information is for awareness only and not a substitute for professional medical advice."

## Future Scope

- Multilingual support
- Geolocation-based nearest hospital suggestions
- Better risk scoring using medical protocol data
- Automated test coverage and CI checks
- Optional doctor escalation workflow for high-risk cases

