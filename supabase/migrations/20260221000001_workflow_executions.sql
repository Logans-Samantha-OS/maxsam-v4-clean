-- Migration: workflow_executions
-- Tracks every API/webhook/cron execution for auditability

CREATE TABLE IF NOT EXISTS workflow_executions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_path  text NOT NULL,
  workflow_name text,
  instruction_id text,
  lead_id       uuid,
  status        text NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received', 'running', 'success', 'failure')),
  artifacts     jsonb DEFAULT '{}'::jsonb,
  error         text,
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wfx_status ON workflow_executions (status);
CREATE INDEX idx_wfx_webhook_path ON workflow_executions (webhook_path);
CREATE INDEX idx_wfx_lead_id ON workflow_executions (lead_id);
CREATE INDEX idx_wfx_created_at ON workflow_executions (created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_workflow_executions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workflow_executions_updated_at
  BEFORE UPDATE ON workflow_executions
  FOR EACH ROW EXECUTE FUNCTION update_workflow_executions_updated_at();
