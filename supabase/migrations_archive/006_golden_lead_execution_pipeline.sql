-- ============================================================
-- MAXSAM V4 - GOLDEN LEAD EXECUTION PIPELINE
-- Migration 006: Governed Golden Lead Declaration System
-- ============================================================
-- This migration implements the Golden Lead execution pipeline
-- with strict governance controls as defined in MAXSAM_EXECUTION_HANDOFF.md
--
-- Run AFTER 005_ralph_wiggum_autonomous_layer.sql
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM: deal_type_enum
-- Locked deal types for golden leads
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_type_enum') THEN
        CREATE TYPE deal_type_enum AS ENUM (
            'excess_only',    -- Excess funds recovery only
            'wholesale',      -- Wholesale deal only
            'dual'            -- Combined excess + wholesale
        );
    END IF;
END $$;

-- ============================================================
-- ENUM: golden_lead_status_enum
-- Status progression for golden leads
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'golden_lead_status_enum') THEN
        CREATE TYPE golden_lead_status_enum AS ENUM (
            'declared',           -- Just declared, awaiting action
            'telegram_sent',      -- Logan notified
            'call_queued',        -- Sam call task created
            'call_in_progress',   -- Sam is calling
            'qualified',          -- Owner responded positively
            'contract_sent',      -- Contract sent via DocuSign
            'contract_signed',    -- Contract signed
            'closed',             -- Deal closed
            'dead'                -- Lead is dead/unresponsive
        );
    END IF;
END $$;

