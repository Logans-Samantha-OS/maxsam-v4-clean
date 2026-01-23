-- ============================================================================
-- Migration: Complete table setup with defensive column additions
-- ============================================================================

-- ============================================================================
-- PATCH: sms_consent - Add all missing columns
-- ============================================================================
DO $$
BEGIN
  -- Add phone column first (required for generated column)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'phone') THEN
    ALTER TABLE sms_consent ADD COLUMN phone TEXT;
  END IF;
  -- Add status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'status') THEN
    ALTER TABLE sms_consent ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
  -- Add lead_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'lead_id') THEN
    ALTER TABLE sms_consent ADD COLUMN lead_id UUID;
  END IF;
  -- Add consent_method
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'consent_method') THEN
    ALTER TABLE sms_consent ADD COLUMN consent_method TEXT;
  END IF;
  -- Add opted_in_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'opted_in_at') THEN
    ALTER TABLE sms_consent ADD COLUMN opted_in_at TIMESTAMPTZ;
  END IF;
  -- Add opted_out_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'opted_out_at') THEN
    ALTER TABLE sms_consent ADD COLUMN opted_out_at TIMESTAMPTZ;
  END IF;
  -- Add opt_out_keyword
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'opt_out_keyword') THEN
    ALTER TABLE sms_consent ADD COLUMN opt_out_keyword TEXT;
  END IF;
  -- Add opt_out_message_sid
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'opt_out_message_sid') THEN
    ALTER TABLE sms_consent ADD COLUMN opt_out_message_sid TEXT;
  END IF;
  -- Add updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'updated_at') THEN
    ALTER TABLE sms_consent ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add phone_normalized generated column (separate block since it depends on phone)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_consent' AND column_name = 'phone_normalized') THEN
    ALTER TABLE sms_consent ADD COLUMN phone_normalized TEXT GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')) STORED;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add phone_normalized: %', SQLERRM;
END $$;

-- ============================================================================
-- PATCH: sms_messages - Add missing columns
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'direction') THEN
    ALTER TABLE sms_messages ADD COLUMN direction TEXT DEFAULT 'outbound';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'from_number') THEN
    ALTER TABLE sms_messages ADD COLUMN from_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'to_number') THEN
    ALTER TABLE sms_messages ADD COLUMN to_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'body') THEN
    ALTER TABLE sms_messages ADD COLUMN body TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'message_sid') THEN
    ALTER TABLE sms_messages ADD COLUMN message_sid TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'status') THEN
    ALTER TABLE sms_messages ADD COLUMN status TEXT DEFAULT 'queued';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'agent_name') THEN
    ALTER TABLE sms_messages ADD COLUMN agent_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'campaign_id') THEN
    ALTER TABLE sms_messages ADD COLUMN campaign_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'lead_id') THEN
    ALTER TABLE sms_messages ADD COLUMN lead_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name = 'created_at') THEN
    ALTER TABLE sms_messages ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PATCH: sms_templates - Add missing columns
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'name') THEN
    ALTER TABLE sms_templates ADD COLUMN name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'category') THEN
    ALTER TABLE sms_templates ADD COLUMN category TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'body') THEN
    ALTER TABLE sms_templates ADD COLUMN body TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'is_approved') THEN
    ALTER TABLE sms_templates ADD COLUMN is_approved BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'is_active') THEN
    ALTER TABLE sms_templates ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'use_count') THEN
    ALTER TABLE sms_templates ADD COLUMN use_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'last_used_at') THEN
    ALTER TABLE sms_templates ADD COLUMN last_used_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- PATCH: sms_opt_out_keywords - Add missing columns
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_opt_out_keywords' AND column_name = 'keyword') THEN
    ALTER TABLE sms_opt_out_keywords ADD COLUMN keyword TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_opt_out_keywords' AND column_name = 'action') THEN
    ALTER TABLE sms_opt_out_keywords ADD COLUMN action TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_opt_out_keywords' AND column_name = 'auto_response') THEN
    ALTER TABLE sms_opt_out_keywords ADD COLUMN auto_response TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_opt_out_keywords' AND column_name = 'is_ctia_required') THEN
    ALTER TABLE sms_opt_out_keywords ADD COLUMN is_ctia_required BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_opt_out_keywords' AND column_name = 'is_active') THEN
    ALTER TABLE sms_opt_out_keywords ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add keyword_upper generated column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_opt_out_keywords' AND column_name = 'keyword_upper') THEN
    ALTER TABLE sms_opt_out_keywords ADD COLUMN keyword_upper TEXT GENERATED ALWAYS AS (UPPER(COALESCE(keyword, ''))) STORED;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add keyword_upper: %', SQLERRM;
