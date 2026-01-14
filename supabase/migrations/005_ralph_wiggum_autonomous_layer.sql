-- ============================================================
-- MAXSAM V4 - RALPH WIGGUM AUTONOMOUS EXECUTION LAYER
-- Phase 5 & 6: Agent Task Management, Controls, and Reliability
-- ============================================================
-- This migration creates the infrastructure for autonomous task execution
-- Run AFTER the main schema (001_complete_schema.sql)
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: system_controls
-- Global controls for Ralph autonomous execution
-- ============================================================
CREATE TABLE IF NOT EXISTS system_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Control key-value pairs
    control_key TEXT NOT NULL UNIQUE,
    control_value JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Control metadata
    description TEXT,
    control_type TEXT NOT NULL DEFAULT 'boolean'
        CHECK (control_type IN ('boolean', 'number', 'string', 'json')),

    -- Audit fields
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default control values
INSERT INTO system_controls (control_key, control_value, description, control_type) VALUES
    -- Master kill switch
    ('ralph_enabled', 'false'::jsonb, 'Master enable/disable for Ralph autonomous execution', 'boolean'),

    -- Autonomy levels: 0=stopped, 1=read-only, 2=safe-changes, 3=full-auto
    ('autonomy_level', '1'::jsonb, 'Autonomy level (0=stopped, 1=read-only, 2=safe-changes, 3=full-auto)', 'number'),

    -- Budget limits
    ('max_tasks_per_day', '50'::jsonb, 'Maximum tasks Ralph can execute per day', 'number'),
    ('max_loc_per_day', '2000'::jsonb, 'Maximum lines of code Ralph can modify per day', 'number'),
    ('max_files_per_task', '20'::jsonb, 'Maximum files Ralph can modify per single task', 'number'),
    ('max_loc_per_task', '500'::jsonb, 'Maximum lines of code Ralph can modify per task', 'number'),

    -- Safety controls
    ('require_approval_above_autonomy', '2'::jsonb, 'Require manual approval for tasks above this autonomy level', 'number'),
    ('blocked_file_patterns', '["*.env", "*.key", "*.pem", "*.credentials"]'::jsonb, 'File patterns Ralph cannot modify', 'json'),
    ('blocked_directories', '["node_modules", ".git", "secrets"]'::jsonb, 'Directories Ralph cannot touch', 'json'),

    -- Operational limits
    ('task_timeout_seconds', '600'::jsonb, 'Maximum seconds per task execution', 'number'),
    ('lease_ttl_seconds', '300'::jsonb, 'Default lease TTL for tasks', 'number'),
    ('max_retries', '3'::jsonb, 'Maximum retries per failed task', 'number'),
    ('backoff_base_seconds', '60'::jsonb, 'Base delay for exponential backoff', 'number')

ON CONFLICT (control_key) DO NOTHING;

-- Index for fast control lookups
CREATE INDEX IF NOT EXISTS idx_system_controls_key ON system_controls(control_key);

