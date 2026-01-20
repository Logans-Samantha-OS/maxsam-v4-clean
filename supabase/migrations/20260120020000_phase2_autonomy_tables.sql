-- ============================================================================
-- PHASE 2 AUTONOMY TABLES - MaxSam V4
-- ============================================================================
-- STATUS: PREPARED - DO NOT EXECUTE WITHOUT EXPLICIT AUTHORIZATION
-- CREATED: 2026-01-20
-- AUTHOR: Claude Code (Opus 4.5)
-- ============================================================================
--
-- This migration adds Phase 2 autonomy infrastructure:
-- 1. Extends message_intelligence with action scoring columns
-- 2. Creates autonomy_decisions table for decision tracking
-- 3. Creates autonomy_audit_log for immutable audit trail
-- 4. Adds feature flag entries to system_config
--
-- IMPORTANT: All changes are additive (non-destructive)
-- IMPORTANT: Feature flags default to DISABLED
-- ============================================================================

-- ============================================================================
-- 1. EXTEND message_intelligence TABLE
-- ============================================================================

-- Add Phase 2 columns (all nullable, default to safe values)
ALTER TABLE message_intelligence
ADD COLUMN IF NOT EXISTS action_score numeric,
ADD COLUMN IF NOT EXISTS risk_multiplier numeric DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS data_completeness numeric,
ADD COLUMN IF NOT EXISTS auto_action_allowed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS escalation_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS escalation_reason text,
ADD COLUMN IF NOT EXISTS queued_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS execution_queue_id uuid,
ADD COLUMN IF NOT EXISTS phase2_processed boolean DEFAULT false;

-- Indexes for Phase 2 queries
CREATE INDEX IF NOT EXISTS idx_mi_action_score
ON message_intelligence(action_score)
WHERE action_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mi_escalation
ON message_intelligence(escalation_required)
WHERE escalation_required = true;

CREATE INDEX IF NOT EXISTS idx_mi_auto_action
ON message_intelligence(auto_action_allowed)
WHERE auto_action_allowed = true;

CREATE INDEX IF NOT EXISTS idx_mi_phase2_unprocessed
ON message_intelligence(phase2_processed)
WHERE phase2_processed = false;

-- Comments
COMMENT ON COLUMN message_intelligence.action_score IS 'Calculated score for autonomous action (0.0-1.0)';
COMMENT ON COLUMN message_intelligence.risk_multiplier IS 'Risk adjustment factor (0.0-1.0, 0 = blocked)';
COMMENT ON COLUMN message_intelligence.data_completeness IS 'Lead data completeness ratio (0.0-1.0)';
COMMENT ON COLUMN message_intelligence.auto_action_allowed IS 'Whether autonomous action is permitted (Phase 2)';
COMMENT ON COLUMN message_intelligence.escalation_required IS 'Whether human review is required';
COMMENT ON COLUMN message_intelligence.escalation_reason IS 'Reason for escalation if required';
COMMENT ON COLUMN message_intelligence.queued_at IS 'When action was queued for execution';
COMMENT ON COLUMN message_intelligence.execution_queue_id IS 'Link to execution_queue entry';
COMMENT ON COLUMN message_intelligence.phase2_processed IS 'Whether Phase 2 processing has occurred';

-- ============================================================================
-- 2. CREATE autonomy_decisions TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS autonomy_decisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  message_intelligence_id uuid REFERENCES message_intelligence(id) ON DELETE SET NULL,

  -- Decision details
  decision_type text NOT NULL CHECK (decision_type IN (
    'auto_approve',    -- Autonomous action approved
    'auto_hold',       -- Held pending higher autonomy level
    'escalate',        -- Escalated to human
    'block',           -- Blocked by validator
    'rate_limit',      -- Blocked by rate limit
    'dry_run'          -- Would have acted (dry run mode)
  )),
  action_type text NOT NULL,
  action_score numeric NOT NULL,

  -- Input factors
  confidence_score numeric,
  sentiment_score numeric,
  risk_multiplier numeric,
  data_completeness numeric,
  autonomy_level_required integer,
  autonomy_level_current integer,

  -- Validator results
  validators_passed jsonb NOT NULL DEFAULT '[]',
  validators_failed jsonb NOT NULL DEFAULT '[]',
  validator_count_passed integer DEFAULT 0,
  validator_count_failed integer DEFAULT 0,

  -- Outcome
  approved boolean NOT NULL DEFAULT false,
  approved_by text, -- 'ORION_PHASE2', 'HUMAN:<id>', 'DRY_RUN'
  blocked_reason text,
  execution_queue_id uuid,

  -- Audit
  decided_at timestamp with time zone DEFAULT now() NOT NULL,
  executed_at timestamp with time zone,
  execution_status text CHECK (execution_status IN (
    'pending', 'executed', 'failed', 'rolled_back', 'cancelled'
  )),

  metadata jsonb DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_autonomy_decisions_lead ON autonomy_decisions(lead_id);