END $$;

-- ============================================================================
-- PATCH: sms_campaigns - Add missing columns
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_campaigns' AND column_name = 'name') THEN
    ALTER TABLE sms_campaigns ADD COLUMN name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_campaigns' AND column_name = 'campaign_type') THEN
    ALTER TABLE sms_campaigns ADD COLUMN campaign_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_campaigns' AND column_name = 'daily_limit') THEN
    ALTER TABLE sms_campaigns ADD COLUMN daily_limit INTEGER DEFAULT 1000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_campaigns' AND column_name = 'monthly_limit') THEN
    ALTER TABLE sms_campaigns ADD COLUMN monthly_limit INTEGER DEFAULT 20000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_campaigns' AND column_name = 'messages_sent_today') THEN
    ALTER TABLE sms_campaigns ADD COLUMN messages_sent_today INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_campaigns' AND column_name = 'messages_sent_this_month') THEN
    ALTER TABLE sms_campaigns ADD COLUMN messages_sent_this_month INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_campaigns' AND column_name = 'messages_sent_total') THEN
    ALTER TABLE sms_campaigns ADD COLUMN messages_sent_total INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_campaigns' AND column_name = 'is_active') THEN
    ALTER TABLE sms_campaigns ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================================================
-- PATCH: agents table - Add missing columns
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'name') THEN
    ALTER TABLE agents ADD COLUMN name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'display_name') THEN
    ALTER TABLE agents ADD COLUMN display_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'description') THEN
    ALTER TABLE agents ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'agent_type') THEN
    ALTER TABLE agents ADD COLUMN agent_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'capabilities') THEN
    ALTER TABLE agents ADD COLUMN capabilities TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'status') THEN
    ALTER TABLE agents ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'last_heartbeat') THEN
    ALTER TABLE agents ADD COLUMN last_heartbeat TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'config') THEN
    ALTER TABLE agents ADD COLUMN config JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'tasks_completed') THEN
    ALTER TABLE agents ADD COLUMN tasks_completed INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'tasks_failed') THEN
    ALTER TABLE agents ADD COLUMN tasks_failed INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'messages_sent') THEN
    ALTER TABLE agents ADD COLUMN messages_sent INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'messages_received') THEN
    ALTER TABLE agents ADD COLUMN messages_received INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'updated_at') THEN
    ALTER TABLE agents ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PATCH: agent_messages table
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'from_agent') THEN
    ALTER TABLE agent_messages ADD COLUMN from_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'to_agent') THEN
    ALTER TABLE agent_messages ADD COLUMN to_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'message_type') THEN
    ALTER TABLE agent_messages ADD COLUMN message_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'priority') THEN
    ALTER TABLE agent_messages ADD COLUMN priority INTEGER DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'payload') THEN
    ALTER TABLE agent_messages ADD COLUMN payload JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'status') THEN
    ALTER TABLE agent_messages ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'processed_at') THEN
    ALTER TABLE agent_messages ADD COLUMN processed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'lead_id') THEN
    ALTER TABLE agent_messages ADD COLUMN lead_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_messages' AND column_name = 'created_at') THEN
    ALTER TABLE agent_messages ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PATCH: agent_tasks table
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'task_type') THEN
    ALTER TABLE agent_tasks ADD COLUMN task_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'assigned_agent') THEN
    ALTER TABLE agent_tasks ADD COLUMN assigned_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'created_by_agent') THEN
    ALTER TABLE agent_tasks ADD COLUMN created_by_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'lead_id') THEN
    ALTER TABLE agent_tasks ADD COLUMN lead_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'input') THEN
    ALTER TABLE agent_tasks ADD COLUMN input JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'output') THEN
    ALTER TABLE agent_tasks ADD COLUMN output JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'status') THEN
    ALTER TABLE agent_tasks ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'parent_task_id') THEN
    ALTER TABLE agent_tasks ADD COLUMN parent_task_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'sequence_number') THEN
    ALTER TABLE agent_tasks ADD COLUMN sequence_number INTEGER;
  END IF;