-- ============================================================
-- TABLE: golden_lead_candidates
-- Candidates proposed by Gemini/Claude for evaluation
-- Level 0-1: Intelligence and recommendation only
-- ============================================================
CREATE TABLE IF NOT EXISTS golden_lead_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source tracking
    source_pdf_url TEXT,
    source_pdf_hash TEXT,
    extracted_by TEXT NOT NULL DEFAULT 'gemini',  -- gemini, manual

    -- Person identification
    owner_name TEXT NOT NULL,
    owner_name_confidence DECIMAL(3,2) DEFAULT 0.00,  -- 0.00 to 1.00

    -- Jurisdiction
    jurisdiction TEXT NOT NULL DEFAULT 'Dallas County, TX',
    case_number TEXT,

    -- Excess funds data
    excess_funds_amount DECIMAL(12,2),
    excess_funds_expiration DATE,
    excess_funds_source TEXT,  -- foreclosure, tax_sale, etc.

    -- Property/distress data
    property_address TEXT,
    property_city TEXT,
    property_zip TEXT,
    foreclosure_date DATE,
    loan_balance DECIMAL(12,2),
    estimated_arv DECIMAL(12,2),

    -- Contact info (from skip-trace)
    phone_primary TEXT,
    phone_secondary TEXT,
    email TEXT,
    mailing_address TEXT,

    -- Evaluation scores
    priority_score INTEGER DEFAULT 0 CHECK (priority_score >= 0 AND priority_score <= 100),
    eleanor_score INTEGER DEFAULT 0,
    confidence_score DECIMAL(3,2) DEFAULT 0.00,

    -- Recommended deal type
    recommended_deal_type deal_type_enum DEFAULT 'excess_only',

    -- Estimated upside
    estimated_recovery_fee DECIMAL(12,2),  -- 25% of excess funds
    estimated_wholesale_fee DECIMAL(12,2), -- 10% of wholesale spread
    estimated_total_upside DECIMAL(12,2),

    -- Evaluation status
    evaluation_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (evaluation_status IN (
            'pending',        -- Awaiting Claude evaluation
            'evaluating',     -- Claude is evaluating
            'approved',       -- Approved for declaration
            'rejected',       -- Rejected, will not declare
            'declared'        -- Already declared as golden lead
        )),

    -- Claude's evaluation
    evaluated_by TEXT,  -- 'claude', 'manual'
    evaluated_at TIMESTAMPTZ,
    evaluation_reasoning TEXT,
    rejection_reason TEXT,

    -- Matching/deduplication
    matched_lead_id UUID,  -- Link to existing maxsam_leads if matched

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for candidate queries
CREATE INDEX IF NOT EXISTS idx_golden_candidates_status ON golden_lead_candidates(evaluation_status);
CREATE INDEX IF NOT EXISTS idx_golden_candidates_score ON golden_lead_candidates(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_golden_candidates_owner ON golden_lead_candidates(owner_name);
CREATE INDEX IF NOT EXISTS idx_golden_candidates_created ON golden_lead_candidates(created_at DESC);

-- ============================================================
-- TABLE: golden_leads
-- CRITICAL: This table should ONLY be populated via
-- the declare_golden_lead() function - NEVER directly
-- ============================================================
CREATE TABLE IF NOT EXISTS golden_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Origin tracking
    candidate_id UUID NOT NULL REFERENCES golden_lead_candidates(id),
    source_lead_id UUID,  -- Optional link to maxsam_leads

    -- Declaration metadata
    declared_by TEXT NOT NULL,  -- 'claude', 'ralph', etc.
    declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    declaration_reason TEXT NOT NULL,

    -- Core lead data (denormalized from candidate for execution)
    owner_name TEXT NOT NULL,
    jurisdiction TEXT NOT NULL DEFAULT 'Dallas County, TX',

    -- Deal specification
    deal_type deal_type_enum NOT NULL,

    -- Financials (snapshot at declaration time)
    excess_funds_amount DECIMAL(12,2),
    excess_funds_expiration DATE,
    loan_balance DECIMAL(12,2),
    estimated_arv DECIMAL(12,2),
    priority_score INTEGER NOT NULL,
    estimated_total_upside DECIMAL(12,2),

    -- Property
    property_address TEXT,
    property_city TEXT,

    -- Contact
    phone_primary TEXT,
    phone_secondary TEXT,
    email TEXT,

    -- Status progression
    status golden_lead_status_enum NOT NULL DEFAULT 'declared',

    -- Execution tracking
    telegram_sent_at TIMESTAMPTZ,
    call_queued_at TIMESTAMPTZ,
    call_task_id UUID,  -- Reference to agent_tasks
    qualified_at TIMESTAMPTZ,
    contract_sent_at TIMESTAMPTZ,
    contract_signed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,

    -- Outcome tracking
    actual_recovery_amount DECIMAL(12,2),
    actual_fee_amount DECIMAL(12,2),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for golden leads
CREATE INDEX IF NOT EXISTS idx_golden_leads_status ON golden_leads(status);
CREATE INDEX IF NOT EXISTS idx_golden_leads_declared_at ON golden_leads(declared_at DESC);
CREATE INDEX IF NOT EXISTS idx_golden_leads_owner ON golden_leads(owner_name);
CREATE INDEX IF NOT EXISTS idx_golden_leads_candidate ON golden_leads(candidate_id);

-- ============================================================
-- TABLE: golden_lead_events
-- Event emission table for n8n polling/triggers
-- This is the bridge between Supabase and n8n
-- ============================================================
CREATE TABLE IF NOT EXISTS golden_lead_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Event identification
    golden_lead_id UUID NOT NULL REFERENCES golden_leads(id) ON DELETE CASCADE,

    -- Event type
    event_type TEXT NOT NULL CHECK (event_type IN (
        'declared',           -- Golden lead was declared
        'telegram_sent',      -- Telegram notification sent
        'call_queued',        -- Sam call task created
        'call_completed',     -- Sam call completed
        'status_changed',     -- Status changed
        'qualified',          -- Lead qualified
        'contract_sent',      -- Contract sent
        'contract_signed',    -- Contract signed
        'closed',             -- Deal closed
        'dead'                -- Lead marked dead
    )),

    -- Event data
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Processing status (for n8n)
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processed_by TEXT,  -- Worker/workflow that processed this

    -- Error handling
    process_error TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Critical index for n8n polling - unprocessed events
CREATE INDEX IF NOT EXISTS idx_golden_events_unprocessed
    ON golden_lead_events(created_at ASC)
    WHERE processed = FALSE;

CREATE INDEX IF NOT EXISTS idx_golden_events_golden_lead
    ON golden_lead_events(golden_lead_id);

CREATE INDEX IF NOT EXISTS idx_golden_events_type
    ON golden_lead_events(event_type);

-- ============================================================
-- SYSTEM CONTROLS: Sam Hours and Golden Lead Settings
-- ============================================================
INSERT INTO system_controls (control_key, control_value, description, control_type) VALUES
    -- Sam availability controls
    ('sam_enabled', 'false'::jsonb, 'Master enable/disable for Sam outreach', 'boolean'),
    ('sam_hours_start', '"09:00"'::jsonb, 'Sam outreach start time (24h format, local time)', 'string'),
    ('sam_hours_end', '"18:00"'::jsonb, 'Sam outreach end time (24h format, local time)', 'string'),
    ('sam_timezone', '"America/Chicago"'::jsonb, 'Timezone for Sam hours calculation', 'string'),
    ('sam_daily_rate_limit', '20'::jsonb, 'Maximum calls Sam can make per day', 'number'),

    -- Golden lead controls
    ('golden_lead_auto_declare', 'false'::jsonb, 'Allow Claude to auto-declare golden leads', 'boolean'),
    ('golden_lead_min_score', '60'::jsonb, 'Minimum priority score for golden lead declaration', 'number'),
    ('golden_lead_require_excess_funds', 'true'::jsonb, 'Require excess funds for golden lead', 'boolean'),
    ('golden_lead_notify_telegram', 'true'::jsonb, 'Send Telegram notification on declaration', 'boolean')

ON CONFLICT (control_key) DO NOTHING;

-- ============================================================
-- FUNCTION: is_within_sam_hours
-- Check if current time is within Sam's operating hours
-- ============================================================
CREATE OR REPLACE FUNCTION is_within_sam_hours()
RETURNS BOOLEAN AS $$
DECLARE
    v_sam_enabled BOOLEAN;
    v_hours_start TEXT;
    v_hours_end TEXT;
    v_timezone TEXT;
    v_current_time TIME;
    v_start_time TIME;
    v_end_time TIME;
BEGIN
    -- Check if Sam is enabled
    SELECT (control_value)::boolean INTO v_sam_enabled
    FROM system_controls WHERE control_key = 'sam_enabled';

    IF NOT COALESCE(v_sam_enabled, false) THEN
        RETURN FALSE;
    END IF;

    -- Get hours configuration
    SELECT control_value::text INTO v_hours_start
    FROM system_controls WHERE control_key = 'sam_hours_start';

    SELECT control_value::text INTO v_hours_end
    FROM system_controls WHERE control_key = 'sam_hours_end';

    SELECT control_value::text INTO v_timezone
    FROM system_controls WHERE control_key = 'sam_timezone';

    -- Clean up JSON string quotes
    v_hours_start := TRIM(BOTH '"' FROM v_hours_start);
    v_hours_end := TRIM(BOTH '"' FROM v_hours_end);
    v_timezone := TRIM(BOTH '"' FROM v_timezone);

    -- Default values
    v_hours_start := COALESCE(v_hours_start, '09:00');
    v_hours_end := COALESCE(v_hours_end, '18:00');
    v_timezone := COALESCE(v_timezone, 'America/Chicago');

    -- Get current time in configured timezone
    v_current_time := (NOW() AT TIME ZONE v_timezone)::TIME;
    v_start_time := v_hours_start::TIME;
    v_end_time := v_hours_end::TIME;

    -- Check if within window
    RETURN v_current_time >= v_start_time AND v_current_time <= v_end_time;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: declare_golden_lead
-- THE ONLY WAY to create a golden lead
-- Enforces all governance rules
-- ============================================================
CREATE OR REPLACE FUNCTION declare_golden_lead(
    p_candidate_id UUID,
    p_deal_type deal_type_enum,
    p_declared_by TEXT,
    p_reason TEXT
)
RETURNS TABLE(
    success BOOLEAN,
    golden_lead_id UUID,
    error_message TEXT
) AS $$
DECLARE
    v_candidate RECORD;
    v_min_score INTEGER;
    v_require_excess BOOLEAN;
    v_auto_declare BOOLEAN;
    v_golden_id UUID;
    v_event_data JSONB;
BEGIN
    -- ============================================
    -- GUARD 1: Check if auto-declaration is enabled
    -- ============================================
    IF p_declared_by != 'manual' THEN
        SELECT (control_value)::boolean INTO v_auto_declare
        FROM system_controls WHERE control_key = 'golden_lead_auto_declare';

        IF NOT COALESCE(v_auto_declare, false) THEN
            RETURN QUERY SELECT FALSE, NULL::UUID,
                'Auto-declaration is disabled. Set golden_lead_auto_declare to true.'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- ============================================
    -- GUARD 2: Fetch and validate candidate
    -- ============================================
    SELECT * INTO v_candidate
    FROM golden_lead_candidates
    WHERE id = p_candidate_id;

    IF v_candidate IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID,
            format('Candidate %s not found', p_candidate_id)::TEXT;
        RETURN;
    END IF;

    -- ============================================
    -- GUARD 3: Candidate must be approved
    -- ============================================
    IF v_candidate.evaluation_status != 'approved' THEN
        RETURN QUERY SELECT FALSE, NULL::UUID,
            format('Candidate status is "%s". Must be "approved" to declare.',
                   v_candidate.evaluation_status)::TEXT;
        RETURN;
    END IF;

    -- ============================================
    -- GUARD 4: Check if already declared
    -- ============================================
    IF EXISTS (SELECT 1 FROM golden_leads WHERE candidate_id = p_candidate_id) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID,
            'Candidate has already been declared as a golden lead.'::TEXT;
        RETURN;
    END IF;

    -- ============================================
    -- GUARD 5: Minimum score requirement
    -- ============================================
    SELECT (control_value)::integer INTO v_min_score
    FROM system_controls WHERE control_key = 'golden_lead_min_score';

    v_min_score := COALESCE(v_min_score, 60);

    IF COALESCE(v_candidate.priority_score, 0) < v_min_score THEN
        RETURN QUERY SELECT FALSE, NULL::UUID,
            format('Priority score %s is below minimum threshold %s',
                   v_candidate.priority_score, v_min_score)::TEXT;
        RETURN;
    END IF;

    -- ============================================
    -- GUARD 6: Excess funds requirement (if enabled)
    -- ============================================
    SELECT (control_value)::boolean INTO v_require_excess
    FROM system_controls WHERE control_key = 'golden_lead_require_excess_funds';

    IF COALESCE(v_require_excess, true) AND p_deal_type IN ('excess_only', 'dual') THEN
        IF COALESCE(v_candidate.excess_funds_amount, 0) <= 0 THEN
            RETURN QUERY SELECT FALSE, NULL::UUID,
                'Excess funds required but candidate has no excess funds amount.'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- ============================================
    -- GUARD 7: Validate deal type matches candidate data
    -- ============================================
    IF p_deal_type = 'wholesale' AND COALESCE(v_candidate.estimated_arv, 0) <= 0 THEN
        RETURN QUERY SELECT FALSE, NULL::UUID,
            'Wholesale deal type requires estimated ARV.'::TEXT;
        RETURN;
    END IF;

    -- ============================================
    -- ALL GUARDS PASSED - CREATE GOLDEN LEAD
    -- ============================================

    -- Insert golden lead
    INSERT INTO golden_leads (
        candidate_id,
        declared_by,
        declaration_reason,
        owner_name,
        jurisdiction,
        deal_type,
        excess_funds_amount,
        excess_funds_expiration,
        loan_balance,
        estimated_arv,
        priority_score,
        estimated_total_upside,
        property_address,
        property_city,
        phone_primary,
        phone_secondary,
        email,
        status
    )
    VALUES (
        p_candidate_id,
        p_declared_by,
        p_reason,
        v_candidate.owner_name,
        v_candidate.jurisdiction,
        p_deal_type,
        v_candidate.excess_funds_amount,
        v_candidate.excess_funds_expiration,
        v_candidate.loan_balance,
        v_candidate.estimated_arv,
        v_candidate.priority_score,
        v_candidate.estimated_total_upside,
        v_candidate.property_address,
        v_candidate.property_city,
        v_candidate.phone_primary,
        v_candidate.phone_secondary,
        v_candidate.email,
        'declared'
    )
    RETURNING id INTO v_golden_id;

    -- Update candidate status
    UPDATE golden_lead_candidates
    SET
        evaluation_status = 'declared',
        updated_at = NOW()
    WHERE id = p_candidate_id;

    -- ============================================
    -- EMIT DECLARATION EVENT
    -- This is what n8n will poll for
    -- ============================================
    v_event_data := jsonb_build_object(
        'owner_name', v_candidate.owner_name,
        'jurisdiction', v_candidate.jurisdiction,
        'deal_type', p_deal_type::text,
        'excess_funds_amount', v_candidate.excess_funds_amount,
        'excess_funds_expiration', v_candidate.excess_funds_expiration,
        'loan_balance', v_candidate.loan_balance,
        'estimated_arv', v_candidate.estimated_arv,
        'priority_score', v_candidate.priority_score,
        'estimated_total_upside', v_candidate.estimated_total_upside,
        'property_address', v_candidate.property_address,
        'property_city', v_candidate.property_city,
        'phone_primary', v_candidate.phone_primary,
        'declared_by', p_declared_by,
        'declaration_reason', p_reason,
        'declared_at', NOW()
    );

    INSERT INTO golden_lead_events (
        golden_lead_id,
        event_type,
        event_data,
        processed
    )
    VALUES (
        v_golden_id,
        'declared',
        v_event_data,
        FALSE
    );

    -- Return success
    RETURN QUERY SELECT TRUE, v_golden_id, NULL::TEXT;

END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: get_unprocessed_golden_events
-- For n8n polling - returns events that need processing
-- ============================================================
CREATE OR REPLACE FUNCTION get_unprocessed_golden_events(
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    event_id UUID,
    golden_lead_id UUID,
    event_type TEXT,
    event_data JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.golden_lead_id,
        e.event_type,
        e.event_data,
        e.created_at
    FROM golden_lead_events e
    WHERE e.processed = FALSE
    ORDER BY e.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: mark_event_processed
-- Called by n8n after processing an event
-- ============================================================
CREATE OR REPLACE FUNCTION mark_event_processed(
    p_event_id UUID,
    p_processed_by TEXT,
    p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE golden_lead_events
    SET
        processed = TRUE,
        processed_at = NOW(),
        processed_by = p_processed_by,
        process_error = p_error,
        retry_count = CASE WHEN p_error IS NOT NULL THEN retry_count + 1 ELSE retry_count END
    WHERE id = p_event_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: update_golden_lead_status
-- Safely update status and emit event
-- ============================================================
CREATE OR REPLACE FUNCTION update_golden_lead_status(
    p_golden_lead_id UUID,
    p_new_status golden_lead_status_enum,
    p_updated_by TEXT DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status golden_lead_status_enum;
BEGIN
    -- Get current status
    SELECT status INTO v_old_status
    FROM golden_leads
    WHERE id = p_golden_lead_id;

    IF v_old_status IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Don't update if same status
    IF v_old_status = p_new_status THEN
        RETURN TRUE;
    END IF;

    -- Update status and relevant timestamp
    UPDATE golden_leads
    SET
        status = p_new_status,
        updated_at = NOW(),
        telegram_sent_at = CASE WHEN p_new_status = 'telegram_sent' THEN NOW() ELSE telegram_sent_at END,
        call_queued_at = CASE WHEN p_new_status = 'call_queued' THEN NOW() ELSE call_queued_at END,
        qualified_at = CASE WHEN p_new_status = 'qualified' THEN NOW() ELSE qualified_at END,
        contract_sent_at = CASE WHEN p_new_status = 'contract_sent' THEN NOW() ELSE contract_sent_at END,
        contract_signed_at = CASE WHEN p_new_status = 'contract_signed' THEN NOW() ELSE contract_signed_at END,
        closed_at = CASE WHEN p_new_status = 'closed' THEN NOW() ELSE closed_at END
    WHERE id = p_golden_lead_id;

    -- Emit status change event
    INSERT INTO golden_lead_events (
        golden_lead_id,
        event_type,
        event_data,
        processed
    )
    VALUES (
        p_golden_lead_id,
        CASE p_new_status
            WHEN 'qualified' THEN 'qualified'
            WHEN 'contract_sent' THEN 'contract_sent'
            WHEN 'contract_signed' THEN 'contract_signed'
            WHEN 'closed' THEN 'closed'
            WHEN 'dead' THEN 'dead'
            ELSE 'status_changed'
        END,
        jsonb_build_object(
            'old_status', v_old_status::text,
            'new_status', p_new_status::text,
            'updated_by', p_updated_by,
            'updated_at', NOW()
        ),
        FALSE
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: create_sam_call_task
-- Creates a call task for Sam (respects hours + limits)
-- ============================================================
CREATE OR REPLACE FUNCTION create_sam_call_task(
    p_golden_lead_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    task_id UUID,
    error_message TEXT,
    queued_for_later BOOLEAN
) AS $$
DECLARE
    v_golden_lead RECORD;
    v_sam_enabled BOOLEAN;
    v_within_hours BOOLEAN;
    v_daily_limit INTEGER;
    v_calls_today INTEGER;
    v_task_id UUID;
BEGIN
    -- Get golden lead
    SELECT * INTO v_golden_lead
    FROM golden_leads
    WHERE id = p_golden_lead_id;

    IF v_golden_lead IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Golden lead not found'::TEXT, FALSE;
        RETURN;
    END IF;

    -- Check Sam enabled
    SELECT (control_value)::boolean INTO v_sam_enabled
    FROM system_controls WHERE control_key = 'sam_enabled';

    IF NOT COALESCE(v_sam_enabled, false) THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Sam is disabled'::TEXT, TRUE;
        RETURN;
    END IF;

    -- Check if within hours
    v_within_hours := is_within_sam_hours();

    IF NOT v_within_hours THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'Outside Sam operating hours'::TEXT, TRUE;
        RETURN;
    END IF;

    -- Check daily rate limit
    SELECT (control_value)::integer INTO v_daily_limit
    FROM system_controls WHERE control_key = 'sam_daily_rate_limit';

    v_daily_limit := COALESCE(v_daily_limit, 20);

    SELECT COUNT(*) INTO v_calls_today
    FROM agent_tasks
    WHERE task_key LIKE 'sam_call_%'
      AND created_at >= CURRENT_DATE
      AND status NOT IN ('cancelled', 'blocked');

    IF v_calls_today >= v_daily_limit THEN
        RETURN QUERY SELECT FALSE, NULL::UUID,
            format('Daily call limit reached (%s/%s)', v_calls_today, v_daily_limit)::TEXT, TRUE;
        RETURN;
    END IF;

    -- Create the task
    INSERT INTO agent_tasks (
        task_key,
        task_name,
        spec,
        priority,
        required_autonomy_level,
        source,
        status
    )
    VALUES (
        format('sam_call_%s', p_golden_lead_id),
        format('Call %s for golden lead', v_golden_lead.owner_name),
        jsonb_build_object(
            'action', 'outbound_call',
            'golden_lead_id', p_golden_lead_id,
            'owner_name', v_golden_lead.owner_name,
            'phone', COALESCE(v_golden_lead.phone_primary, v_golden_lead.phone_secondary),
            'deal_type', v_golden_lead.deal_type::text,
            'excess_funds_amount', v_golden_lead.excess_funds_amount,
            'property_address', v_golden_lead.property_address,
            'talking_points', ARRAY[
                format('$%s in unclaimed funds', COALESCE(v_golden_lead.excess_funds_amount, 0)),
                format('Property at %s', COALESCE(v_golden_lead.property_address, 'address on file')),
                '25% fee for recovery assistance'
            ]
        ),
        v_golden_lead.priority_score,  -- Use priority score for task priority
        3,  -- Requires autonomy level 3
        'golden_lead_declaration',
        'queued'
    )
    RETURNING id INTO v_task_id;

    -- Update golden lead
    UPDATE golden_leads
    SET
        status = 'call_queued',
        call_queued_at = NOW(),
        call_task_id = v_task_id
    WHERE id = p_golden_lead_id;

    -- Emit event
    INSERT INTO golden_lead_events (
        golden_lead_id,
        event_type,
        event_data,
        processed
    )
    VALUES (
        p_golden_lead_id,
        'call_queued',
        jsonb_build_object(
            'task_id', v_task_id,
            'phone', COALESCE(v_golden_lead.phone_primary, v_golden_lead.phone_secondary),
            'created_at', NOW()
        ),
        FALSE
    );

    RETURN QUERY SELECT TRUE, v_task_id, NULL::TEXT, FALSE;

END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEW: v_golden_lead_queue
-- Active golden leads ready for processing
-- ============================================================
CREATE OR REPLACE VIEW v_golden_lead_queue AS
SELECT
    gl.id,
    gl.owner_name,
    gl.jurisdiction,
    gl.deal_type,
    gl.excess_funds_amount,
    gl.priority_score,
    gl.estimated_total_upside,
    gl.property_address,
    gl.phone_primary,
    gl.status,
    gl.declared_at,
    gl.declared_by,
    CASE
        WHEN gl.status = 'declared' THEN 'Awaiting Telegram notification'
        WHEN gl.status = 'telegram_sent' THEN 'Awaiting call queue'
        WHEN gl.status = 'call_queued' THEN 'In Sam queue'
        ELSE gl.status::text
    END as status_description,
    is_within_sam_hours() as sam_available_now
FROM golden_leads gl
WHERE gl.status NOT IN ('closed', 'dead')
ORDER BY gl.priority_score DESC, gl.declared_at ASC;

-- ============================================================
-- VIEW: v_pending_golden_events
-- Events waiting to be processed by n8n
-- ============================================================
CREATE OR REPLACE VIEW v_pending_golden_events AS
SELECT
    e.id as event_id,
    e.golden_lead_id,
    e.event_type,
    e.event_data,
    e.created_at,
    e.retry_count,
    gl.owner_name,
    gl.deal_type,
    gl.status as golden_lead_status
FROM golden_lead_events e
JOIN golden_leads gl ON gl.id = e.golden_lead_id
WHERE e.processed = FALSE
ORDER BY e.created_at ASC;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE golden_lead_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE golden_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE golden_lead_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated access
DROP POLICY IF EXISTS "Allow authenticated access to golden_lead_candidates" ON golden_lead_candidates;
CREATE POLICY "Allow authenticated access to golden_lead_candidates" ON golden_lead_candidates
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to golden_leads" ON golden_leads;
CREATE POLICY "Allow authenticated access to golden_leads" ON golden_leads
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to golden_lead_events" ON golden_lead_events;
CREATE POLICY "Allow authenticated access to golden_lead_events" ON golden_lead_events
    FOR ALL TO authenticated USING (true);

-- ============================================================
-- GRANTS
-- ============================================================
GRANT ALL ON golden_lead_candidates TO service_role;
GRANT ALL ON golden_leads TO service_role;
GRANT ALL ON golden_lead_events TO service_role;

GRANT SELECT ON v_golden_lead_queue TO authenticated;
GRANT SELECT ON v_pending_golden_events TO authenticated;

-- ============================================================
-- COMPLETION NOTICE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Golden Lead Execution Pipeline - Migration Complete';
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Tables: golden_lead_candidates, golden_leads, golden_lead_events';
    RAISE NOTICE 'Enums: deal_type_enum, golden_lead_status_enum';
    RAISE NOTICE 'Functions: declare_golden_lead(), is_within_sam_hours()';
    RAISE NOTICE 'Functions: get_unprocessed_golden_events(), mark_event_processed()';
    RAISE NOTICE 'Functions: update_golden_lead_status(), create_sam_call_task()';
    RAISE NOTICE 'Views: v_golden_lead_queue, v_pending_golden_events';
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'IMPORTANT: Golden leads can ONLY be created via declare_golden_lead()';
    RAISE NOTICE 'Sam outreach is DISABLED by default. Enable in system_controls.';
    RAISE NOTICE '========================================================';
END $$;