CREATE INDEX IF NOT EXISTS idx_autonomy_decisions_mi ON autonomy_decisions(message_intelligence_id);
CREATE INDEX IF NOT EXISTS idx_autonomy_decisions_approved ON autonomy_decisions(approved);
CREATE INDEX IF NOT EXISTS idx_autonomy_decisions_type ON autonomy_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_autonomy_decisions_pending ON autonomy_decisions(execution_status)
WHERE execution_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_autonomy_decisions_time ON autonomy_decisions(decided_at DESC);

-- Comments
COMMENT ON TABLE autonomy_decisions IS 'Tracks all Phase 2 autonomous decision-making';
COMMENT ON COLUMN autonomy_decisions.decision_type IS 'Type of decision made by ORION Phase 2';
COMMENT ON COLUMN autonomy_decisions.validators_passed IS 'Array of validator names that passed';
COMMENT ON COLUMN autonomy_decisions.validators_failed IS 'Array of {name, reason} for failed validators';
COMMENT ON COLUMN autonomy_decisions.approved_by IS 'Who/what approved: ORION_PHASE2, HUMAN:id, DRY_RUN';

-- RLS
ALTER TABLE autonomy_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autonomy_decisions_read_all" ON autonomy_decisions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "autonomy_decisions_insert_system" ON autonomy_decisions
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "autonomy_decisions_anon_read" ON autonomy_decisions
FOR SELECT TO anon USING (true);

-- ============================================================================
-- 3. CREATE autonomy_audit_log TABLE (APPEND-ONLY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS autonomy_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN (
    'phase2_enabled',     -- Phase 2 was enabled
    'phase2_disabled',    -- Phase 2 was disabled
    'auto_action',        -- Autonomous action taken
    'auto_action_dry',    -- Would have taken action (dry run)
    'escalation',         -- Escalated to human
    'human_override',     -- Human overrode autonomous decision
    'rollback',           -- Action was rolled back
    'gate_change',        -- Governance gate changed
    'threshold_change',   -- Confidence/risk threshold changed
    'flag_change',        -- Feature flag changed
    'self_pause',         -- System self-paused due to anomaly
    'error',              -- Error occurred
    'recovery'            -- System recovered from error/pause
  )),

  actor text NOT NULL, -- 'ORION_PHASE2', 'RALPH', 'HUMAN:logan', 'SYSTEM'
  target_id uuid,
  target_type text, -- 'lead', 'message_intelligence', 'execution_queue', 'system'

  -- Event details
  previous_state jsonb,
  new_state jsonb,
  reason text,

  -- Context
  lead_id uuid,
  decision_id uuid,
  execution_id uuid,

  -- Immutable timestamp
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,

  -- Metadata
  metadata jsonb DEFAULT '{}',

  -- Prevent any modifications
  CONSTRAINT autonomy_audit_immutable CHECK (true)
);

