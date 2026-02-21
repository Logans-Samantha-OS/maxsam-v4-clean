-- Migration: system_flags
-- Global boolean flags for system-wide controls (pause, maintenance, etc.)

CREATE TABLE IF NOT EXISTS system_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key    text NOT NULL UNIQUE,
  enabled     boolean NOT NULL DEFAULT false,
  changed_by  text,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sflags_key ON system_flags (flag_key);

-- Seed the pause_all flag (disabled by default)
INSERT INTO system_flags (flag_key, enabled, changed_by, reason)
VALUES ('pause_all', false, 'migration', 'Initial seed — system operational')
ON CONFLICT (flag_key) DO NOTHING;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_system_flags_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_system_flags_updated_at
  BEFORE UPDATE ON system_flags
  FOR EACH ROW EXECUTE FUNCTION update_system_flags_updated_at();
