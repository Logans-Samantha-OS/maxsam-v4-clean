-- ============================================================
-- MAXSAM V4 - CI/CD EXTENSION SCHEMA
-- Workflow Versioning + Deploy Gates + Regression Testing
-- Run AFTER the main schema
-- ============================================================

-- ============================================================
-- TABLE: workflow_versions
-- Stores candidate vs production workflow versions for testing
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Workflow identification
    workflow_key TEXT NOT NULL,                    -- e.g. 'maxsam_pipeline'
    version_tag TEXT NOT NULL,                     -- e.g. 'candidate-2026-01-12T0215Z'
    n8n_workflow_id TEXT,                          -- n8n workflow ID if deployed
    
    -- Full workflow export
    n8n_workflow_json JSONB NOT NULL,              -- complete workflow JSON for rollback/deploy
    
    -- Version status
    status TEXT NOT NULL DEFAULT 'candidate' 
        CHECK (status IN ('candidate', 'testing', 'approved', 'deployed', 'rejected', 'rollback')),
    
    -- Metadata
    created_by TEXT,
    approved_by TEXT,
    deployed_by TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    
    -- Change tracking
    change_summary TEXT,
    nodes_modified JSONB DEFAULT '[]'::jsonb,
    
    -- Unique constraint
    UNIQUE(workflow_key, version_tag)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_versions_key ON workflow_versions(workflow_key);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_status ON workflow_versions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_versions_created ON workflow_versions(created_at DESC);

-- ============================================================
-- TABLE: deploy_logs
-- Audit trail for all deployment attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS deploy_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Deployment context
    workflow_key TEXT NOT NULL,
    version_tag TEXT NOT NULL,
    run_id TEXT NOT NULL,                          -- Links to test_logs run_id
    
    -- Deployment result
    deployed BOOLEAN NOT NULL,
    deployment_type TEXT DEFAULT 'full' 
        CHECK (deployment_type IN ('full', 'hotfix', 'rollback', 'canary')),
    
    -- Gate results
    tests_passed INTEGER DEFAULT 0,
    tests_failed INTEGER DEFAULT 0,
    blocker_failures INTEGER DEFAULT 0,
    
    -- Environment
    target_environment TEXT DEFAULT 'production'
        CHECK (target_environment IN ('development', 'staging', 'production')),
    
    -- Metadata
    deployed_by TEXT,
    notes TEXT,
    rollback_version_tag TEXT,                     -- If this was a rollback, which version
    
    -- Timestamps
    deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign keys (optional - enable if you want strict referential integrity)
    -- FOREIGN KEY (workflow_key, version_tag) REFERENCES workflow_versions(workflow_key, version_tag)
    
    CONSTRAINT unique_deploy_per_run UNIQUE(workflow_key, version_tag, run_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deploy_logs_workflow ON deploy_logs(workflow_key);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_version ON deploy_logs(workflow_key, version_tag);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_deployed_at ON deploy_logs(deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_environment ON deploy_logs(target_environment);

-- ============================================================
-- TABLE: test_fixtures
-- Stores known-good test inputs for regression testing
-- ============================================================
CREATE TABLE IF NOT EXISTS test_fixtures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Test identification
    fixture_name TEXT NOT NULL UNIQUE,             -- e.g. 'gemini_extractor_dallas_sample'
    node_name TEXT NOT NULL,                       -- e.g. 'ALEX Gemini Lead Extractor'
    test_type TEXT NOT NULL DEFAULT 'unit'
        CHECK (test_type IN ('unit', 'integration', 'e2e', 'smoke')),
    
    -- Test data
    input_fixture JSONB NOT NULL,                  -- Known-good input
    expected_output_schema JSONB NOT NULL,         -- JSON Schema for validation
    expected_output_sample JSONB,                  -- Optional: exact expected output
    
    -- Assertions
    assertions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of assertion rules
    severity TEXT NOT NULL DEFAULT 'blocker'
        CHECK (severity IN ('info', 'warn', 'blocker')),
    
    -- Metadata
    description TEXT,
    created_by TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_fixtures_node ON test_fixtures(node_name);
CREATE INDEX IF NOT EXISTS idx_test_fixtures_type ON test_fixtures(test_type);
CREATE INDEX IF NOT EXISTS idx_test_fixtures_active ON test_fixtures(is_active) WHERE is_active = TRUE;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_test_fixtures_updated_at ON test_fixtures;
CREATE TRIGGER update_test_fixtures_updated_at
    BEFORE UPDATE ON test_fixtures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: test_runs (aggregated run summary)
-- One row per complete test suite execution
-- ============================================================
CREATE TABLE IF NOT EXISTS test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Run identification
    run_id TEXT NOT NULL UNIQUE,
    workflow_key TEXT NOT NULL,
    version_tag TEXT NOT NULL,
    
    -- Aggregated results
    total_tests INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    blocker_failures INTEGER DEFAULT 0,
    warn_failures INTEGER DEFAULT 0,
    
    -- Overall status
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'passed', 'failed', 'aborted')),
    can_deploy BOOLEAN DEFAULT FALSE,
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Environment
    dry_run BOOLEAN DEFAULT TRUE,
    environment TEXT DEFAULT 'test'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_test_runs_run_id ON test_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_workflow ON test_runs(workflow_key, version_tag);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_can_deploy ON test_runs(can_deploy) WHERE can_deploy = TRUE;

