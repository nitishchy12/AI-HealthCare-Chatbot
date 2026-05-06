-- Migration 002: User sessions table for refresh token management
-- Up

CREATE TABLE IF NOT EXISTS user_sessions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT        NOT NULL UNIQUE,
  ip                 VARCHAR(45),
  user_agent         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at         TIMESTAMPTZ,
  last_active_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id       ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash    ON user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active   ON user_sessions(last_active_at);
