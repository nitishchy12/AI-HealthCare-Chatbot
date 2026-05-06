# Data Model — HealthBot

## PostgreSQL Schema (ERD)

```mermaid
erDiagram
  users {
    int id PK
    varchar name
    varchar first_name
    varchar last_name
    varchar email UK
    text password_hash
    varchar role
    int age
    varchar gender
    text medical_notes
    varchar city
    varchar avatar_url
    varchar timezone
    varchar preferred_language
    varchar theme_preference
    jsonb notification_prefs
    text totp_secret
    bool totp_enabled
    timestamptz last_seen_at
    int failed_login_attempts
    timestamptz locked_until
    timestamptz created_at
  }

  user_sessions {
    uuid id PK
    int user_id FK
    text refresh_token_hash UK
    varchar ip
    text user_agent
    timestamptz created_at
    timestamptz revoked_at
    timestamptz last_active_at
  }

  hospitals {
    int id PK
    varchar name
    varchar city
    text address
    varchar phone
    varchar latitude
    varchar longitude
    numeric rating
    varchar specialization
    timestamptz created_at
  }

  diseases {
    int id PK
    varchar disease_name UK
    text symptoms
    text prevention
    text treatment
    text risk_factors
    timestamptz created_at
  }

  health_tips {
    int id PK
    varchar title
    text description
    varchar category
    timestamptz created_at
  }

  audit_logs {
    int id PK
    int actor_id FK
    varchar actor_role
    varchar action
    varchar target_type
    varchar target_id
    jsonb before_state
    jsonb after_state
    varchar request_id
    varchar ip
    timestamptz created_at
  }

  users ||--o{ user_sessions : "has"
  users ||--o{ audit_logs    : "actor"
```

## MongoDB Collections

### `conversations`
```json
{
  "_id":             "ObjectId",
  "userId":          123,
  "title":           "I have fever and headache",
  "language":        "en",
  "is_deleted":      false,
  "message_count":   4,
  "total_tokens":    1240,
  "summary":         "",
  "last_message_at": "2026-04-29T10:00:00Z",
  "created_at":      "2026-04-29T09:55:00Z"
}
```

### `messages`
```json
{
  "_id":              "ObjectId",
  "conversationId":   "ObjectId",
  "role":             "user | assistant | system",
  "content":          "Plain text content",
  "structured_output": {
    "symptoms_detected": ["fever"],
    "risk_level":        "Medium",
    "confidence":        0.78,
    "citations":         []
  },
  "prompt_version":   "health-awareness-v2",
  "latency_ms":       342,
  "created_at":       "2026-04-29T10:00:05Z"
}
```

### `symptomchecks`
```json
{
  "_id":     "ObjectId",
  "userId":  123,
  "symptoms": ["Fever", "Headache"],
  "followUpAnswers": {
    "feverDays":           2,
    "breathingDifficulty": false,
    "chestPain":           false,
    "fatigueLevel":        "Low"
  },
  "riskScore":      4,
  "riskLevel":      "Medium",
  "possibleDisease":"Viral infection",
  "emergency":      false,
  "recommendations":["Rest", "Stay hydrated"],
  "created_at":     "2026-04-29T10:10:00Z"
}
```

### `feedbacks`
```json
{
  "_id":            "ObjectId",
  "userId":         123,
  "messageId":      "string",
  "conversationId": "string",
  "rating":         1,
  "reason":         "Helpful",
  "comment":        "Good answer",
  "created_at":     "2026-04-29T10:15:00Z"
}
```

## Design Rationale

| Decision | Reasoning |
|---|---|
| PostgreSQL for users + hospitals | Strong constraints (UNIQUE email, FK integrity), ACID guarantees for auth/billing-adjacent data |
| MongoDB for conversations | Schema-free — `structured_output` varies per AI model version; horizontal scale for high-volume chat |
| Redis for sessions + cache | Sub-millisecond reads; TTL-based expiry natural fit for tokens and tool cache |
| Qdrant for embeddings | Best-in-class filtered vector search; native Docker; no cloud dependency |
| Soft-delete on conversations | Preserves audit trail; user can "undo" delete within a grace window |
| Argon2id for passwords | OWASP recommended; memory-hard, resistant to GPU brute-force |
| UUID for session IDs | Unpredictable; safe to store in client localStorage as opaque token |