-- ============================================================
-- VIEWS
-- ============================================================

-- View: Latest version per workflow
CREATE OR REPLACE VIEW v_latest_workflow_versions AS
SELECT DISTINCT ON (workflow_key) 
    id,
    workflow_key,
    version_tag,
    n8n_workflow_id,
    status,
    created_at,
    deployed_at
FROM workflow_versions
ORDER BY workflow_key, created_at DESC;

-- View: Production-ready candidates (passed tests, not yet deployed)
CREATE OR REPLACE VIEW v_deployable_candidates AS
SELECT 
    wv.workflow_key,
    wv.version_tag,
    wv.n8n_workflow_id,
    wv.status,
    tr.passed,
    tr.failed,
    tr.blocker_failures,
    tr.can_deploy,
    tr.finished_at as tests_completed_at
FROM workflow_versions wv
JOIN test_runs tr ON tr.workflow_key = wv.workflow_key 
    AND tr.version_tag = wv.version_tag
WHERE wv.status = 'approved'
  AND tr.can_deploy = TRUE
  AND tr.status = 'passed'
ORDER BY tr.finished_at DESC;

-- View: Recent test failures
CREATE OR REPLACE VIEW v_recent_test_failures AS
SELECT 
    tl.run_id,
    tl.workflow_key,
    tl.version_tag,
    tl.test_name,
    tl.node_name,
    tl.severity,
    tl.error_text,
    tl.started_at
FROM test_logs tl
WHERE tl.passed = FALSE
  AND tl.started_at >= NOW() - INTERVAL '7 days'
ORDER BY tl.started_at DESC;

-- View: Deployment history
CREATE OR REPLACE VIEW v_deployment_history AS
SELECT 
    dl.workflow_key,
    dl.version_tag,
    dl.deployment_type,
    dl.deployed,
    dl.tests_passed,
    dl.tests_failed,
    dl.target_environment,
    dl.deployed_at,
    dl.notes
