-- Migration: tasks
-- Trackable units of work dispatched by agents or operators

CREATE TABLE IF NOT EXISTS tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  assigned_to   text,                                    -- agent name or 'operator'
  skill_id      uuid,                                    -- FK to skills_registry (nullable)
  lead_id       uuid,                                    -- related lead (nullable)
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'blocked', 'done', 'cancelled')),
  priority      text NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  artifacts     jsonb DEFAULT '{}'::jsonb,
  result        text,
  due_at        timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_assigned ON tasks (assigned_to);
CREATE INDEX idx_tasks_lead_id ON tasks (lead_id);
CREATE INDEX idx_tasks_priority ON tasks (priority);
CREATE INDEX idx_tasks_created_at ON tasks (created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();
