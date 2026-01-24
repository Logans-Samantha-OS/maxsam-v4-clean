-- MAXSAM V4 AGENT INTELLIGENCE SYSTEM
-- Run this migration to set up agent autonomy

-- ============================================
-- PART 1: WORKFLOW STATE PERSISTENCE
-- ============================================

CREATE TABLE IF NOT EXISTS workflow_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  run_id TEXT,
  lead_id UUID,
  state JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed', 'skipped'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_state_lead ON workflow_state(lead_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state_name ON workflow_state(workflow_name);
CREATE INDEX IF NOT EXISTS idx_workflow_state_status ON workflow_state(status);
CREATE INDEX IF NOT EXISTS idx_workflow_state_started ON workflow_state(started_at DESC);

-- ============================================
-- PART 2: AGENT GOALS & STATE TRACKING
-- ============================================

-- Agent goals with daily tracking
CREATE TABLE IF NOT EXISTS agent_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL, -- 'ALEX', 'ELEANOR', 'SAM', 'RALPH'
  goal TEXT NOT NULL,
  goal_key TEXT, -- machine-readable key like 'score_leads', 'contact_golden'
  priority INTEGER DEFAULT 5, -- 1=highest, 10=lowest
  target_daily INTEGER, -- daily target (null = no target)
  current_daily INTEGER DEFAULT 0,
  last_reset DATE DEFAULT CURRENT_DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_goals_agent ON agent_goals(agent);
CREATE INDEX IF NOT EXISTS idx_agent_goals_active ON agent_goals(active);

-- Agent state (current status of each agent)
CREATE TABLE IF NOT EXISTS agent_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'idle', -- 'idle', 'working', 'paused', 'error'
  current_task TEXT,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  context JSONB DEFAULT '{}', -- arbitrary state data
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agent decisions (audit trail with reasoning)
CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL,
  situation TEXT NOT NULL, -- what the agent observed
  options JSONB, -- what options it considered
  decision TEXT NOT NULL, -- what it chose
  reasoning TEXT, -- why it chose that
  outcome TEXT, -- what happened
  success BOOLEAN,
  lead_id UUID, -- if decision was about a specific lead
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent ON agent_decisions(agent);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_created ON agent_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_lead ON agent_decisions(lead_id);

-- ============================================
-- PART 3: SHARED AGENT MEMORY
-- ============================================

-- Agent memories about leads (shared knowledge)
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  agent TEXT NOT NULL,
  memory_type TEXT NOT NULL, -- 'discovery', 'assessment', 'interaction', 'insight', 'warning'
  content TEXT NOT NULL,
  importance INTEGER DEFAULT 5, -- 1=critical, 10=trivial
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ, -- optional expiry for time-sensitive info
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_lead ON agent_memories(lead_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_created ON agent_memories(created_at DESC);

-- ============================================
-- PART 4: INSERT DEFAULT GOALS
-- ============================================

-- ALEX goals
INSERT INTO agent_goals (agent, goal, goal_key, priority, target_daily) VALUES
('ALEX', 'Process new county PDFs', 'process_pdfs', 2, 5),
('ALEX', 'Query NotebookLM for new leads', 'query_notebook', 3, 3),
('ALEX', 'Skip trace leads missing phones', 'skip_trace', 4, 50),
('ALEX', 'Cross-reference property records', 'cross_reference', 5, 20)
ON CONFLICT DO NOTHING;

-- ELEANOR goals
INSERT INTO agent_goals (agent, goal, goal_key, priority, target_daily) VALUES
('ELEANOR', 'Score unscored leads', 'score_leads', 2, 100),
('ELEANOR', 'Identify golden leads', 'identify_golden', 1, 20),
('ELEANOR', 'Re-score stale leads (>7 days)', 'rescore_stale', 6, 30),
('ELEANOR', 'Calculate deal potential', 'calc_potential', 4, 50)
ON CONFLICT DO NOTHING;

-- SAM goals
INSERT INTO agent_goals (agent, goal, goal_key, priority, target_daily) VALUES
('SAM', 'Contact golden leads immediately', 'contact_golden', 1, 20),
('SAM', 'Follow up non-responders (48hr)', 'followup_48hr', 3, 30),
('SAM', 'Re-engage cold leads (7 day)', 'reengage_cold', 5, 20),
('SAM', 'Urgency outreach - expiring claims', 'urgency_expiring', 1, 10),
('SAM', 'Send agreement to qualified leads', 'send_agreements', 2, 10)
ON CONFLICT DO NOTHING;

-- RALPH goals
INSERT INTO agent_goals (agent, goal, goal_key, priority, target_daily) VALUES
('RALPH', 'Monitor pipeline health', 'monitor_pipeline', 1, NULL),
('RALPH', 'Generate morning brief', 'morning_brief', 4, 1),
('RALPH', 'Alert on stuck workflows', 'alert_stuck', 2, NULL),
('RALPH', 'Coordinate agent priorities', 'coordinate', 3, NULL)
ON CONFLICT DO NOTHING;

-- ============================================
-- PART 5: INSERT INITIAL AGENT STATES
-- ============================================

INSERT INTO agent_state (agent, status) VALUES
('ALEX', 'idle'),
('ELEANOR', 'idle'),
('SAM', 'idle'),
('RALPH', 'idle')
ON CONFLICT (agent) DO NOTHING;

-- ============================================
-- PART 6: HELPER FUNCTIONS
-- ============================================

-- Function to reset daily goal counters (called at midnight)
CREATE OR REPLACE FUNCTION reset_daily_goals()
RETURNS void AS $$
BEGIN
  UPDATE agent_goals
  SET current_daily = 0, last_reset = CURRENT_DATE
  WHERE last_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment goal progress
CREATE OR REPLACE FUNCTION increment_goal_progress(
  p_agent TEXT,
  p_goal_key TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  UPDATE agent_goals
  SET current_daily = current_daily + p_amount
  WHERE agent = p_agent AND goal_key = p_goal_key AND active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to get agent's pending work
CREATE OR REPLACE FUNCTION get_agent_pending_work(p_agent TEXT)
RETURNS TABLE (
  goal TEXT,
  goal_key TEXT,
  priority INTEGER,
  target_daily INTEGER,
  current_daily INTEGER,
  remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.goal,
    g.goal_key,
    g.priority,
    g.target_daily,
    g.current_daily,
    CASE
      WHEN g.target_daily IS NULL THEN NULL
      ELSE g.target_daily - g.current_daily
    END as remaining
  FROM agent_goals g
  WHERE g.agent = p_agent
    AND g.active = true
    AND (g.target_daily IS NULL OR g.current_daily < g.target_daily)
  ORDER BY g.priority ASC;
END;
$$ LANGUAGE plpgsql;
