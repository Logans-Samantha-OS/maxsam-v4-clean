-- ============================================================================
-- MIGRATION 007: N8N Governance Layer - Phase 12.1 → 13.1 Bridge
-- ============================================================================
-- Purpose: Deterministic governance for n8n workflows with zero authority leakage
--
-- Tables Created:
--   1. n8n_workflow_audit      - Immutable audit trail (APPEND-ONLY)
--   2. n8n_workflow_archive    - Workflow version storage for rollback
--   3. engagement_state_log    - Human-in-the-loop state machine (Phase 13.1)
--
-- Key Principles:
--   - No updates or deletes on audit tables
--   - All deployments require ORION approval
--   - Human visibility without authority leak
-- ============================================================================

-- ============================================================================
-- SECTION 1: N8N WORKFLOW AUDIT (APPEND-ONLY)
-- ============================================================================

-- Risk level enum
CREATE TYPE n8n_risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Approval source enum
CREATE TYPE n8n_approval_source AS ENUM ('ORION', 'MANUAL', 'AUTONOMY_SCHEDULER');

-- Create the immutable audit table
CREATE TABLE n8n_workflow_audit (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    previous_version_hash TEXT NOT NULL,
    proposed_version_hash TEXT NOT NULL,
    diff_summary JSONB NOT NULL DEFAULT '{}',
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level n8n_risk_level NOT NULL DEFAULT 'LOW',
    approved_by n8n_approval_source,
    approval_context TEXT,
    deployed_at TIMESTAMPTZ,
    rollback_reference TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by workflow
CREATE INDEX idx_n8n_audit_workflow ON n8n_workflow_audit(workflow_id);

-- Index for querying recent audits
CREATE INDEX idx_n8n_audit_created ON n8n_workflow_audit(created_at DESC);

-- Index for finding deployments
CREATE INDEX idx_n8n_audit_deployed ON n8n_workflow_audit(deployed_at) WHERE deployed_at IS NOT NULL;

-- CRITICAL: Prevent any updates or deletes on audit table
-- This is enforced at the database level, not application level

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'n8n_workflow_audit is append-only. Updates and deletes are prohibited.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Only allow the deployed_at column to be updated (one-time set)
CREATE OR REPLACE FUNCTION allow_deployed_at_once()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow update if we're setting deployed_at and it was previously NULL
    IF OLD.deployed_at IS NOT NULL THEN
        RAISE EXCEPTION 'deployed_at can only be set once';
    END IF;

    -- Only allow deployed_at to be changed
    IF NEW.workflow_id != OLD.workflow_id OR
       NEW.previous_version_hash != OLD.previous_version_hash OR
       NEW.proposed_version_hash != OLD.proposed_version_hash OR
       NEW.diff_summary != OLD.diff_summary OR
       NEW.risk_score != OLD.risk_score OR
       NEW.risk_level != OLD.risk_level OR
       NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
       NEW.approval_context IS DISTINCT FROM OLD.approval_context OR
       NEW.rollback_reference != OLD.rollback_reference OR
       NEW.created_at != OLD.created_at THEN
        RAISE EXCEPTION 'Only deployed_at can be updated on n8n_workflow_audit';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_delete
    BEFORE DELETE ON n8n_workflow_audit
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER allow_deployed_at_update
    BEFORE UPDATE ON n8n_workflow_audit
    FOR EACH ROW
    EXECUTE FUNCTION allow_deployed_at_once();

-- ============================================================================
-- SECTION 2: N8N WORKFLOW ARCHIVE
-- ============================================================================

CREATE TABLE n8n_workflow_archive (
    archive_id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    version_hash TEXT NOT NULL,
    workflow_json JSONB NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- Unique constraint on workflow_id + version_hash
CREATE UNIQUE INDEX idx_n8n_archive_unique ON n8n_workflow_archive(workflow_id, version_hash);

-- Index for querying archives by workflow
CREATE INDEX idx_n8n_archive_workflow ON n8n_workflow_archive(workflow_id, archived_at DESC);

-- ============================================================================
-- SECTION 3: ENGAGEMENT STATE MACHINE (Phase 13.1)
-- ============================================================================

-- Engagement state enum
CREATE TYPE engagement_state AS ENUM (
    'NOT_CONTACTED',
    'SAM_ACTIVE',
    'AWAITING_RESPONSE',
    'HUMAN_REQUESTED',
    'HUMAN_APPROVED',
    'HUMAN_IN_PROGRESS',
    'HUMAN_COMPLETED',
    'RETURNED_TO_AUTONOMY',
    'CLOSED'
);

-- Engagement guard enum
CREATE TYPE engagement_guard AS ENUM (
    'SAM_INITIATED',
    'RESPONSE_RECEIVED',
    'HUMAN_REQUEST_TRIGGERED',
    'ORION_APPROVED',
    'OPS_CONSOLE_ACTIVATED',
    'HUMAN_TASK_COMPLETE',
    'RETURN_AUTHORIZED',
    'DEAL_CLOSED',
    'LEAD_DEAD'
);

-- Lead engagement state table
CREATE TABLE lead_engagement_state (
    lead_id UUID PRIMARY KEY REFERENCES maxsam_leads(id) ON DELETE CASCADE,
    current_state engagement_state NOT NULL DEFAULT 'NOT_CONTACTED',
    sam_paused BOOLEAN NOT NULL DEFAULT FALSE,
    human_actor_id TEXT,
    orion_decision_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Engagement state log (APPEND-ONLY like audit)
CREATE TABLE engagement_state_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES maxsam_leads(id) ON DELETE CASCADE,
    previous_state engagement_state,
    new_state engagement_state NOT NULL,
    transition_guard engagement_guard,
    transitioned_by TEXT NOT NULL,
    transition_reason TEXT NOT NULL,
    orion_decision_id TEXT,
    sam_paused BOOLEAN NOT NULL DEFAULT FALSE,
    human_actor_id TEXT,
    metadata JSONB DEFAULT '{}',
    transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying state history
CREATE INDEX idx_engagement_log_lead ON engagement_state_log(lead_id, transitioned_at DESC);

-- Prevent modifications to state log
CREATE TRIGGER prevent_engagement_log_modification
    BEFORE UPDATE OR DELETE ON engagement_state_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_modification();

-- ============================================================================
-- SECTION 4: VALID STATE TRANSITIONS (ENFORCED)
-- ============================================================================

CREATE TABLE valid_engagement_transitions (
    id SERIAL PRIMARY KEY,
    from_state engagement_state NOT NULL,
    to_state engagement_state NOT NULL,
    required_guard engagement_guard NOT NULL,
    UNIQUE (from_state, to_state, required_guard)
);

-- Insert valid transitions
INSERT INTO valid_engagement_transitions (from_state, to_state, required_guard) VALUES
    ('NOT_CONTACTED', 'SAM_ACTIVE', 'SAM_INITIATED'),
    ('SAM_ACTIVE', 'AWAITING_RESPONSE', 'RESPONSE_RECEIVED'),
    ('SAM_ACTIVE', 'HUMAN_REQUESTED', 'HUMAN_REQUEST_TRIGGERED'),
    ('SAM_ACTIVE', 'CLOSED', 'LEAD_DEAD'),
    ('AWAITING_RESPONSE', 'SAM_ACTIVE', 'SAM_INITIATED'),
    ('AWAITING_RESPONSE', 'HUMAN_REQUESTED', 'HUMAN_REQUEST_TRIGGERED'),
    ('AWAITING_RESPONSE', 'CLOSED', 'DEAL_CLOSED'),
    ('AWAITING_RESPONSE', 'CLOSED', 'LEAD_DEAD'),
    ('HUMAN_REQUESTED', 'HUMAN_APPROVED', 'ORION_APPROVED'),
    ('HUMAN_REQUESTED', 'CLOSED', 'LEAD_DEAD'),
    ('HUMAN_APPROVED', 'HUMAN_IN_PROGRESS', 'OPS_CONSOLE_ACTIVATED'),
    ('HUMAN_IN_PROGRESS', 'HUMAN_COMPLETED', 'HUMAN_TASK_COMPLETE'),
    ('HUMAN_IN_PROGRESS', 'CLOSED', 'LEAD_DEAD'),
    ('HUMAN_COMPLETED', 'RETURNED_TO_AUTONOMY', 'RETURN_AUTHORIZED'),
    ('HUMAN_COMPLETED', 'CLOSED', 'DEAL_CLOSED'),
    ('RETURNED_TO_AUTONOMY', 'SAM_ACTIVE', 'SAM_INITIATED'),
    ('RETURNED_TO_AUTONOMY', 'CLOSED', 'DEAL_CLOSED');

-- ============================================================================
-- SECTION 5: STATE TRANSITION FUNCTION (GUARDED)
-- ============================================================================

CREATE OR REPLACE FUNCTION transition_engagement_state(
    p_lead_id UUID,
    p_new_state engagement_state,
    p_guard engagement_guard,
    p_transitioned_by TEXT,
    p_reason TEXT,
    p_orion_decision_id TEXT DEFAULT NULL,
    p_human_actor_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_state engagement_state
) AS $$
DECLARE
    v_current_state engagement_state;
    v_valid_transition BOOLEAN;
    v_sam_should_pause BOOLEAN;
BEGIN
    -- Get current state (or default for new leads)
    SELECT COALESCE(les.current_state, 'NOT_CONTACTED')
    INTO v_current_state
    FROM maxsam_leads ml
    LEFT JOIN lead_engagement_state les ON ml.id = les.lead_id
    WHERE ml.id = p_lead_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Lead not found', NULL::engagement_state;
        RETURN;
    END IF;

    -- Validate transition
    SELECT EXISTS (
        SELECT 1 FROM valid_engagement_transitions
        WHERE from_state = v_current_state
          AND to_state = p_new_state
          AND required_guard = p_guard
    ) INTO v_valid_transition;

    IF NOT v_valid_transition THEN
        RETURN QUERY SELECT
            FALSE,
            format('Invalid transition: %s -> %s (guard: %s)', v_current_state, p_new_state, p_guard),
            NULL::engagement_state;
        RETURN;
    END IF;

    -- Determine if Sam should pause (human control states)
    v_sam_should_pause := p_new_state IN (
        'HUMAN_REQUESTED',
        'HUMAN_APPROVED',
        'HUMAN_IN_PROGRESS'
    );

    -- ORION approval is required for HUMAN_APPROVED state
    IF p_new_state = 'HUMAN_APPROVED' AND p_orion_decision_id IS NULL THEN
        RETURN QUERY SELECT
            FALSE,
            'ORION approval required for HUMAN_APPROVED transition',
            NULL::engagement_state;
        RETURN;
    END IF;

    -- Insert or update lead_engagement_state
    INSERT INTO lead_engagement_state (
        lead_id,
        current_state,
        sam_paused,
        human_actor_id,
        orion_decision_id,
        updated_at
    )
    VALUES (
        p_lead_id,
        p_new_state,
        v_sam_should_pause,
        p_human_actor_id,
        p_orion_decision_id,
        NOW()
    )
    ON CONFLICT (lead_id) DO UPDATE SET
        current_state = p_new_state,
        sam_paused = v_sam_should_pause,
        human_actor_id = COALESCE(p_human_actor_id, lead_engagement_state.human_actor_id),
        orion_decision_id = COALESCE(p_orion_decision_id, lead_engagement_state.orion_decision_id),
        updated_at = NOW();

    -- Log the transition (append-only)
    INSERT INTO engagement_state_log (
        lead_id,
        previous_state,
        new_state,
        transition_guard,
        transitioned_by,
        transition_reason,
        orion_decision_id,
        sam_paused,
        human_actor_id,
        metadata
    ) VALUES (
        p_lead_id,
        v_current_state,
        p_new_state,
        p_guard,
        p_transitioned_by,
        p_reason,
        p_orion_decision_id,
        v_sam_should_pause,
        p_human_actor_id,
        p_metadata
    );

    RETURN QUERY SELECT TRUE, 'Transition successful', p_new_state;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 6: HELPER VIEWS
-- ============================================================================

-- View for current engagement states
CREATE VIEW v_lead_engagement_status AS
SELECT
    ml.id AS lead_id,
    ml.owner_name,
    ml.excess_amount,
    ml.eleanor_score,
    COALESCE(les.current_state, 'NOT_CONTACTED') AS current_state,
    COALESCE(les.sam_paused, FALSE) AS sam_paused,
    les.human_actor_id,
    les.orion_decision_id,
    les.updated_at AS state_updated_at
FROM maxsam_leads ml
LEFT JOIN lead_engagement_state les ON ml.id = les.lead_id;

-- View for human-controlled leads
CREATE VIEW v_human_controlled_leads AS
SELECT
    ml.id AS lead_id,
    ml.owner_name,
    ml.excess_amount,
    les.current_state,
    les.human_actor_id,
    les.orion_decision_id,
    les.updated_at
FROM maxsam_leads ml
JOIN lead_engagement_state les ON ml.id = les.lead_id
WHERE les.current_state IN ('HUMAN_REQUESTED', 'HUMAN_APPROVED', 'HUMAN_IN_PROGRESS')
ORDER BY les.updated_at DESC;

-- View for recent workflow audit entries
CREATE VIEW v_recent_workflow_audits AS
SELECT
    id,
    workflow_id,
    risk_level,
    approved_by,
    deployed_at IS NOT NULL AS is_deployed,
    created_at
FROM n8n_workflow_audit
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- SECTION 7: CEO DASHBOARD HELPER FUNCTIONS (READ-ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_n8n_dashboard_stats()
RETURNS TABLE (
    total_workflows INTEGER,
    active_workflows INTEGER,
    archived_count INTEGER,
    deployments_24h INTEGER,
    errors_24h INTEGER,
    last_deployment TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(DISTINCT workflow_id) FROM n8n_workflow_audit)::INTEGER,
        (SELECT COUNT(DISTINCT workflow_id) FROM n8n_workflow_audit WHERE deployed_at IS NOT NULL)::INTEGER,
        (SELECT COUNT(*) FROM n8n_workflow_archive)::INTEGER,
        (SELECT COUNT(*) FROM n8n_workflow_audit WHERE deployed_at > NOW() - INTERVAL '24 hours')::INTEGER,
        (SELECT COUNT(*) FROM n8n_workflow_audit WHERE risk_level IN ('HIGH', 'CRITICAL') AND created_at > NOW() - INTERVAL '24 hours')::INTEGER,
        (SELECT MAX(deployed_at) FROM n8n_workflow_audit);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_engagement_dashboard_stats()
RETURNS TABLE (
    total_leads INTEGER,
    not_contacted INTEGER,
    sam_active INTEGER,
    awaiting_response INTEGER,
    human_controlled INTEGER,
    closed INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM maxsam_leads)::INTEGER,
        (SELECT COUNT(*) FROM v_lead_engagement_status WHERE current_state = 'NOT_CONTACTED')::INTEGER,
        (SELECT COUNT(*) FROM v_lead_engagement_status WHERE current_state = 'SAM_ACTIVE')::INTEGER,
        (SELECT COUNT(*) FROM v_lead_engagement_status WHERE current_state = 'AWAITING_RESPONSE')::INTEGER,
        (SELECT COUNT(*) FROM v_lead_engagement_status WHERE current_state IN ('HUMAN_REQUESTED', 'HUMAN_APPROVED', 'HUMAN_IN_PROGRESS'))::INTEGER,
        (SELECT COUNT(*) FROM v_lead_engagement_status WHERE current_state = 'CLOSED')::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SECTION 8: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE n8n_workflow_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_workflow_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_engagement_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_state_log ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated access
CREATE POLICY "Authenticated users can view audit" ON n8n_workflow_audit
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert audit" ON n8n_workflow_audit
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view archive" ON n8n_workflow_archive
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert archive" ON n8n_workflow_archive
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view engagement state" ON lead_engagement_state
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view engagement log" ON engagement_state_log
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert engagement log" ON engagement_state_log
    FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE n8n_workflow_audit IS 'Immutable audit trail for n8n workflow changes. APPEND-ONLY.';
COMMENT ON TABLE n8n_workflow_archive IS 'Version storage for workflow rollback capability.';
COMMENT ON TABLE lead_engagement_state IS 'Current engagement state for each lead.';
COMMENT ON TABLE engagement_state_log IS 'Immutable log of all engagement state transitions. APPEND-ONLY.';
COMMENT ON TABLE valid_engagement_transitions IS 'Allowed state transitions with required guards.';