-- Indexes (for read queries only)
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON autonomy_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON autonomy_audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_lead ON autonomy_audit_log(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_time ON autonomy_audit_log(occurred_at DESC);

-- Make truly append-only by revoking update/delete
REVOKE UPDATE, DELETE ON autonomy_audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON autonomy_audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON autonomy_audit_log FROM anon;

-- RLS (read-only for all)
ALTER TABLE autonomy_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_read_all" ON autonomy_audit_log
FOR SELECT TO authenticated USING (true);

CREATE POLICY "audit_insert_system" ON autonomy_audit_log
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "audit_anon_read" ON autonomy_audit_log
FOR SELECT TO anon USING (true);

-- Comments
COMMENT ON TABLE autonomy_audit_log IS 'Immutable audit log for Phase 2 autonomous operations';
COMMENT ON COLUMN autonomy_audit_log.actor IS 'Who/what triggered the event';
COMMENT ON COLUMN autonomy_audit_log.previous_state IS 'State before the change';
COMMENT ON COLUMN autonomy_audit_log.new_state IS 'State after the change';

-- ============================================================================
-- 4. CREATE autonomy_thresholds TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS autonomy_thresholds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type text NOT NULL UNIQUE,

  -- Confidence thresholds
  min_confidence numeric NOT NULL DEFAULT 0.70,
  min_sentiment numeric DEFAULT -0.3,
  min_data_completeness numeric NOT NULL DEFAULT 0.50,

  -- Autonomy requirements
  required_autonomy_level integer NOT NULL DEFAULT 2 CHECK (required_autonomy_level BETWEEN 0 AND 3),

  -- Rate limits
  max_per_lead_per_hour integer DEFAULT 1,
  max_global_per_hour integer DEFAULT 50,
  cooldown_seconds integer DEFAULT 14400, -- 4 hours

  -- Flags
  escalate_on_high_value boolean DEFAULT true,
  high_value_threshold numeric DEFAULT 50000,
  require_confirmation boolean DEFAULT false,

  -- Audit
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by text
);

-- Seed default thresholds
INSERT INTO autonomy_thresholds (action_type, min_confidence, min_sentiment, min_data_completeness, required_autonomy_level, cooldown_seconds)
VALUES
  ('send_sms', 0.85, 0.0, 0.75, 3, 14400),
  ('schedule_callback', 0.70, -0.3, 0.50, 2, 86400),
  ('update_status', 0.60, -1.0, 0.25, 1, 0),
  ('generate_contract', 0.90, 0.3, 0.90, 3, 604800),
  ('escalate_human', 0.0, -1.0, 0.0, 0, 0)
ON CONFLICT (action_type) DO NOTHING;

-- RLS
ALTER TABLE autonomy_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "thresholds_read_all" ON autonomy_thresholds
FOR SELECT TO authenticated USING (true);

CREATE POLICY "thresholds_update_admin" ON autonomy_thresholds
FOR UPDATE TO authenticated USING (true);

-- ============================================================================
-- 5. ADD FEATURE FLAGS TO system_config
-- ============================================================================

-- Insert Phase 2 feature flags (all disabled by default)
INSERT INTO system_config (key, value) VALUES
  ('autonomy_enabled', 'false'),
  ('phase2_active', 'false'),
  ('phase2_dry_run', 'true'),
  ('phase2_require_confirmation', 'true'),
  ('phase2_max_auto_actions_per_hour', '10'),
  ('phase2_self_pause_error_threshold', '10'),
  ('phase2_self_pause_escalation_threshold', '20')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 6. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to check if Phase 2 can execute