FROM deploy_logs dl
ORDER BY dl.deployed_at DESC
LIMIT 50;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function: Register a new workflow version candidate
CREATE OR REPLACE FUNCTION register_workflow_version(
    p_workflow_key TEXT,
    p_version_tag TEXT,
    p_workflow_json JSONB,
    p_created_by TEXT DEFAULT NULL,
    p_change_summary TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO workflow_versions (workflow_key, version_tag, n8n_workflow_json, created_by, change_summary)
    VALUES (p_workflow_key, p_version_tag, p_workflow_json, p_created_by, p_change_summary)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Start a test run
CREATE OR REPLACE FUNCTION start_test_run(
    p_workflow_key TEXT,
    p_version_tag TEXT,
    p_dry_run BOOLEAN DEFAULT TRUE
)
RETURNS TEXT AS $$
DECLARE
    v_run_id TEXT;
BEGIN
    v_run_id := 'run_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || SUBSTR(MD5(RANDOM()::TEXT), 1, 8);
    
    INSERT INTO test_runs (run_id, workflow_key, version_tag, dry_run)
    VALUES (v_run_id, p_workflow_key, p_version_tag, p_dry_run);
    
    -- Update workflow version status to testing
    UPDATE workflow_versions 
    SET status = 'testing' 
    WHERE workflow_key = p_workflow_key 
      AND version_tag = p_version_tag
      AND status = 'candidate';
    
    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Complete a test run and calculate results
CREATE OR REPLACE FUNCTION complete_test_run(p_run_id TEXT)
RETURNS TABLE(
    total INTEGER,
    passed INTEGER,
    failed INTEGER,
    blocker_failures INTEGER,
    can_deploy BOOLEAN,
    status TEXT
) AS $$
DECLARE
    v_total INTEGER;
    v_passed INTEGER;
    v_failed INTEGER;
    v_blockers INTEGER;
    v_can_deploy BOOLEAN;
    v_status TEXT;
    v_workflow_key TEXT;
    v_version_tag TEXT;
BEGIN
    -- Calculate aggregates from test_logs
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE tl.passed = TRUE),
        COUNT(*) FILTER (WHERE tl.passed = FALSE),
        COUNT(*) FILTER (WHERE tl.passed = FALSE AND tl.severity = 'blocker')
    INTO v_total, v_passed, v_failed, v_blockers
    FROM test_logs tl
    WHERE tl.run_id = p_run_id;
    
    -- Determine if deployable (no blocker failures)
    v_can_deploy := (v_blockers = 0);
    v_status := CASE WHEN v_blockers = 0 THEN 'passed' ELSE 'failed' END;
    
    -- Update test_runs
    UPDATE test_runs tr
    SET 
        total_tests = v_total,
        passed = v_passed,
        failed = v_failed,
        blocker_failures = v_blockers,
        warn_failures = v_failed - v_blockers,
        status = v_status,
        can_deploy = v_can_deploy,
        finished_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - tr.started_at))::INTEGER * 1000
    WHERE tr.run_id = p_run_id
    RETURNING tr.workflow_key, tr.version_tag INTO v_workflow_key, v_version_tag;
    
    -- Update workflow version status
    UPDATE workflow_versions
    SET status = CASE WHEN v_can_deploy THEN 'approved' ELSE 'rejected' END,
        approved_at = CASE WHEN v_can_deploy THEN NOW() ELSE NULL END
    WHERE workflow_key = v_workflow_key
      AND version_tag = v_version_tag
      AND status = 'testing';
    
    RETURN QUERY SELECT v_total, v_passed, v_failed, v_blockers, v_can_deploy, v_status;
END;
$$ LANGUAGE plpgsql;

