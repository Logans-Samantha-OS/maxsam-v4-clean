-- Router Service Tables
-- Run this in Supabase SQL Editor

-- Router tasks: every inbound /run request
CREATE TABLE IF NOT EXISTS router_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'n8n',
  status TEXT NOT NULL DEFAULT 'received',
  sensitivity TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Router decisions: the routing decision for each task
CREATE TABLE IF NOT EXISTS router_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES router_tasks(id),
  route TEXT NOT NULL,
  model TEXT NOT NULL,
  reason TEXT NOT NULL,
  confidence NUMERIC(4,2) NOT NULL,
  escalation_level INTEGER NOT NULL DEFAULT 0,
  cost_estimate NUMERIC(10,6) NOT NULL DEFAULT 0,
  policy_snapshot JSONB,
  governance_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Router events: execution results and audit trail
CREATE TABLE IF NOT EXISTS router_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES router_tasks(id),
  decision_id UUID REFERENCES router_decisions(id),
  event_type TEXT NOT NULL,
  tier TEXT NOT NULL,
  model TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  token_count INTEGER,
  error_message TEXT,
  response_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default routing policy
INSERT INTO system_registry (key, value)
VALUES (
  'router_policy',
  '{
    "default_tier": "local",
    "local_ratio": 0.80,
    "max_local_retries": 2,
    "context_threshold_tokens": 4000,
    "escalation_rules": {
      "local_fail_count": 2,
      "invalid_json_escalate": true,
      "context_overflow_escalate": true
    },
    "premium_trigger": "sensitivity_high_only",
    "fallback_chain": ["local", "market", "premium"],
    "models": {
      "local": "llama3.1:8b",
      "market": "meta-llama/llama-3.1-70b-instruct",
      "premium": "claude-sonnet-4-20250514"
    }
  }'::JSONB
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Seed governance level
INSERT INTO system_registry (key, value)
VALUES (
  'governance',
  '{
    "level": "standard",
    "require_audit": true,
    "require_explanation": true,
    "max_cost_per_request": 0.50,
    "premium_approval_required": false
  }'::JSONB
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_router_tasks_status ON router_tasks(status);
CREATE INDEX IF NOT EXISTS idx_router_tasks_created ON router_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_router_decisions_task ON router_decisions(task_id);
CREATE INDEX IF NOT EXISTS idx_router_events_task ON router_events(task_id);
CREATE INDEX IF NOT EXISTS idx_router_events_type ON router_events(event_type);