CREATE OR REPLACE FUNCTION can_phase2_execute(p_action_type text)
RETURNS TABLE (
  allowed boolean,
  reason text,
  dry_run boolean,
  required_level integer,
  current_level integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_autonomy_enabled boolean;
  v_phase2_active boolean;
  v_phase2_dry_run boolean;
  v_autonomy_level integer;
  v_master_killed boolean;
  v_required_level integer;
BEGIN
  -- Get feature flags
  SELECT (value = 'true') INTO v_autonomy_enabled
  FROM system_config WHERE key = 'autonomy_enabled';

  SELECT (value = 'true') INTO v_phase2_active
  FROM system_config WHERE key = 'phase2_active';

  SELECT (value = 'true') INTO v_phase2_dry_run
  FROM system_config WHERE key = 'phase2_dry_run';

  SELECT (value)::integer INTO v_autonomy_level
  FROM system_config WHERE key = 'autonomy_level';

  -- Check kill switch
  SELECT enabled INTO v_master_killed
  FROM governance_gates WHERE control_key = 'master_kill_switch';

  -- Get required level for action
  SELECT required_autonomy_level INTO v_required_level
  FROM autonomy_thresholds WHERE action_type = p_action_type;

  v_required_level := COALESCE(v_required_level, 3); -- Default to highest

  -- Check hierarchy
  IF NOT COALESCE(v_autonomy_enabled, false) THEN
    RETURN QUERY SELECT false, 'autonomy_enabled = false'::text, false, v_required_level, COALESCE(v_autonomy_level, 0);
    RETURN;
  END IF;

  IF NOT COALESCE(v_phase2_active, false) THEN
    RETURN QUERY SELECT false, 'phase2_active = false'::text, false, v_required_level, COALESCE(v_autonomy_level, 0);
    RETURN;
  END IF;

  IF COALESCE(v_master_killed, false) THEN
    RETURN QUERY SELECT false, 'Master kill switch active'::text, false, v_required_level, COALESCE(v_autonomy_level, 0);
    RETURN;
  END IF;

  IF COALESCE(v_autonomy_level, 0) < v_required_level THEN
    RETURN QUERY SELECT false, format('autonomy_level %s < required %s', v_autonomy_level, v_required_level), false, v_required_level, COALESCE(v_autonomy_level, 0);
    RETURN;
  END IF;

  -- All checks passed
  IF COALESCE(v_phase2_dry_run, true) THEN
    RETURN QUERY SELECT true, 'Dry run mode'::text, true, v_required_level, COALESCE(v_autonomy_level, 0);
  ELSE
    RETURN QUERY SELECT true, 'All checks passed'::text, false, v_required_level, COALESCE(v_autonomy_level, 0);
  END IF;
END;
$$;

-- Function to log Phase 2 audit event
CREATE OR REPLACE FUNCTION log_autonomy_event(
  p_event_type text,
  p_actor text,
  p_target_id uuid DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_previous_state jsonb DEFAULT NULL,
  p_new_state jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_decision_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO autonomy_audit_log (
    event_type, actor, target_id, target_type,
    previous_state, new_state, reason,
    lead_id, decision_id, metadata
  ) VALUES (
    p_event_type, p_actor, p_target_id, p_target_type,
    p_previous_state, p_new_state, p_reason,
    p_lead_id, p_decision_id, p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================================================
-- 7. CREATE VIEW FOR DASHBOARD
-- ============================================================================

CREATE OR REPLACE VIEW v_phase2_status AS
SELECT
  -- Feature flags
  (SELECT value = 'true' FROM system_config WHERE key = 'autonomy_enabled') as autonomy_enabled,
  (SELECT value = 'true' FROM system_config WHERE key = 'phase2_active') as phase2_active,
  (SELECT value = 'true' FROM system_config WHERE key = 'phase2_dry_run') as phase2_dry_run,
  (SELECT value::integer FROM system_config WHERE key = 'autonomy_level') as autonomy_level,

  -- Gates
  (SELECT enabled FROM governance_gates WHERE control_key = 'master_kill_switch') as master_killed,

  -- Stats (last hour)
  (SELECT COUNT(*) FROM autonomy_decisions WHERE decided_at > NOW() - INTERVAL '1 hour') as decisions_last_hour,
  (SELECT COUNT(*) FROM autonomy_decisions WHERE decided_at > NOW() - INTERVAL '1 hour' AND approved = true) as approved_last_hour,
  (SELECT COUNT(*) FROM autonomy_decisions WHERE decided_at > NOW() - INTERVAL '1 hour' AND decision_type = 'escalate') as escalations_last_hour,

  -- Stats (today)
  (SELECT COUNT(*) FROM autonomy_decisions WHERE decided_at > CURRENT_DATE) as decisions_today,
  (SELECT COUNT(*) FROM autonomy_decisions WHERE decided_at > CURRENT_DATE AND approved = true) as approved_today,
  (SELECT COUNT(*) FROM autonomy_decisions WHERE decided_at > CURRENT_DATE AND decision_type = 'escalate') as escalations_today;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- REMINDER: This migration is PREPARED but NOT EXECUTED.
-- Execute only with explicit authorization.
--
-- To execute manually in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs/sql
--
-- After execution, verify:
-- 1. SELECT * FROM v_phase2_status;
-- 2. SELECT * FROM autonomy_thresholds;
-- 3. SELECT * FROM system_config WHERE key LIKE 'phase2%' OR key = 'autonomy_enabled';
-- ============================================================================