-- Function: Deploy a version (with gate check)
CREATE OR REPLACE FUNCTION deploy_workflow_version(
    p_workflow_key TEXT,
    p_version_tag TEXT,
    p_run_id TEXT,
    p_deployed_by TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_can_deploy BOOLEAN;
    v_tests_passed INTEGER;
    v_tests_failed INTEGER;
BEGIN
    -- Check if this version is deployable
    SELECT tr.can_deploy, tr.passed, tr.failed
    INTO v_can_deploy, v_tests_passed, v_tests_failed
    FROM test_runs tr
    WHERE tr.run_id = p_run_id
      AND tr.workflow_key = p_workflow_key
      AND tr.version_tag = p_version_tag;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Test run not found: %', p_run_id;
    END IF;
    
    -- Log deployment attempt
    INSERT INTO deploy_logs (
        workflow_key, version_tag, run_id, deployed, 
        tests_passed, tests_failed, blocker_failures,
        deployed_by, notes
    )
    SELECT 
        p_workflow_key, p_version_tag, p_run_id, v_can_deploy,
        v_tests_passed, v_tests_failed, tr.blocker_failures,
        p_deployed_by, p_notes
    FROM test_runs tr
    WHERE tr.run_id = p_run_id;
    
    IF v_can_deploy THEN
        -- Mark version as deployed
        UPDATE workflow_versions
        SET status = 'deployed',
            deployed_at = NOW(),
            deployed_by = p_deployed_by
        WHERE workflow_key = p_workflow_key
          AND version_tag = p_version_tag;
        
        -- Archive previous deployed version
        UPDATE workflow_versions
        SET status = 'rollback'
        WHERE workflow_key = p_workflow_key
          AND status = 'deployed'
          AND version_tag != p_version_tag;
    END IF;
    
    RETURN v_can_deploy;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED DATA: Test Fixtures for MaxSam
-- ============================================================

INSERT INTO test_fixtures (fixture_name, node_name, test_type, input_fixture, expected_output_schema, assertions, severity, description) VALUES

-- Node 4: ALEX Gemini Lead Extractor
('gemini_extractor_dallas_sample', 'ALEX Gemini Lead Extractor', 'unit',
 '{"document_text": "CAUSE NO: 2024-TX-12345\nPROPERTY OWNER: John Michael Smith\nPROPERTY ADDRESS: 1234 Main Street, Dallas, TX 75201\nEXCESS FUNDS: $47,892.33\nSALE DATE: 2024-06-15\nCLAIM DEADLINE: 2025-06-15\nCOUNTY: Dallas"}',
 '{"type": "array", "items": {"type": "object", "required": ["cause_number", "owner_name", "property_address", "excess_amount", "county"]}}',
 '[{"rule": "required_fields", "fields": ["cause_number", "owner_name", "property_address", "excess_amount", "county"]}, {"rule": "amount_positive", "field": "excess_amount"}]',
 'blocker', 'Tests Gemini extraction with Dallas County sample'),

-- Node 5: Parse Gemini Response
('parse_gemini_array_output', 'Parse Gemini Response', 'unit',
 '{"candidates": [{"content": {"parts": [{"text": "[{\"cause_number\": \"2024-TX-12345\", \"owner_name\": \"John Smith\"}]"}]}}]}',
 '{"type": "array", "minItems": 1}',
 '[{"rule": "is_array"}, {"rule": "has_metadata", "field": "_extracted_at"}]',
 'blocker', 'Validates Gemini response parsing returns array'),

-- Node 14: ELEANOR Priority Scoring
('eleanor_scoring_high_value', 'ELEANOR Priority Scoring', 'unit',
 '{"excess_amount": 50000, "primary_phone": "2145551234", "primary_email": "test@test.com", "expiry_date": "2025-02-01", "is_golden_lead": true}',
 '{"type": "object", "required": ["priority_score", "priority_tier", "ready_for_outreach"]}',
 '[{"rule": "score_range", "min": 0, "max": 100}, {"rule": "tier_valid", "allowed": ["A+", "A", "B+", "B", "C", "D"]}, {"rule": "high_value_score", "min_score": 80}]',
 'blocker', 'Tests scoring algorithm with high-value lead'),

-- Node 18: SAM Claude Generate Outreach
('sam_outreach_generation', 'SAM Claude Generate Outreach', 'unit',
 '{"owner_name": "John Smith", "property_address": "123 Main St", "excess_amount": 50000, "cause_number": "2024-TX-12345", "county": "Dallas", "expiry_date": "2025-06-15", "priority_score": 85, "priority_tier": "A+"}',
 '{"type": "object", "required": ["sms_script", "email_subject", "email_body", "voice_script"]}',
 '[{"rule": "required_fields", "fields": ["sms_script", "email_subject", "email_body", "voice_script"]}]',
 'blocker', 'Tests Claude outreach generation output structure'),

-- Node 19: Parse SAM Response - SMS Length
('parse_sam_sms_length', 'Parse SAM Response', 'unit',
 '{"sms_script": "Hi John, you have $50,000 in unclaimed funds from Dallas County case 2024-TX-12345. This money belongs to you. Act now before the deadline."}',
 '{"type": "object", "properties": {"sms_script": {"type": "string", "maxLength": 160}}}',
 '[{"rule": "max_length", "field": "sms_script", "max": 160}]',
 'blocker', 'Validates SMS is truncated to 160 characters'),

-- Node 26: SAM Classify Response
('sam_classify_interested', 'SAM Classify Response', 'unit',
 '{"From": "+12145551234", "Body": "Yes I am interested in learning more"}',
 '{"type": "object", "required": ["classification", "confidence"]}',
 '[{"rule": "classification_valid", "allowed": ["INTERESTED", "NOT_INTERESTED", "SKEPTICAL", "CONFUSED", "APPOINTMENT", "WRONG_NUMBER", "DO_NOT_CONTACT", "OTHER"]}, {"rule": "confidence_range", "min": 0, "max": 100}]',
 'blocker', 'Tests response classification with interested reply')

ON CONFLICT (fixture_name) DO NOTHING;

-- ============================================================
-- COMPLETION
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '✅ MaxSam CI/CD Extension Schema Created';
    RAISE NOTICE '📊 Tables: workflow_versions, deploy_logs, test_fixtures, test_runs';
    RAISE NOTICE '👁️ Views: v_latest_workflow_versions, v_deployable_candidates, v_recent_test_failures, v_deployment_history';
    RAISE NOTICE '⚙️ Functions: register_workflow_version(), start_test_run(), complete_test_run(), deploy_workflow_version()';
    RAISE NOTICE '🧪 Test Fixtures: 6 pre-seeded fixtures for critical nodes';
END $$;