-- ============================================================
-- TABLE: agent_tasks
-- Queue of tasks for Ralph to execute
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Task identification
    task_key TEXT NOT NULL,                           -- Unique identifier for the task type
    task_name TEXT NOT NULL,                          -- Human-readable name

    -- Task specification
    spec JSONB NOT NULL,                              -- Full task specification
    -- spec structure:
    -- {
    --   "description": "...",
    --   "files_to_create": [{"path": "...", "content": "..."}],
    --   "files_to_modify": [{"path": "...", "changes": [...]}],
    --   "files_to_delete": ["..."],
    --   "commands_to_run": ["npm test", "npm run build"],
    --   "expected_outcomes": ["tests pass", "build succeeds"],
    --   "rollback_instructions": "..."
    -- }

    -- Task metadata
    source TEXT DEFAULT 'manual',                     -- manual, drift_detection, ci_failure, scheduled
    priority INTEGER DEFAULT 50                       -- 0-100, higher = more urgent
        CHECK (priority >= 0 AND priority <= 100),
    required_autonomy_level INTEGER DEFAULT 2         -- Minimum autonomy level required
        CHECK (required_autonomy_level >= 0 AND required_autonomy_level <= 3),

    -- Execution status
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN (
            'queued',           -- Waiting to be picked up
            'leased',           -- Worker has taken the task
            'running',          -- Actively executing
            'awaiting_approval',-- Requires manual approval
            'approved',         -- Approved, ready to resume
            'completed',        -- Successfully finished
            'failed',           -- Failed after all retries
            'cancelled',        -- Manually cancelled
            'blocked'           -- Blocked by policy or dependency
        )),

    -- Lease management
    leased_by TEXT,                                   -- Worker ID that holds the lease
    leased_at TIMESTAMPTZ,                            -- When the lease was acquired
    lease_expires_at TIMESTAMPTZ,                     -- When the lease expires

    -- Retry/backoff fields (Phase 6)
    attempt_count INTEGER DEFAULT 0,                  -- Current attempt number
    max_attempts INTEGER DEFAULT 3,                   -- Max allowed attempts
    last_error TEXT,                                  -- Last error message
    next_retry_at TIMESTAMPTZ,                        -- When to retry (for backoff)
    backoff_multiplier DECIMAL(4,2) DEFAULT 2.0,      -- Exponential backoff multiplier

    -- Result tracking
    result JSONB,                                     -- Execution result
    -- result structure:
    -- {
    --   "branch": "ralph/task-123-fix-bug",
    --   "commit_sha": "abc123",
    --   "tests_passed": true,
    --   "summary": "Fixed the bug by...",
    --   "files_changed": ["src/foo.ts", "src/bar.ts"],
    --   "loc_added": 45,
    --   "loc_removed": 12,
    --   "loc_changed": 57,
    --   "artifacts": {"log": "/logs/task-123.log", "pr_url": "..."}
    -- }

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Approval tracking
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,

    -- Budget tracking
    estimated_loc INTEGER,                            -- Estimated LOC change
    actual_loc INTEGER                                -- Actual LOC changed
);

-- Indexes for task queue operations
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON agent_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_leased_by ON agent_tasks(leased_by) WHERE leased_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_lease_expires ON agent_tasks(lease_expires_at) WHERE status = 'leased';
CREATE INDEX IF NOT EXISTS idx_agent_tasks_next_retry ON agent_tasks(next_retry_at) WHERE status = 'queued' AND next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_tasks_queue ON agent_tasks(status, priority DESC, created_at)
    WHERE status IN ('queued', 'approved');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_agent_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agent_tasks_updated_at_trigger ON agent_tasks;
CREATE TRIGGER update_agent_tasks_updated_at_trigger
    BEFORE UPDATE ON agent_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_tasks_updated_at();

-- ============================================================
-- TABLE: agent_task_events
-- Append-only audit log of all task events
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_task_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Event reference
    task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,

    -- Event details
    event_type TEXT NOT NULL
        CHECK (event_type IN (
            'created',          -- Task was created
            'queued',           -- Task entered queue
            'leased',           -- Worker acquired lease
            'lease_renewed',    -- Lease was renewed
            'lease_expired',    -- Lease expired without completion
            'started',          -- Execution started
            'progress',         -- Progress update
            'approval_required',-- Task needs approval
            'approved',         -- Task was approved
            'rejected',         -- Task was rejected
            'completed',        -- Task completed successfully
            'failed',           -- Task failed
            'retrying',         -- Scheduling retry
            'cancelled',        -- Task was cancelled
            'blocked',          -- Task blocked by policy
            'budget_exceeded',  -- Budget limit hit
            'policy_violation'  -- Policy check failed
        )),

    -- Event context
    event_data JSONB DEFAULT '{}'::jsonb,             -- Event-specific data
    worker_id TEXT,                                    -- Which worker triggered this

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT                                    -- User or system that triggered
);

-- Indexes for event queries
CREATE INDEX IF NOT EXISTS idx_agent_task_events_task_id ON agent_task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_events_type ON agent_task_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_task_events_created_at ON agent_task_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_task_events_worker ON agent_task_events(worker_id) WHERE worker_id IS NOT NULL;

