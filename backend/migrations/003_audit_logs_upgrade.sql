-- Migration 003: Upgrade audit_logs to structured schema
-- Up

-- Add missing columns if the table already exists from seedData.js
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_role   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS target_type  VARCHAR(80),
  ADD COLUMN IF NOT EXISTS target_id    VARCHAR(80),
  ADD COLUMN IF NOT EXISTS before_state JSONB,
  ADD COLUMN IF NOT EXISTS after_state  JSONB,
  ADD COLUMN IF NOT EXISTS request_id   VARCHAR(64),
  ADD COLUMN IF NOT EXISTS ip           VARCHAR(45);

-- Rename entity_type → target_type if the old column exists (safe no-op if already renamed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE audit_logs RENAME COLUMN entity_type TO target_type_old;
  END IF;
END $$;