END $$;

-- ============================================================================
-- PATCH: agent_goals table
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_goals' AND column_name = 'name') THEN
    ALTER TABLE agent_goals ADD COLUMN name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_goals' AND column_name = 'assigned_agent') THEN
    ALTER TABLE agent_goals ADD COLUMN assigned_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_goals' AND column_name = 'schedule_type') THEN
    ALTER TABLE agent_goals ADD COLUMN schedule_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_goals' AND column_name = 'cron_expression') THEN
    ALTER TABLE agent_goals ADD COLUMN cron_expression TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_goals' AND column_name = 'target_metric') THEN
    ALTER TABLE agent_goals ADD COLUMN target_metric TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_goals' AND column_name = 'target_value') THEN
    ALTER TABLE agent_goals ADD COLUMN target_value INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_goals' AND column_name = 'actions') THEN
    ALTER TABLE agent_goals ADD COLUMN actions JSONB DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_goals' AND column_name = 'is_active') THEN
    ALTER TABLE agent_goals ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================================================
-- PATCH: agent_memories table
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'agent_name') THEN
    ALTER TABLE agent_memories ADD COLUMN agent_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'memory_key') THEN
    ALTER TABLE agent_memories ADD COLUMN memory_key TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'memory_value') THEN
    ALTER TABLE agent_memories ADD COLUMN memory_value JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'memory_type') THEN
    ALTER TABLE agent_memories ADD COLUMN memory_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'lead_id') THEN
    ALTER TABLE agent_memories ADD COLUMN lead_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'access_count') THEN
    ALTER TABLE agent_memories ADD COLUMN access_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'last_accessed_at') THEN
    ALTER TABLE agent_memories ADD COLUMN last_accessed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'updated_at') THEN
    ALTER TABLE agent_memories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PATCH: workflow_definitions table
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_definitions' AND column_name = 'workflow_id') THEN
    ALTER TABLE workflow_definitions ADD COLUMN workflow_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_definitions' AND column_name = 'workflow_name') THEN
    ALTER TABLE workflow_definitions ADD COLUMN workflow_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_definitions' AND column_name = 'webhook_path') THEN
    ALTER TABLE workflow_definitions ADD COLUMN webhook_path TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_definitions' AND column_name = 'full_webhook_url') THEN
    ALTER TABLE workflow_definitions ADD COLUMN full_webhook_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_definitions' AND column_name = 'owning_agent') THEN
    ALTER TABLE workflow_definitions ADD COLUMN owning_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_definitions' AND column_name = 'trigger_count') THEN
    ALTER TABLE workflow_definitions ADD COLUMN trigger_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_definitions' AND column_name = 'last_triggered_at') THEN
    ALTER TABLE workflow_definitions ADD COLUMN last_triggered_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_definitions' AND column_name = 'is_active') THEN
    ALTER TABLE workflow_definitions ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================================================
-- PATCH: workflow_executions table
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'workflow_id') THEN
    ALTER TABLE workflow_executions ADD COLUMN workflow_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'workflow_definition_id') THEN
    ALTER TABLE workflow_executions ADD COLUMN workflow_definition_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'triggered_by') THEN
    ALTER TABLE workflow_executions ADD COLUMN triggered_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'input_payload') THEN
    ALTER TABLE workflow_executions ADD COLUMN input_payload JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'lead_id') THEN
    ALTER TABLE workflow_executions ADD COLUMN lead_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'status') THEN
    ALTER TABLE workflow_executions ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflow_executions' AND column_name = 'started_at') THEN
    ALTER TABLE workflow_executions ADD COLUMN started_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- Create indexes (IF NOT EXISTS handles duplicates)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_agent);
