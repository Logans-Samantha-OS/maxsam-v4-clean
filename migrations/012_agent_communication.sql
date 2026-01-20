-- ============================================================================
-- Migration 012: Multi-Agent Communication & Coordination Layer
-- ============================================================================
--
-- PURPOSE: Enable ALEX, ELEANOR, SAM, and SYSTEM agents to coordinate
--
-- Features:
--   - Agent registry with capabilities and heartbeats
--   - Inter-agent message queue with priorities
--   - Task pipeline with chaining support
--   - Autonomous goals with cron triggers
--   - Persistent agent memory system
--   - N8N workflow integration
--
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs/sql
-- ============================================================================

-- ============================================================================
-- TABLE: agents - Registry of all system agents
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Agent identification
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  description TEXT,

  -- Agent type and capabilities
  agent_type TEXT CHECK (agent_type IN ('orchestrator', 'scorer', 'outreach', 'system', 'human')),
  capabilities TEXT[] DEFAULT '{}',  -- e.g., ['score_leads', 'send_sms', 'generate_contracts']

  -- Status and health
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled', 'error')),
  last_heartbeat TIMESTAMPTZ,
  heartbeat_interval_seconds INTEGER DEFAULT 60,

  -- Configuration
  config JSONB DEFAULT '{}',
  rate_limit_per_minute INTEGER,
  rate_limit_per_hour INTEGER,

  -- Metrics
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,

  -- Ownership
  owner TEXT,  -- human owner if applicable

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: agent_messages - Inter-agent message queue
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Routing
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,

  -- Message details
  message_type TEXT NOT NULL,  -- 'task_request', 'task_result', 'notification', 'query', 'command'
  subject TEXT,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),  -- 1=lowest, 10=highest

  -- Payload
  payload JSONB DEFAULT '{}',

  -- References
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,
  task_id UUID,
  in_reply_to UUID REFERENCES agent_messages(id) ON DELETE SET NULL,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  processed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,

  -- Expiration
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: agent_tasks - Discrete work units
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task identification
  task_type TEXT NOT NULL,  -- 'score_lead', 'skip_trace', 'send_sms', 'generate_contract', etc.
  task_name TEXT,

  -- Assignment
  assigned_agent TEXT,
  created_by_agent TEXT,

  -- Lead association
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE CASCADE,

  -- Input/Output
  input JSONB DEFAULT '{}',
  output JSONB,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Task chaining
  parent_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  sequence_number INTEGER,  -- order in chain

  -- Priority and scheduling
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  scheduled_for TIMESTAMPTZ,
  deadline TIMESTAMPTZ,

  -- Timestamps
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: agent_goals - Autonomous objectives (cron-triggered)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Goal identification
  name TEXT NOT NULL UNIQUE,
  description TEXT,

  -- Assignment
  assigned_agent TEXT NOT NULL,

  -- Schedule
  schedule_type TEXT CHECK (schedule_type IN ('continuous', 'hourly', 'daily', 'weekly', 'monthly', 'cron')),
  cron_expression TEXT,  -- e.g., '0 9 * * *' for 9 AM daily
  timezone TEXT DEFAULT 'America/Chicago',

  -- Target metrics
  target_metric TEXT,  -- e.g., 'leads_scored', 'contacts_made', 'contracts_sent'
  target_value INTEGER,
  current_value INTEGER DEFAULT 0,

  -- Actions to take
  actions JSONB DEFAULT '[]',  -- array of action definitions

  -- Constraints
  max_actions_per_run INTEGER DEFAULT 100,
  lead_filters JSONB,  -- criteria for selecting leads

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_result JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: agent_memories - Persistent context per agent
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Memory identification
  agent_name TEXT NOT NULL,
  memory_key TEXT NOT NULL,

  -- Memory content
  memory_value JSONB NOT NULL,
  memory_type TEXT CHECK (memory_type IN ('fact', 'preference', 'learned', 'context', 'relationship', 'goal')),

  -- Confidence and relevance
  confidence DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),

  -- Lead association (optional)
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE CASCADE,

  -- Access tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  -- Expiration
  expires_at TIMESTAMPTZ,

  -- Source
  source TEXT,  -- where this memory came from
  source_message_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_agent_memory UNIQUE (agent_name, memory_key)
);

