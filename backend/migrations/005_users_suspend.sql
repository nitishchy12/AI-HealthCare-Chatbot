-- Migration 005: Add suspended_at to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
