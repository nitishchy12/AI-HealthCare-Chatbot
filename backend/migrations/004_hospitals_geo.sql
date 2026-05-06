-- Migration 004: Add geolocation + emergency flag to hospitals
ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6),
  ADD COLUMN IF NOT EXISTS emergency_24h BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating DECIMAL(3,1) DEFAULT 4.0,
  ADD COLUMN IF NOT EXISTS specialties   TEXT[] DEFAULT '{}';

-- Backfill specialties array from existing specialization text column
UPDATE hospitals
SET specialties = ARRAY[specialization]
WHERE specialization IS NOT NULL AND specialization <> '' AND specialties = '{}';
