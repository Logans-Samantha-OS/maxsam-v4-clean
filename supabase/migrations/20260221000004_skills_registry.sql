-- Migration: skills_registry
-- Registered skills that agents can invoke

CREATE TABLE IF NOT EXISTS skills_registry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,                     -- e.g. 'n8n_workflow_builder'
  name          text NOT NULL,
  description   text,
  version       text NOT NULL DEFAULT '0.1.0',
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'deprecated', 'disabled')),
  agent_owner   text,                                     -- which agent owns this skill
  input_schema  jsonb DEFAULT '{}'::jsonb,                -- expected input shape
  output_schema jsonb DEFAULT '{}'::jsonb,                -- expected output shape
  n8n_workflow_id text,                                   -- linked n8n workflow (nullable)
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_skills_slug ON skills_registry (slug);
CREATE INDEX idx_skills_status ON skills_registry (status);
CREATE INDEX idx_skills_agent ON skills_registry (agent_owner);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_skills_registry_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_skills_registry_updated_at
  BEFORE UPDATE ON skills_registry
  FOR EACH ROW EXECUTE FUNCTION update_skills_registry_updated_at();
