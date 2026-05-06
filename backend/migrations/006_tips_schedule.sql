-- Migration 006: Add scheduling + is_active to health_tips
ALTER TABLE health_tips
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT true;