-- ============================================================================
-- TABLE: workflow_definitions - N8N webhook registry
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workflow identification
  workflow_id TEXT NOT NULL UNIQUE,  -- N8N workflow ID
  workflow_name TEXT NOT NULL,
  description TEXT,

  -- Webhook configuration
  webhook_path TEXT,  -- e.g., '/webhook/skip-trace'
  full_webhook_url TEXT,  -- full URL for triggering

  -- Agent association
  owning_agent TEXT,
  capabilities_provided TEXT[],

  -- Input/Output schema
  input_schema JSONB,
  output_schema JSONB,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_registered_in_n8n BOOLEAN DEFAULT false,

  -- Metrics
  trigger_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER,

  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: workflow_executions - Execution audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workflow reference
  workflow_id TEXT NOT NULL,
  workflow_definition_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL,

  -- Execution details
  execution_id TEXT,  -- N8N execution ID
  triggered_by TEXT,  -- agent name or 'manual' or 'cron'

  -- Input/Output
  input_payload JSONB,
  output_payload JSONB,

  -- Lead association
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout')),
  error_message TEXT,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCTION: send_agent_message - Send message to another agent
-- ============================================================================
CREATE OR REPLACE FUNCTION send_agent_message(
  p_from_agent TEXT,
  p_to_agent TEXT,
  p_message_type TEXT,
  p_payload JSONB,
  p_priority INTEGER DEFAULT 5,
  p_lead_id UUID DEFAULT NULL,
  p_expires_in_minutes INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiration if specified
  IF p_expires_in_minutes IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_in_minutes || ' minutes')::INTERVAL;
  END IF;

  INSERT INTO agent_messages (
    from_agent, to_agent, message_type, payload, priority, lead_id, expires_at
  ) VALUES (
    p_from_agent, p_to_agent, p_message_type, p_payload, p_priority, p_lead_id, v_expires_at
  )
  RETURNING id INTO v_message_id;

  -- Update sender's message count
  UPDATE agents SET messages_sent = messages_sent + 1, updated_at = NOW()
  WHERE name = p_from_agent;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: get_agent_messages - Get pending messages for an agent
-- ============================================================================
CREATE OR REPLACE FUNCTION get_agent_messages(
  p_agent_name TEXT,
  p_limit INTEGER DEFAULT 10,
  p_mark_processing BOOLEAN DEFAULT true
)
RETURNS SETOF agent_messages AS $$
DECLARE
  v_message_ids UUID[];
BEGIN
  -- Get pending messages ordered by priority and creation time
  SELECT ARRAY_AGG(id) INTO v_message_ids
  FROM (
    SELECT id FROM agent_messages
    WHERE to_agent = p_agent_name
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT p_limit
  ) sub;

  -- Mark as processing if requested
  IF p_mark_processing AND v_message_ids IS NOT NULL THEN
    UPDATE agent_messages
    SET status = 'processing', processed_at = NOW()
    WHERE id = ANY(v_message_ids);

    -- Update receiver's message count
    UPDATE agents SET messages_received = messages_received + array_length(v_message_ids, 1), updated_at = NOW()
    WHERE name = p_agent_name;
  END IF;

  -- Return the messages
  RETURN QUERY
  SELECT * FROM agent_messages
  WHERE id = ANY(v_message_ids)
  ORDER BY priority DESC, created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: remember - Upsert agent memory