-- ============================================================
-- TABLE: agent_budget_tracking
-- Daily budget consumption tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_budget_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Date tracking (one row per day)
    tracking_date DATE NOT NULL DEFAULT CURRENT_DATE UNIQUE,

    -- Task counts
    tasks_executed INTEGER DEFAULT 0,
    tasks_succeeded INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,

    -- LOC tracking
    loc_added INTEGER DEFAULT 0,
    loc_removed INTEGER DEFAULT 0,
    loc_total_changed INTEGER DEFAULT 0,

    -- File tracking
    files_created INTEGER DEFAULT 0,
    files_modified INTEGER DEFAULT 0,
    files_deleted INTEGER DEFAULT 0,

    -- Budget status
    budget_exhausted BOOLEAN DEFAULT FALSE,
    budget_exhausted_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_budget_tracking_date ON agent_budget_tracking(tracking_date DESC);

-- ============================================================
-- FUNCTION: lease_next_task
-- Atomically lease the next available task using row locking
-- ============================================================
CREATE OR REPLACE FUNCTION lease_next_task(
    p_worker_id TEXT,
    p_ttl_seconds INTEGER DEFAULT 300
)
RETURNS TABLE(
    task_id UUID,
    task_key TEXT,
    task_name TEXT,
    spec JSONB,
    priority INTEGER,
    required_autonomy_level INTEGER,
    attempt_count INTEGER
) AS $$
DECLARE
    v_task_id UUID;
    v_ralph_enabled BOOLEAN;
    v_autonomy_level INTEGER;
    v_max_tasks INTEGER;
    v_tasks_today INTEGER;
BEGIN
    -- Check if Ralph is enabled
    SELECT (control_value)::boolean INTO v_ralph_enabled
    FROM system_controls WHERE control_key = 'ralph_enabled';

    IF NOT COALESCE(v_ralph_enabled, false) THEN
        RAISE NOTICE 'Ralph is disabled - no tasks will be leased';
        RETURN;
    END IF;

    -- Get current autonomy level
    SELECT (control_value)::integer INTO v_autonomy_level
    FROM system_controls WHERE control_key = 'autonomy_level';

    IF COALESCE(v_autonomy_level, 0) = 0 THEN
        RAISE NOTICE 'Autonomy level is 0 (stopped) - no tasks will be leased';
        RETURN;
    END IF;

    -- Check daily task budget
    SELECT (control_value)::integer INTO v_max_tasks
    FROM system_controls WHERE control_key = 'max_tasks_per_day';

    SELECT COALESCE(tasks_executed, 0) INTO v_tasks_today
    FROM agent_budget_tracking WHERE tracking_date = CURRENT_DATE;

    IF COALESCE(v_tasks_today, 0) >= COALESCE(v_max_tasks, 50) THEN
        RAISE NOTICE 'Daily task budget exhausted (% of % tasks)', v_tasks_today, v_max_tasks;
        RETURN;
    END IF;

    -- Atomically select and lock the next task
    -- Uses FOR UPDATE SKIP LOCKED to handle concurrent workers
    SELECT at.id INTO v_task_id
    FROM agent_tasks at
    WHERE at.status IN ('queued', 'approved')
      AND at.required_autonomy_level <= COALESCE(v_autonomy_level, 1)
      AND (at.next_retry_at IS NULL OR at.next_retry_at <= NOW())
      AND (at.lease_expires_at IS NULL OR at.lease_expires_at < NOW())
    ORDER BY
        -- Approved tasks first (resuming after approval)
        CASE WHEN at.status = 'approved' THEN 0 ELSE 1 END,
        at.priority DESC,
        at.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_task_id IS NULL THEN
        RAISE NOTICE 'No available tasks found';
        RETURN;
    END IF;

    -- Update the task with lease info
    UPDATE agent_tasks
    SET
        status = 'leased',
        leased_by = p_worker_id,
        leased_at = NOW(),
        lease_expires_at = NOW() + (p_ttl_seconds || ' seconds')::interval,
        attempt_count = attempt_count + 1,
        updated_at = NOW()
    WHERE id = v_task_id;

    -- Log the lease event
    INSERT INTO agent_task_events (task_id, event_type, worker_id, event_data)
    VALUES (
        v_task_id,
        'leased',
        p_worker_id,
        jsonb_build_object(
            'ttl_seconds', p_ttl_seconds,
            'attempt_number', (SELECT attempt_count FROM agent_tasks WHERE id = v_task_id)
        )
    );

    -- Return the leased task
    RETURN QUERY
    SELECT
        at.id,
        at.task_key,
        at.task_name,
        at.spec,
        at.priority,
        at.required_autonomy_level,
        at.attempt_count
    FROM agent_tasks at
    WHERE at.id = v_task_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: complete_task
