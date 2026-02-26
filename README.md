# AI-Driven Public Health Chatbot for Disease Awareness

A full-stack final year capstone project designed at practical SDE-1 level.

## Tech Stack

- Frontend: React.js (Vite)
- Backend: Node.js + Express.js
- Databases:
  - PostgreSQL for users, hospitals, disease info
  - MongoDB for chat history and AI response logs
- Auth: JWT + bcrypt
- Security: Helmet, CORS, validation, sanitization, rate limiting

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
- Admin panel:
  - Add hospital
  - Add verified disease info
- Input validation and centralized error handling
- AI fallback handling using verified disease data

## System Flow

1. User logs in and gets JWT token.
2. User asks health question from chatbot page.
3. Backend validates and sanitizes input.
4. AI service returns structured response.
5. Response is stored in MongoDB and sent to frontend.
6. If AI fails, backend returns verified fallback data from PostgreSQL disease table.

## API Response Format

All endpoints use consistent format:

```json
{
  "success": true,
  "message": "Chat generated successfully",
  "data": {}
}
```

## Important Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/chat` (Protected + rate-limited)
- `GET /api/chat/history` (Protected)
- `GET /api/hospitals?city=<city>`
- `POST /api/hospitals` (Admin only)
- `GET /api/diseases`
- `POST /api/diseases` (Admin only)

## Environment Variables

### Backend (`backend/.env`)

Use `backend/.env.example` as reference:

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

Use `frontend/.env.example` as reference:

- `VITE_API_BASE_URL`

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

## Default Notes for Demo

- Seed script inserts 20 hospitals and 10 disease records.
- Register a user normally.
- Admin role can be assigned directly in PostgreSQL `users` table (`role = 'admin'`) for demo.

## Security Implemented

- Password hashing with bcrypt
- JWT authentication middleware
- Role-based middleware for admin routes
- Input validation using Joi
- Input sanitization using sanitize-html
- Rate limiting for chat endpoint
- Centralized error handling
- Basic structured logging

## Disclaimer

Every AI response includes:

"This information is for awareness only and not a substitute for professional medical advice."

## Future Scope

- Replace simulated AI service with real API integration
- Add multilingual support
- Add map-based hospital distance search
- Add refresh tokens and email verification
- Add automated tests and CI pipeline
