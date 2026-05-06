-- Migration 008: Regional health alerts
CREATE TABLE IF NOT EXISTS regional_alerts (
  id          SERIAL PRIMARY KEY,
  region      VARCHAR(100) NOT NULL,
  condition   VARCHAR(200) NOT NULL,
  severity    VARCHAR(20)  CHECK (severity IN ('low','medium','high','critical')),
  message     TEXT,
  valid_from  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  source      VARCHAR(100),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regional_alerts_region ON regional_alerts(region);
CREATE INDEX IF NOT EXISTS idx_regional_alerts_valid  ON regional_alerts(valid_from, valid_until);

-- Seed 3 example alerts
INSERT INTO regional_alerts (region, condition, severity, message, valid_until, source)
SELECT * FROM (VALUES
  ('Punjab',    'Dengue Alert',        'high',   'Elevated dengue cases in Phagwara and Ludhiana. Use mosquito repellent and eliminate stagnant water.',          NOW() + INTERVAL '30 days', 'Punjab Health Department'),
  ('Delhi NCR', 'Air Quality Warning', 'medium', 'AQI above 200. Avoid outdoor activity. Asthma patients should keep inhalers accessible.',                       NOW() + INTERVAL '7 days',  'CPCB'),
  ('India',     'Influenza Season',    'low',    'Annual influenza season underway. Vaccination recommended for elderly, children and immunocompromised patients.', NOW() + INTERVAL '60 days', 'ICMR')
) AS v(region, condition, severity, message, valid_until, source)
WHERE NOT EXISTS (SELECT 1 FROM regional_alerts WHERE regional_alerts.region = v.region AND regional_alerts.condition = v.condition);