-- Mark a task as completed and update budget tracking
-- ============================================================
CREATE OR REPLACE FUNCTION complete_task(
    p_task_id UUID,
    p_worker_id TEXT,
    p_result JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_loc_changed INTEGER;
BEGIN
    -- Verify the worker holds the lease
    IF NOT EXISTS (
        SELECT 1 FROM agent_tasks
        WHERE id = p_task_id
          AND leased_by = p_worker_id
          AND status IN ('leased', 'running')
    ) THEN
        RAISE EXCEPTION 'Worker % does not hold lease for task %', p_worker_id, p_task_id;
    END IF;

    -- Calculate LOC changed
    v_loc_changed := COALESCE((p_result->>'loc_changed')::integer, 0);

    -- Update task status
    UPDATE agent_tasks
    SET
        status = 'completed',
        result = p_result,
        completed_at = NOW(),
        actual_loc = v_loc_changed
    WHERE id = p_task_id;

    -- Log completion event
    INSERT INTO agent_task_events (task_id, event_type, worker_id, event_data)
    VALUES (p_task_id, 'completed', p_worker_id, p_result);

    -- Update budget tracking
    INSERT INTO agent_budget_tracking (tracking_date, tasks_executed, tasks_succeeded, loc_total_changed)
    VALUES (CURRENT_DATE, 1, 1, v_loc_changed)
    ON CONFLICT (tracking_date) DO UPDATE SET
        tasks_executed = agent_budget_tracking.tasks_executed + 1,
        tasks_succeeded = agent_budget_tracking.tasks_succeeded + 1,
        loc_total_changed = agent_budget_tracking.loc_total_changed + v_loc_changed,
        updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: fail_task
-- Mark a task as failed and schedule retry if applicable
-- ============================================================
CREATE OR REPLACE FUNCTION fail_task(
    p_task_id UUID,
    p_worker_id TEXT,
    p_error TEXT,
    p_should_retry BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    will_retry BOOLEAN,
    next_attempt_at TIMESTAMPTZ,
    attempts_remaining INTEGER
) AS $$
DECLARE
    v_task RECORD;
    v_max_retries INTEGER;
    v_backoff_base INTEGER;
    v_next_retry TIMESTAMPTZ;
    v_will_retry BOOLEAN;
BEGIN
    -- Get task and control settings
    SELECT * INTO v_task FROM agent_tasks WHERE id = p_task_id;

    SELECT (control_value)::integer INTO v_max_retries
    FROM system_controls WHERE control_key = 'max_retries';

    SELECT (control_value)::integer INTO v_backoff_base
    FROM system_controls WHERE control_key = 'backoff_base_seconds';

    v_max_retries := COALESCE(v_max_retries, 3);
    v_backoff_base := COALESCE(v_backoff_base, 60);

    -- Determine if we should retry
    v_will_retry := p_should_retry AND v_task.attempt_count < v_task.max_attempts;

    IF v_will_retry THEN
        -- Calculate exponential backoff
        v_next_retry := NOW() + (
            (v_backoff_base * POWER(v_task.backoff_multiplier, v_task.attempt_count - 1)) || ' seconds'
        )::interval;

        -- Queue for retry
        UPDATE agent_tasks
        SET
            status = 'queued',
            last_error = p_error,
            next_retry_at = v_next_retry,
            leased_by = NULL,
            leased_at = NULL,
            lease_expires_at = NULL
        WHERE id = p_task_id;

        -- Log retry event
        INSERT INTO agent_task_events (task_id, event_type, worker_id, event_data)
        VALUES (p_task_id, 'retrying', p_worker_id, jsonb_build_object(
            'error', p_error,
            'attempt', v_task.attempt_count,
            'next_retry_at', v_next_retry
        ));
    ELSE
        -- Mark as permanently failed
        UPDATE agent_tasks
        SET
            status = 'failed',
            last_error = p_error,
            completed_at = NOW(),
            leased_by = NULL,
            leased_at = NULL,
            lease_expires_at = NULL
        WHERE id = p_task_id;

        -- Log failure event
        INSERT INTO agent_task_events (task_id, event_type, worker_id, event_data)
        VALUES (p_task_id, 'failed', p_worker_id, jsonb_build_object(
            'error', p_error,
            'final_attempt', v_task.attempt_count
        ));

        -- Update budget tracking
        INSERT INTO agent_budget_tracking (tracking_date, tasks_executed, tasks_failed)
        VALUES (CURRENT_DATE, 1, 1)
        ON CONFLICT (tracking_date) DO UPDATE SET
            tasks_executed = agent_budget_tracking.tasks_executed + 1,
            tasks_failed = agent_budget_tracking.tasks_failed + 1,
            updated_at = NOW();
    END IF;

    RETURN QUERY SELECT
        v_will_retry,
        v_next_retry,
        (v_task.max_attempts - v_task.attempt_count)::integer;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: request_approval
-- Move task to awaiting_approval status
-- ============================================================
CREATE OR REPLACE FUNCTION request_approval(
    p_task_id UUID,
    p_worker_id TEXT,
    p_reason TEXT DEFAULT 'Task requires manual approval'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agent_tasks
    SET
        status = 'awaiting_approval',
        requires_approval = TRUE
    WHERE id = p_task_id
      AND leased_by = p_worker_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Log approval request event
    INSERT INTO agent_task_events (task_id, event_type, worker_id, event_data)
    VALUES (p_task_id, 'approval_required', p_worker_id, jsonb_build_object('reason', p_reason));

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: approve_task
-- Approve a task pending approval
-- ============================================================
CREATE OR REPLACE FUNCTION approve_task(
    p_task_id UUID,
    p_approved_by TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agent_tasks
    SET
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = NOW(),
        approval_notes = p_notes,
        leased_by = NULL,
        leased_at = NULL,
        lease_expires_at = NULL
    WHERE id = p_task_id
      AND status = 'awaiting_approval';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Log approval event
    INSERT INTO agent_task_events (task_id, event_type, created_by, event_data)
    VALUES (p_task_id, 'approved', p_approved_by, jsonb_build_object('notes', p_notes));

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: check_budget_limits
-- Check if a task would exceed budget limits
-- ============================================================
CREATE OR REPLACE FUNCTION check_budget_limits(
    p_estimated_loc INTEGER DEFAULT 0
)
RETURNS TABLE(
    can_proceed BOOLEAN,
    reason TEXT,
    tasks_remaining INTEGER,
    loc_remaining INTEGER
) AS $$
DECLARE
    v_max_tasks INTEGER;
    v_max_loc INTEGER;
    v_tasks_today INTEGER;
    v_loc_today INTEGER;
BEGIN
    -- Get limits
    SELECT (control_value)::integer INTO v_max_tasks
    FROM system_controls WHERE control_key = 'max_tasks_per_day';

    SELECT (control_value)::integer INTO v_max_loc
    FROM system_controls WHERE control_key = 'max_loc_per_day';

    -- Get current usage
    SELECT COALESCE(tasks_executed, 0), COALESCE(loc_total_changed, 0)
    INTO v_tasks_today, v_loc_today
    FROM agent_budget_tracking WHERE tracking_date = CURRENT_DATE;

    v_max_tasks := COALESCE(v_max_tasks, 50);
    v_max_loc := COALESCE(v_max_loc, 2000);
    v_tasks_today := COALESCE(v_tasks_today, 0);
    v_loc_today := COALESCE(v_loc_today, 0);

    -- Check limits
    IF v_tasks_today >= v_max_tasks THEN
        RETURN QUERY SELECT
            FALSE,
            'Daily task limit reached'::text,
            0,
            (v_max_loc - v_loc_today)::integer;
    ELSIF (v_loc_today + p_estimated_loc) > v_max_loc THEN
        RETURN QUERY SELECT
            FALSE,
            'Would exceed daily LOC limit'::text,
            (v_max_tasks - v_tasks_today)::integer,
            (v_max_loc - v_loc_today)::integer;
    ELSE
        RETURN QUERY SELECT
            TRUE,
            'Within budget'::text,
            (v_max_tasks - v_tasks_today)::integer,
            (v_max_loc - v_loc_today)::integer;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: expire_stale_leases
-- Clean up expired leases (run periodically)
-- ============================================================
CREATE OR REPLACE FUNCTION expire_stale_leases()
RETURNS INTEGER AS $$
DECLARE
    v_expired_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE agent_tasks
        SET
            status = 'queued',
            leased_by = NULL,
            leased_at = NULL,
            lease_expires_at = NULL
        WHERE status = 'leased'
          AND lease_expires_at < NOW()
        RETURNING id, leased_by
    )
    SELECT COUNT(*) INTO v_expired_count FROM expired;

    -- Log expiration events
    INSERT INTO agent_task_events (task_id, event_type, event_data)
    SELECT
        id,
        'lease_expired',
        jsonb_build_object('previous_worker', leased_by)
    FROM agent_tasks
    WHERE status = 'queued'
      AND updated_at >= NOW() - INTERVAL '1 minute';

    RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: create_task
-- Helper function to create a new task
-- ============================================================
CREATE OR REPLACE FUNCTION create_task(
    p_task_key TEXT,
    p_task_name TEXT,
    p_spec JSONB,
    p_priority INTEGER DEFAULT 50,
    p_required_autonomy_level INTEGER DEFAULT 2,
    p_source TEXT DEFAULT 'manual',
    p_estimated_loc INTEGER DEFAULT NULL,
    p_created_by TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_task_id UUID;
BEGIN
    INSERT INTO agent_tasks (
        task_key,
        task_name,
        spec,
        priority,
        required_autonomy_level,
        source,
        estimated_loc
    )
    VALUES (
        p_task_key,
        p_task_name,
        p_spec,
        p_priority,
        p_required_autonomy_level,
        p_source,
        p_estimated_loc
    )
    RETURNING id INTO v_task_id;

    -- Log creation event
    INSERT INTO agent_task_events (task_id, event_type, created_by, event_data)
    VALUES (v_task_id, 'created', p_created_by, jsonb_build_object(
        'task_key', p_task_key,
        'source', p_source,
        'priority', p_priority
    ));

    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS
-- ============================================================

-- View: Current task queue
CREATE OR REPLACE VIEW v_agent_task_queue AS
SELECT
    id,
    task_key,
    task_name,
    status,
    priority,
    required_autonomy_level,
    source,
    attempt_count,
    max_attempts,
    next_retry_at,
    created_at,
    CASE
        WHEN status = 'queued' AND next_retry_at > NOW() THEN 'waiting_for_retry'
        WHEN status = 'queued' THEN 'ready'
        WHEN status = 'approved' THEN 'ready_after_approval'
        ELSE status
    END as queue_status
FROM agent_tasks
WHERE status IN ('queued', 'approved', 'leased', 'running', 'awaiting_approval')
ORDER BY
    CASE status WHEN 'approved' THEN 0 WHEN 'running' THEN 1 WHEN 'leased' THEN 2 ELSE 3 END,
    priority DESC,
    created_at ASC;

-- View: Daily budget status
CREATE OR REPLACE VIEW v_agent_budget_status AS
SELECT
    CURRENT_DATE as date,
    COALESCE(bt.tasks_executed, 0) as tasks_executed,
    (SELECT (control_value)::integer FROM system_controls WHERE control_key = 'max_tasks_per_day') as max_tasks,
    COALESCE(bt.loc_total_changed, 0) as loc_changed,
    (SELECT (control_value)::integer FROM system_controls WHERE control_key = 'max_loc_per_day') as max_loc,
    COALESCE(bt.tasks_succeeded, 0) as succeeded,
    COALESCE(bt.tasks_failed, 0) as failed,
    bt.budget_exhausted,
    (SELECT (control_value)::boolean FROM system_controls WHERE control_key = 'ralph_enabled') as ralph_enabled,
    (SELECT (control_value)::integer FROM system_controls WHERE control_key = 'autonomy_level') as autonomy_level
FROM (SELECT 1) dummy
LEFT JOIN agent_budget_tracking bt ON bt.tracking_date = CURRENT_DATE;

-- View: Recent task events
CREATE OR REPLACE VIEW v_recent_task_events AS
SELECT
    e.id,
    e.task_id,
    t.task_key,
    t.task_name,
    e.event_type,
    e.worker_id,
    e.event_data,
    e.created_at,
    e.created_by
FROM agent_task_events e
JOIN agent_tasks t ON t.id = e.task_id
WHERE e.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY e.created_at DESC;

-- View: System controls summary
CREATE OR REPLACE VIEW v_system_controls_summary AS
SELECT
    (SELECT control_value::boolean FROM system_controls WHERE control_key = 'ralph_enabled') as ralph_enabled,
    (SELECT control_value::integer FROM system_controls WHERE control_key = 'autonomy_level') as autonomy_level,
    (SELECT control_value::integer FROM system_controls WHERE control_key = 'max_tasks_per_day') as max_tasks_per_day,
    (SELECT control_value::integer FROM system_controls WHERE control_key = 'max_loc_per_day') as max_loc_per_day,
    (SELECT control_value::integer FROM system_controls WHERE control_key = 'max_retries') as max_retries,
    (SELECT control_value::integer FROM system_controls WHERE control_key = 'task_timeout_seconds') as task_timeout_seconds,
    (SELECT control_value FROM system_controls WHERE control_key = 'blocked_file_patterns') as blocked_file_patterns,
    (SELECT control_value FROM system_controls WHERE control_key = 'blocked_directories') as blocked_directories;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_tracking ENABLE ROW LEVEL SECURITY;

-- Allow authenticated access
DROP POLICY IF EXISTS "Allow authenticated access to agent_tasks" ON agent_tasks;
CREATE POLICY "Allow authenticated access to agent_tasks" ON agent_tasks
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to agent_task_events" ON agent_task_events;
CREATE POLICY "Allow authenticated access to agent_task_events" ON agent_task_events
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to system_controls" ON system_controls;
CREATE POLICY "Allow authenticated access to system_controls" ON system_controls
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to agent_budget_tracking" ON agent_budget_tracking;
CREATE POLICY "Allow authenticated access to agent_budget_tracking" ON agent_budget_tracking
    FOR ALL TO authenticated USING (true);

-- ============================================================
-- GRANTS
-- ============================================================

GRANT ALL ON agent_tasks TO service_role;
GRANT ALL ON agent_task_events TO service_role;
GRANT ALL ON system_controls TO service_role;
GRANT ALL ON agent_budget_tracking TO service_role;

GRANT SELECT ON v_agent_task_queue TO authenticated;
GRANT SELECT ON v_agent_budget_status TO authenticated;
GRANT SELECT ON v_recent_task_events TO authenticated;
GRANT SELECT ON v_system_controls_summary TO authenticated;

-- ============================================================
-- COMPLETION
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Ralph Wiggum Autonomous Execution Layer - Phase 5 & 6';
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Tables: system_controls, agent_tasks, agent_task_events, agent_budget_tracking';
    RAISE NOTICE 'Functions: lease_next_task(), complete_task(), fail_task(), request_approval()';
    RAISE NOTICE 'Functions: approve_task(), check_budget_limits(), expire_stale_leases(), create_task()';
    RAISE NOTICE 'Views: v_agent_task_queue, v_agent_budget_status, v_recent_task_events, v_system_controls_summary';
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Ralph is DISABLED by default. Enable with:';
    RAISE NOTICE 'UPDATE system_controls SET control_value = ''true'' WHERE control_key = ''ralph_enabled'';';
    RAISE NOTICE '========================================================';
END $$;