CREATE INDEX IF NOT EXISTS idx_agent_messages_status ON agent_messages(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned ON agent_tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_goals_agent ON agent_goals(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_name);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_id ON workflow_definitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_sms_consent_status ON sms_consent(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_templates_category ON sms_templates(category);

-- ============================================================================
-- Enable RLS
-- ============================================================================
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_out_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create RLS policies
-- ============================================================================
DROP POLICY IF EXISTS "agents_all" ON agents; CREATE POLICY "agents_all" ON agents FOR ALL USING (true);
DROP POLICY IF EXISTS "agent_messages_all" ON agent_messages; CREATE POLICY "agent_messages_all" ON agent_messages FOR ALL USING (true);
DROP POLICY IF EXISTS "agent_tasks_all" ON agent_tasks; CREATE POLICY "agent_tasks_all" ON agent_tasks FOR ALL USING (true);
DROP POLICY IF EXISTS "agent_goals_all" ON agent_goals; CREATE POLICY "agent_goals_all" ON agent_goals FOR ALL USING (true);
DROP POLICY IF EXISTS "agent_memories_all" ON agent_memories; CREATE POLICY "agent_memories_all" ON agent_memories FOR ALL USING (true);
DROP POLICY IF EXISTS "workflow_definitions_all" ON workflow_definitions; CREATE POLICY "workflow_definitions_all" ON workflow_definitions FOR ALL USING (true);
DROP POLICY IF EXISTS "workflow_executions_all" ON workflow_executions; CREATE POLICY "workflow_executions_all" ON workflow_executions FOR ALL USING (true);
DROP POLICY IF EXISTS "sms_consent_all" ON sms_consent; CREATE POLICY "sms_consent_all" ON sms_consent FOR ALL USING (true);
DROP POLICY IF EXISTS "sms_messages_all" ON sms_messages; CREATE POLICY "sms_messages_all" ON sms_messages FOR ALL USING (true);
DROP POLICY IF EXISTS "sms_templates_all" ON sms_templates; CREATE POLICY "sms_templates_all" ON sms_templates FOR ALL USING (true);
DROP POLICY IF EXISTS "sms_keywords_all" ON sms_opt_out_keywords; CREATE POLICY "sms_keywords_all" ON sms_opt_out_keywords FOR ALL USING (true);
DROP POLICY IF EXISTS "sms_campaigns_all" ON sms_campaigns; CREATE POLICY "sms_campaigns_all" ON sms_campaigns FOR ALL USING (true);

-- ============================================================================
-- Drop existing functions (required to change return types)
-- ============================================================================
DROP FUNCTION IF EXISTS check_sms_consent(TEXT);
DROP FUNCTION IF EXISTS process_sms_opt_out(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS send_agent_message(TEXT, TEXT, TEXT, JSONB, INTEGER);
DROP FUNCTION IF EXISTS get_agent_messages(TEXT, INTEGER);
DROP FUNCTION IF EXISTS remember(TEXT, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS recall(TEXT, TEXT);
DROP FUNCTION IF EXISTS agent_heartbeat(TEXT);
DROP FUNCTION IF EXISTS render_sms_template(TEXT, JSONB);
DROP FUNCTION IF EXISTS get_agent_context(TEXT);
DROP FUNCTION IF EXISTS create_task_chain(TEXT[], TEXT, JSONB);
DROP FUNCTION IF EXISTS trigger_workflow(TEXT, JSONB, TEXT);

-- ============================================================================
-- Create functions
-- ============================================================================
CREATE OR REPLACE FUNCTION check_sms_consent(p_phone TEXT) RETURNS BOOLEAN AS $$ BEGIN RETURN (SELECT status FROM sms_consent WHERE phone = p_phone LIMIT 1) = 'opted_in'; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION process_sms_opt_out(p_phone TEXT, p_keyword TEXT DEFAULT NULL, p_message_sid TEXT DEFAULT NULL) RETURNS JSONB AS $$ DECLARE v_id UUID; BEGIN INSERT INTO sms_consent (phone, status, opted_out_at, opt_out_keyword) VALUES (p_phone, 'opted_out', NOW(), p_keyword) ON CONFLICT DO NOTHING RETURNING id INTO v_id; UPDATE maxsam_leads SET do_not_contact = true WHERE phone = p_phone OR phone_1 = p_phone OR phone_2 = p_phone; RETURN jsonb_build_object('success', true, 'consent_id', v_id); END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION send_agent_message(p_from TEXT, p_to TEXT, p_type TEXT, p_payload JSONB, p_priority INTEGER DEFAULT 5) RETURNS UUID AS $$ DECLARE v_id UUID; BEGIN INSERT INTO agent_messages (from_agent, to_agent, message_type, payload, priority) VALUES (p_from, p_to, p_type, p_payload, p_priority) RETURNING id INTO v_id; UPDATE agents SET messages_sent = COALESCE(messages_sent, 0) + 1 WHERE name = p_from; RETURN v_id; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION get_agent_messages(p_agent TEXT, p_limit INTEGER DEFAULT 10) RETURNS SETOF agent_messages AS $$ BEGIN RETURN QUERY SELECT * FROM agent_messages WHERE to_agent = p_agent AND status = 'pending' ORDER BY priority DESC, created_at LIMIT p_limit; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION remember(p_agent TEXT, p_key TEXT, p_value JSONB, p_type TEXT DEFAULT 'fact') RETURNS UUID AS $$ DECLARE v_id UUID; BEGIN INSERT INTO agent_memories (agent_name, memory_key, memory_value, memory_type) VALUES (p_agent, p_key, p_value, p_type) ON CONFLICT DO NOTHING RETURNING id INTO v_id; IF v_id IS NULL THEN UPDATE agent_memories SET memory_value = p_value, memory_type = p_type, updated_at = NOW() WHERE agent_name = p_agent AND memory_key = p_key RETURNING id INTO v_id; END IF; RETURN v_id; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION recall(p_agent TEXT, p_key TEXT) RETURNS JSONB AS $$ DECLARE v_val JSONB; BEGIN UPDATE agent_memories SET access_count = COALESCE(access_count, 0) + 1, last_accessed_at = NOW() WHERE agent_name = p_agent AND memory_key = p_key RETURNING memory_value INTO v_val; RETURN v_val; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION agent_heartbeat(p_agent TEXT) RETURNS BOOLEAN AS $$ BEGIN UPDATE agents SET last_heartbeat = NOW(), updated_at = NOW() WHERE name = p_agent; RETURN FOUND; END; $$ LANGUAGE plpgsql;

-- ============================================================================
-- Seed data (use DO block to handle conflicts gracefully)
-- ============================================================================
DO $$
BEGIN
  -- Seed agents
  INSERT INTO agents (name, display_name, description, agent_type, capabilities, status, config) VALUES
    ('ALEX', 'Alex - Orchestrator', 'Master orchestrator', 'orchestrator', ARRAY['coordinate'], 'active', '{}'),
    ('ELEANOR', 'Eleanor - Intelligence', 'Lead scoring', 'scorer', ARRAY['score_leads'], 'active', '{}'),
    ('SAM', 'Sam - Outreach', 'SMS outreach', 'outreach', ARRAY['send_sms'], 'active', '{}'),
    ('SYSTEM', 'System', 'System agent', 'system', ARRAY['run_cron'], 'active', '{}'),
    ('RALPH', 'Ralph - Execution', 'Task execution', 'orchestrator', ARRAY['execute'], 'active', '{}')
  ON CONFLICT DO NOTHING;

  -- Seed workflows
  INSERT INTO workflow_definitions (workflow_id, workflow_name, full_webhook_url, owning_agent, is_active) VALUES
    ('skip-trace', 'Skip Trace', 'https://skooki.app.n8n.cloud/webhook/skip-trace', 'ELEANOR', true),
    ('eleanor-score', 'Eleanor Scoring', 'https://skooki.app.n8n.cloud/webhook/eleanor-score', 'ELEANOR', true),
    ('sam-outreach', 'Sam Outreach', 'https://skooki.app.n8n.cloud/webhook/sam-outreach', 'SAM', true)
  ON CONFLICT DO NOTHING;

  -- Seed SMS keywords
  INSERT INTO sms_opt_out_keywords (keyword, action, auto_response, is_ctia_required) VALUES
    ('STOP', 'opt_out', 'Unsubscribed. Reply START to re-subscribe.', true),
    ('START', 'opt_in', 'Re-subscribed. Reply STOP to unsubscribe.', true),
    ('HELP', 'help', 'MaxSam Recovery. Reply STOP to unsubscribe.', true)
  ON CONFLICT DO NOTHING;

  -- Seed templates
  INSERT INTO sms_templates (name, category, body, is_approved, is_active) VALUES
    ('initial', 'initial_outreach', 'Hi {{owner_name}}, we found funds from {{property_address}}. Reply YES or STOP.', true, true)
  ON CONFLICT DO NOTHING;

  -- Seed campaigns
  INSERT INTO sms_campaigns (name, campaign_type, daily_limit, monthly_limit, is_active) VALUES
    ('outreach', 'initial_outreach', 500, 10000, true)
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;

SELECT 'Migration complete - all tables patched' AS result;