-- ============================================================================
CREATE OR REPLACE FUNCTION remember(
  p_agent_name TEXT,
  p_key TEXT,
  p_value JSONB,
  p_type TEXT DEFAULT 'fact',
  p_lead_id UUID DEFAULT NULL,
  p_confidence DECIMAL DEFAULT 1.0,
  p_expires_in_days INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_memory_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_expires_in_days IS NOT NULL THEN
    v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;
  END IF;

  INSERT INTO agent_memories (
    agent_name, memory_key, memory_value, memory_type, lead_id, confidence, expires_at
  ) VALUES (
    p_agent_name, p_key, p_value, p_type, p_lead_id, p_confidence, v_expires_at
  )
  ON CONFLICT (agent_name, memory_key) DO UPDATE SET
    memory_value = p_value,
    memory_type = p_type,
    lead_id = COALESCE(p_lead_id, agent_memories.lead_id),
    confidence = p_confidence,
    expires_at = v_expires_at,
    updated_at = NOW()
  RETURNING id INTO v_memory_id;

  RETURN v_memory_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: recall - Retrieve agent memory
-- ============================================================================
CREATE OR REPLACE FUNCTION recall(
  p_agent_name TEXT,
  p_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  UPDATE agent_memories
  SET access_count = access_count + 1, last_accessed_at = NOW()
  WHERE agent_name = p_agent_name
    AND memory_key = p_key
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING memory_value INTO v_value;

  RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: get_agent_context - Get all relevant memories for a lead
-- ============================================================================
CREATE OR REPLACE FUNCTION get_agent_context(
  p_agent_name TEXT,
  p_lead_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_context JSONB;
BEGIN
  SELECT jsonb_object_agg(memory_key, memory_value)
  INTO v_context
  FROM agent_memories
  WHERE agent_name = p_agent_name
    AND (p_lead_id IS NULL OR lead_id IS NULL OR lead_id = p_lead_id)
    AND (expires_at IS NULL OR expires_at > NOW());

  -- Update access counts
  UPDATE agent_memories
  SET access_count = access_count + 1, last_accessed_at = NOW()
  WHERE agent_name = p_agent_name
    AND (p_lead_id IS NULL OR lead_id IS NULL OR lead_id = p_lead_id)
    AND (expires_at IS NULL OR expires_at > NOW());

  RETURN COALESCE(v_context, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: create_task_chain - Create linked task pipeline
-- ============================================================================
CREATE OR REPLACE FUNCTION create_task_chain(
  p_lead_id UUID,
  p_tasks JSONB,  -- array of {task_type, assigned_agent, input}
  p_created_by TEXT DEFAULT 'SYSTEM'
)
RETURNS UUID[] AS $$
DECLARE
  v_task_ids UUID[] := '{}';
  v_parent_id UUID;
  v_task_id UUID;
  v_task JSONB;
  v_seq INTEGER := 1;
BEGIN
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
  LOOP
    INSERT INTO agent_tasks (
      task_type,
      task_name,
      assigned_agent,
      created_by_agent,
      lead_id,
      input,
      parent_task_id,
      sequence_number,
      priority
    ) VALUES (
      v_task->>'task_type',
      v_task->>'task_name',
      v_task->>'assigned_agent',
      p_created_by,
      p_lead_id,
      COALESCE(v_task->'input', '{}'::JSONB),
      v_parent_id,
      v_seq,
      COALESCE((v_task->>'priority')::INTEGER, 5)
    )
    RETURNING id INTO v_task_id;

    v_task_ids := array_append(v_task_ids, v_task_id);
    v_parent_id := v_task_id;
    v_seq := v_seq + 1;
  END LOOP;

  RETURN v_task_ids;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: agent_heartbeat - Update agent heartbeat
-- ============================================================================
CREATE OR REPLACE FUNCTION agent_heartbeat(
  p_agent_name TEXT,
  p_status TEXT DEFAULT NULL,
  p_config JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE agents
  SET
    last_heartbeat = NOW(),
    status = COALESCE(p_status, status),
    config = COALESCE(p_config, config),
    updated_at = NOW()
  WHERE name = p_agent_name;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: trigger_workflow - Execute N8N workflow
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_workflow(
  p_workflow_id TEXT,
  p_input JSONB,
  p_triggered_by TEXT DEFAULT 'SYSTEM',
  p_lead_id UUID DEFAULT NULL,
  p_task_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_execution_id UUID;
  v_def_id UUID;
BEGIN
  -- Get workflow definition ID
  SELECT id INTO v_def_id FROM workflow_definitions WHERE workflow_id = p_workflow_id;

  -- Create execution record
  INSERT INTO workflow_executions (
    workflow_id, workflow_definition_id, triggered_by, input_payload, lead_id, task_id, status, started_at
  ) VALUES (
    p_workflow_id, v_def_id, p_triggered_by, p_input, p_lead_id, p_task_id, 'pending', NOW()
  )
  RETURNING id INTO v_execution_id;

  -- Update workflow trigger count
  UPDATE workflow_definitions
  SET trigger_count = trigger_count + 1, last_triggered_at = NOW(), updated_at = NOW()
  WHERE workflow_id = p_workflow_id;

  RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);

CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_agent);
CREATE INDEX IF NOT EXISTS idx_agent_messages_from ON agent_messages(from_agent);
CREATE INDEX IF NOT EXISTS idx_agent_messages_status ON agent_messages(status);
CREATE INDEX IF NOT EXISTS idx_agent_messages_priority ON agent_messages(priority DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_messages_lead ON agent_messages(lead_id);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned ON agent_tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_type ON agent_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_lead ON agent_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent ON agent_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority DESC);

CREATE INDEX IF NOT EXISTS idx_agent_goals_agent ON agent_goals(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_agent_goals_active ON agent_goals(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_goals_next_run ON agent_goals(next_run_at);

CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_memories_key ON agent_memories(memory_key);
CREATE INDEX IF NOT EXISTS idx_agent_memories_lead ON agent_memories(lead_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON agent_memories(memory_type);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_id ON workflow_definitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_agent ON workflow_definitions(owning_agent);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_lead ON workflow_executions(lead_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access)
DROP POLICY IF EXISTS "agents_service_role" ON agents;
CREATE POLICY "agents_service_role" ON agents FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "agent_messages_service_role" ON agent_messages;
CREATE POLICY "agent_messages_service_role" ON agent_messages FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "agent_tasks_service_role" ON agent_tasks;
CREATE POLICY "agent_tasks_service_role" ON agent_tasks FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "agent_goals_service_role" ON agent_goals;
CREATE POLICY "agent_goals_service_role" ON agent_goals FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "agent_memories_service_role" ON agent_memories;
CREATE POLICY "agent_memories_service_role" ON agent_memories FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "workflow_definitions_service_role" ON workflow_definitions;
CREATE POLICY "workflow_definitions_service_role" ON workflow_definitions FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "workflow_executions_service_role" ON workflow_executions;
CREATE POLICY "workflow_executions_service_role" ON workflow_executions FOR ALL TO service_role USING (true);

-- ============================================================================
-- SEED DATA: System Agents
-- ============================================================================
INSERT INTO agents (name, display_name, description, agent_type, capabilities, status, config) VALUES
  (
    'ALEX',
    'Alex - The Orchestrator',
    'Master orchestrator agent. Coordinates all other agents, manages task pipelines, handles human escalations.',
    'orchestrator',
    ARRAY['coordinate_agents', 'manage_tasks', 'escalate_to_human', 'analyze_pipeline', 'generate_reports'],
    'active',
    '{"priority": 10, "can_override": true, "human_oversight": true}'::JSONB
  ),
  (
    'ELEANOR',
    'Eleanor - Lead Intelligence',
    'Lead scoring and intelligence agent. Analyzes leads, calculates scores, identifies golden opportunities.',
    'scorer',
    ARRAY['score_leads', 'analyze_lead', 'identify_golden_leads', 'calculate_potential', 'research_property'],
    'active',
    '{"scoring_model": "v2", "min_score_threshold": 50, "golden_threshold": 80}'::JSONB
  ),
  (
    'SAM',
    'Sam - Outreach Specialist',
    'Customer outreach agent. Handles SMS, email, and call scheduling. Manages conversations.',
    'outreach',
    ARRAY['send_sms', 'send_email', 'schedule_call', 'manage_conversation', 'handle_response', 'generate_contract'],
    'active',
    '{"max_daily_contacts": 100, "quiet_hours_start": 20, "quiet_hours_end": 9, "timezone": "America/Chicago"}'::JSONB
  ),
  (
    'SYSTEM',
    'System Agent',
    'Internal system agent for automated tasks, cron jobs, and system maintenance.',
    'system',
    ARRAY['run_cron', 'cleanup', 'sync_data', 'generate_alerts', 'health_check'],
    'active',
    '{"is_internal": true}'::JSONB
  ),
  (
    'RALPH',
    'Ralph - Execution Engine',
    'Autonomous execution engine. Runs task queues, manages workflows, ensures progress.',
    'orchestrator',
    ARRAY['execute_tasks', 'manage_queue', 'retry_failed', 'parallel_execution', 'workflow_orchestration'],
    'active',
    '{"max_parallel_tasks": 10, "retry_delay_seconds": 300, "task_timeout_minutes": 30}'::JSONB
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ============================================================================
-- SEED DATA: N8N Workflow Definitions
-- ============================================================================
INSERT INTO workflow_definitions (workflow_id, workflow_name, description, webhook_path, full_webhook_url, owning_agent, capabilities_provided, is_active) VALUES
  (
    'skip-trace',
    'Skip Trace Workflow',
    'Looks up phone numbers and contact information for leads',
    '/webhook/skip-trace',
    'https://skooki.app.n8n.cloud/webhook/skip-trace',
    'ELEANOR',
    ARRAY['lookup_phone', 'find_contacts'],
    true
  ),
  (
    'eleanor-score',
    'Eleanor Scoring Workflow',
    'Calculates lead scores using Eleanor AI model',
    '/webhook/eleanor-score',
    'https://skooki.app.n8n.cloud/webhook/eleanor-score',
    'ELEANOR',
    ARRAY['score_lead', 'analyze_potential'],
    true
  ),
  (
    'sam-initial-outreach',
    'Sam Initial Outreach',
    'Sends initial contact SMS to new leads',
    '/webhook/sam-outreach',
    'https://skooki.app.n8n.cloud/webhook/sam-outreach',
    'SAM',
    ARRAY['send_initial_sms'],
    true
  ),
  (
    'sam-followup',
    'Sam Follow-up Workflow',
    'Sends follow-up messages to non-responsive leads',
    '/webhook/sam-followup',
    'https://skooki.app.n8n.cloud/webhook/sam-followup',
    'SAM',
    ARRAY['send_followup_sms'],
    true
  ),
  (
    'deal-blast',
    'Deal Blast to Buyers',
    'Broadcasts qualified deals to buyer network',
    '/webhook/deal-blast',
    'https://skooki.app.n8n.cloud/webhook/deal-blast',
    'SAM',
    ARRAY['blast_to_buyers', 'notify_network'],
    true
  ),
  (
    'doc-generator',
    'Document Generator',
    'Generates and sends contracts via DocuSign/BoldSign',
    '/webhook/doc-generator',
    'https://skooki.app.n8n.cloud/webhook/doc-generator',
    'SAM',
    ARRAY['generate_contract', 'send_for_signature'],
    true
  ),
  (
    'pdf-processor',
    'PDF Processor',
    'Extracts lead data from Dallas County excess funds PDFs',
    '/webhook/pdf-processor',
    'https://skooki.app.n8n.cloud/webhook/pdf-processor',
    'SYSTEM',
    ARRAY['extract_pdf', 'import_leads'],
    true
  )
ON CONFLICT (workflow_id) DO UPDATE SET
  workflow_name = EXCLUDED.workflow_name,
  description = EXCLUDED.description,
  webhook_path = EXCLUDED.webhook_path,
  full_webhook_url = EXCLUDED.full_webhook_url,
  owning_agent = EXCLUDED.owning_agent,
  capabilities_provided = EXCLUDED.capabilities_provided,
  updated_at = NOW();

-- ============================================================================
-- SEED DATA: Agent Goals (Autonomous Objectives)
-- ============================================================================
INSERT INTO agent_goals (name, description, assigned_agent, schedule_type, cron_expression, target_metric, target_value, actions, max_actions_per_run, is_active) VALUES
  (
    'daily_lead_scoring',
    'Score all unscored leads every morning at 6 AM',
    'ELEANOR',
    'daily',
    '0 6 * * *',
    'leads_scored',
    100,
    '[{"type": "score_leads", "filter": {"scored_at": null}}]'::JSONB,
    100,
    true
  ),
  (
    'daily_outreach',
    'Contact high-scoring leads with phone numbers at 9 AM',
    'SAM',
    'daily',
    '0 9 * * *',
    'contacts_made',
    50,
    '[{"type": "initial_outreach", "filter": {"eleanor_score": {"gte": 60}, "has_phone": true, "status": "new"}}]'::JSONB,
    50,
    true
  ),
  (
    'followup_non_responders',
    'Follow up with leads who have not responded after 2 days',
    'SAM',
    'daily',
    '0 14 * * *',
    'followups_sent',
    30,
    '[{"type": "send_followup", "filter": {"last_contact_days_ago": {"gte": 2}, "status": "contacted", "response_count": 0}}]'::JSONB,
    30,
    true
  ),
  (
    'identify_golden_leads',
    'Scan for new golden lead opportunities every 4 hours',
    'ELEANOR',
    'cron',
    '0 */4 * * *',
    'golden_leads_found',
    10,
    '[{"type": "identify_golden", "criteria": {"excess_funds_amount": {"gte": 10000}, "eleanor_score": {"gte": 75}}}]'::JSONB,
    50,
    true
  )
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  assigned_agent = EXCLUDED.assigned_agent,
  schedule_type = EXCLUDED.schedule_type,
  cron_expression = EXCLUDED.cron_expression,
  target_metric = EXCLUDED.target_metric,
  target_value = EXCLUDED.target_value,
  actions = EXCLUDED.actions,
  max_actions_per_run = EXCLUDED.max_actions_per_run,
  updated_at = NOW();

-- ============================================================================
-- LOG MIGRATION
-- ============================================================================
DO $$
BEGIN
  INSERT INTO system_config (key, value)
  VALUES ('migration_012_completed', NOW()::text)
  ON CONFLICT (key) DO UPDATE SET value = NOW()::text;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'system_config table does not exist, skipping log';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- SELECT * FROM agents;
-- SELECT * FROM workflow_definitions;
-- SELECT * FROM agent_goals WHERE is_active = true;
-- SELECT send_agent_message('ALEX', 'ELEANOR', 'task_request', '{"action": "score_lead", "lead_id": "xxx"}'::JSONB);
-- SELECT * FROM get_agent_messages('ELEANOR');
-- SELECT remember('ELEANOR', 'scoring_preferences', '{"prefer_high_equity": true}'::JSONB, 'preference');
-- SELECT recall('ELEANOR', 'scoring_preferences');
-- ============================================================================
