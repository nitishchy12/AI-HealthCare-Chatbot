-- Migration 001: Auth upgrade — extend users table
-- Up

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name            VARCHAR(60),
  ADD COLUMN IF NOT EXISTS last_name             VARCHAR(60),
  ADD COLUMN IF NOT EXISTS avatar_url            TEXT,
  ADD COLUMN IF NOT EXISTS timezone              VARCHAR(60)  DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS preferred_language    VARCHAR(10)  DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS theme_preference      VARCHAR(10)  DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS notification_prefs    JSONB        DEFAULT '{"email":true,"push":false,"daily_tip":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS totp_secret           TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled          BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_seen_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until          TIMESTAMPTZ;

-- Backfill first_name from existing name column
UPDATE users
SET first_name = split_part(name, ' ', 1),
    last_name  = NULLIF(trim(substring(name FROM position(' ' IN name) + 1)), '')
WHERE first_name IS NULL AND name IS NOT NULL;
