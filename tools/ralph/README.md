# Ralph Wiggum Autonomous Execution Layer

## Overview

Ralph Wiggum is the autonomous task execution layer for MaxSam V4. It provides:

- **Autonomous Task Execution**: Executes development tasks in isolated branches
- **Safety Controls**: Budget limits, policy enforcement, and approval gating
- **Reliability Features**: Retry/backoff, lease management, and drift detection
- **Full Audit Trail**: Append-only event logging for all task operations

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Ralph Wiggum System                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────┐│
│  │   n8n       │───▶│  Supabase    │◀───│   Ralph Runner              ││
│  │  Workflow   │    │  PostgreSQL  │    │   (run_task.ts)             ││
│  │             │    │              │    │                             ││
│  │ • Trigger   │    │ • agent_tasks│    │ • Create branch             ││
│  │ • Policy    │    │ • events log │    │ • Apply changes             ││
│  │ • Approval  │    │ • controls   │    │ • Run commands              ││
│  │ • Execute   │    │ • budget     │    │ • Commit results            ││
│  └─────────────┘    └──────────────┘    └─────────────────────────────┘│
│         │                  ▲                        │                   │
│         │                  │                        │                   │
│         ▼                  │                        ▼                   │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────┐│
│  │  Telegram   │    │    Alex      │    │   Drift Detection           ││
│  │  Approval   │    │    Gate      │    │   (detect_drift.ts)         ││
│  │             │    │              │    │                             ││
│  │ • Notify    │    │ • Policy     │    │ • Compare workflows         ││
│  │ • Approve   │    │ • Blocked    │    │ • Check migrations          ││
│  │ • Reject    │    │ • Autonomy   │    │ • Create tasks              ││
│  └─────────────┘    └──────────────┘    └─────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Database Schema (`supabase/migrations/005_ralph_wiggum_autonomous_layer.sql`)

**Tables:**
- `system_controls` - Global configuration (ralph_enabled, autonomy_level, budgets)
- `agent_tasks` - Task queue with status, priority, and lease management
- `agent_task_events` - Append-only audit log of all events
- `agent_budget_tracking` - Daily budget consumption tracking

**Functions:**
- `lease_next_task(worker_id, ttl_seconds)` - Atomically lease next available task
- `complete_task(task_id, worker_id, result)` - Mark task completed
- `fail_task(task_id, worker_id, error, should_retry)` - Handle task failure
- `request_approval(task_id, worker_id, reason)` - Request manual approval
- `approve_task(task_id, approved_by, notes)` - Approve pending task
- `check_budget_limits(estimated_loc)` - Check if budget allows execution
- `expire_stale_leases()` - Clean up expired leases
- `create_task(...)` - Create new task in queue

### 2. Ralph Runner (`tools/ralph/run_task.ts`)

TypeScript script that executes tasks in isolated branches:

```bash
# Execute task from file
npx ts-node tools/ralph/run_task.ts --file task.json

# Execute task from stdin
echo '{"task_id": "...", ...}' | npx ts-node tools/ralph/run_task.ts
```

**Features:**
- Creates isolated git branch per task
- Applies file changes (create, modify, delete)
- Runs specified commands
- Commits results with task metadata
- Outputs structured result.json

**Safety:**
- Blocks sensitive file patterns (`.env`, `.key`, `.pem`)
- Blocks protected directories (`node_modules`, `.git`, `secrets`)
- Enforces max file size limits

### 3. n8n Workflow (`n8n/workflows/ralph_executor.json`)

Orchestration workflow that:
1. Checks if Ralph is enabled
2. Validates budget and autonomy level
3. Leases next available task
4. Validates task schema
5. Enforces Alex Gate policies
6. Routes to approval if needed
7. Executes Ralph runner
8. Updates task status
9. Handles retry/backoff on failure
10. Sends Telegram notifications

### 4. Drift Detection (`tools/ralph/detect_drift.ts`)

Nightly script to detect configuration drift:

```bash
# Dry run (no changes)
npx ts-node tools/ralph/detect_drift.ts --dry-run

# Live run (creates remediation tasks)
npx ts-node tools/ralph/detect_drift.ts
```

**Checks:**
- n8n workflow files vs deployed workflows
- Supabase migrations applied vs expected

## Configuration

### System Controls

| Key | Default | Description |
|-----|---------|-------------|
| `ralph_enabled` | `false` | Master enable/disable switch |
| `autonomy_level` | `1` | 0=stopped, 1=read-only, 2=safe-changes, 3=full-auto |
| `max_tasks_per_day` | `50` | Daily task execution limit |
| `max_loc_per_day` | `2000` | Daily lines of code limit |
| `max_files_per_task` | `20` | Max files per single task |
| `max_loc_per_task` | `500` | Max LOC per single task |
| `max_retries` | `3` | Max retry attempts on failure |
| `backoff_base_seconds` | `60` | Base delay for exponential backoff |
| `task_timeout_seconds` | `600` | Max execution time per task |
| `blocked_file_patterns` | `["*.env", ...]` | Files Ralph cannot modify |
| `blocked_directories` | `["node_modules", ...]` | Directories Ralph cannot touch |

### Autonomy Levels

| Level | Name | Capabilities |
|-------|------|--------------|
| 0 | Stopped | No task execution |
| 1 | Read-Only | Can read files, no modifications |
| 2 | Safe Changes | Can modify non-critical files |
| 3 | Full Auto | Full autonomous execution |

---

## How to Run

### 1. Apply Database Migration

```bash
# Using Supabase CLI
supabase db push

# Or manually in SQL Editor
cat supabase/migrations/005_ralph_wiggum_autonomous_layer.sql | \
  psql "$SUPABASE_DB_URL"
```

### 2. Enable Ralph

```sql
-- Enable Ralph (CAREFUL - this activates autonomous execution!)
UPDATE system_controls
SET control_value = 'true'
WHERE control_key = 'ralph_enabled';

-- Set autonomy level (start conservative)
UPDATE system_controls
SET control_value = '2'
WHERE control_key = 'autonomy_level';
```

### 3. Import n8n Workflow

1. Open n8n dashboard
2. Import `n8n/workflows/ralph_executor.json`
3. Configure credentials:
   - Supabase PostgreSQL connection
   - Telegram Bot API
4. Update paths in "Execute Ralph Runner" node
5. Activate workflow

### 4. Run Drift Detection (Nightly)

```bash
# Add to crontab for nightly runs
0 3 * * * cd /path/to/maxsam-v4-clean && npx ts-node tools/ralph/detect_drift.ts
```

---

## Test Plan

### Test 1: Database Migration

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('system_controls', 'agent_tasks', 'agent_task_events', 'agent_budget_tracking');

-- Verify functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('lease_next_task', 'complete_task', 'fail_task', 'create_task');

-- Verify views exist
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE 'v_agent%';
```

### Test 2: Create Sample Task

```sql
-- Insert a test task
SELECT create_task(
  'test-task-001',
  'Test Task - Hello World',
  '{
    "description": "Create a test file to verify Ralph execution",
    "files_to_create": [
      {
        "path": "test-output/hello.txt",
        "content": "Hello from Ralph!"
      }
    ],
    "commands_to_run": ["echo \"Task executed successfully\""]
  }'::jsonb,
  50,  -- priority
  2,   -- required_autonomy_level
  'manual',
  10   -- estimated_loc
);

-- Verify task was created
SELECT * FROM v_agent_task_queue WHERE task_key = 'test-task-001';
```

### Test 3: Lease Task (Manual)

```sql
-- Simulate worker leasing a task
SELECT * FROM lease_next_task('test-worker-001', 300);

-- Verify lease was acquired
SELECT id, task_name, status, leased_by, lease_expires_at
FROM agent_tasks
WHERE task_key = 'test-task-001';

-- Check event log
SELECT * FROM agent_task_events
WHERE task_id = (SELECT id FROM agent_tasks WHERE task_key = 'test-task-001')
ORDER BY created_at DESC;
```

### Test 4: Complete Task (Manual)

```sql
-- Mark task as completed
SELECT complete_task(
  (SELECT id FROM agent_tasks WHERE task_key = 'test-task-001'),
  'test-worker-001',
  '{
    "success": true,
    "branch": "ralph/test-task-001-abc123",
    "commit_sha": "abc123def456",
    "tests_passed": true,
    "summary": "Test task completed successfully",
    "files_changed": ["test-output/hello.txt"],
    "loc_added": 1,
    "loc_removed": 0,
    "loc_changed": 1
  }'::jsonb
);

-- Verify completion
SELECT * FROM agent_tasks WHERE task_key = 'test-task-001';

-- Check budget tracking
SELECT * FROM v_agent_budget_status;
```

### Test 5: Retry Behavior

```sql
-- Create a task that will fail
SELECT create_task(
  'test-fail-task',
  'Test Failing Task',
  '{"description": "This task will fail for testing"}'::jsonb,
  50, 2, 'manual', 10
);

-- Lease it
SELECT * FROM lease_next_task('test-worker-002', 60);

-- Fail it (should trigger retry)
SELECT * FROM fail_task(
  (SELECT id FROM agent_tasks WHERE task_key = 'test-fail-task'),
  'test-worker-002',
  'Simulated failure for testing',
  true  -- should_retry = true
);

-- Verify retry was scheduled
SELECT id, status, attempt_count, next_retry_at, last_error
FROM agent_tasks
WHERE task_key = 'test-fail-task';
```

### Test 6: Budget Limits

```sql
-- Check current budget status
SELECT * FROM check_budget_limits(0);

-- Temporarily set low limits for testing
UPDATE system_controls SET control_value = '2' WHERE control_key = 'max_tasks_per_day';

-- Insert budget tracking to simulate exhaustion
INSERT INTO agent_budget_tracking (tracking_date, tasks_executed)
VALUES (CURRENT_DATE, 2)
ON CONFLICT (tracking_date) DO UPDATE SET tasks_executed = 2;

-- Verify lease is blocked
SELECT * FROM lease_next_task('test-worker', 300);
-- Should return empty (no tasks leased due to budget)

-- Reset limits
UPDATE system_controls SET control_value = '50' WHERE control_key = 'max_tasks_per_day';
DELETE FROM agent_budget_tracking WHERE tracking_date = CURRENT_DATE;
```

---

## Rollback Plan

### Database Rollback

If the migration causes issues, execute the following to remove all Ralph tables and functions:

```sql
-- ============================================================
-- ROLLBACK: Ralph Wiggum Autonomous Execution Layer
-- WARNING: This will delete all task data!
-- ============================================================

-- Drop views first
DROP VIEW IF EXISTS v_system_controls_summary CASCADE;
DROP VIEW IF EXISTS v_recent_task_events CASCADE;
DROP VIEW IF EXISTS v_agent_budget_status CASCADE;
DROP VIEW IF EXISTS v_agent_task_queue CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS create_task CASCADE;
DROP FUNCTION IF EXISTS expire_stale_leases CASCADE;
DROP FUNCTION IF EXISTS check_budget_limits CASCADE;
DROP FUNCTION IF EXISTS approve_task CASCADE;
DROP FUNCTION IF EXISTS request_approval CASCADE;
DROP FUNCTION IF EXISTS fail_task CASCADE;
DROP FUNCTION IF EXISTS complete_task CASCADE;
DROP FUNCTION IF EXISTS lease_next_task CASCADE;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_agent_tasks_updated_at CASCADE;

-- Drop tables (order matters for foreign keys)
DROP TABLE IF EXISTS agent_task_events CASCADE;
DROP TABLE IF EXISTS agent_budget_tracking CASCADE;
DROP TABLE IF EXISTS agent_tasks CASCADE;
DROP TABLE IF EXISTS system_controls CASCADE;

-- Verify cleanup
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%agent%';
-- Should return empty

DO $$
BEGIN
    RAISE NOTICE 'Ralph Wiggum rollback complete. All tables and functions removed.';
END $$;
```

### Workflow Rollback

1. In n8n dashboard, deactivate the "Ralph Wiggum - Autonomous Task Executor" workflow
2. Delete or archive the workflow if needed

### File Rollback

```bash
# Remove Ralph tools directory
rm -rf tools/ralph

# Remove n8n workflows directory (if empty)
rmdir n8n/workflows n8n 2>/dev/null || true

# Remove migration file (if not applied to production)
rm supabase/migrations/005_ralph_wiggum_autonomous_layer.sql
```

---

## Monitoring

### Key Queries

```sql
-- Current queue status
SELECT * FROM v_agent_task_queue;

-- Today's budget consumption
SELECT * FROM v_agent_budget_status;

-- Recent events (last 24h)
SELECT * FROM v_recent_task_events LIMIT 50;

-- Failed tasks requiring attention
SELECT * FROM agent_tasks
WHERE status = 'failed'
ORDER BY completed_at DESC;

-- Tasks awaiting approval
SELECT * FROM agent_tasks
WHERE status = 'awaiting_approval';

-- System controls summary
SELECT * FROM v_system_controls_summary;
```

### Telegram Commands (if approval webhook is configured)

- `/approve <task_id>` - Approve a pending task
- `/reject <task_id>` - Reject a pending task
- `/status` - Get current Ralph status
- `/pause` - Temporarily disable Ralph
- `/resume` - Re-enable Ralph

---

## Security Considerations

1. **Ralph is disabled by default** - Must explicitly enable via `system_controls`
2. **Blocked file patterns** - Cannot modify `.env`, credentials, or secrets
3. **Blocked directories** - Cannot touch `node_modules`, `.git`, etc.
4. **Budget limits** - Daily caps on tasks and LOC changes
5. **Approval gating** - High-autonomy tasks require Telegram approval
6. **Audit trail** - All operations logged to `agent_task_events`
7. **Isolated branches** - All changes made in `ralph/*` branches

---

## Files Created/Modified

| Path | Description |
|------|-------------|
| `supabase/migrations/005_ralph_wiggum_autonomous_layer.sql` | Database schema |
| `tools/ralph/run_task.ts` | Task execution script |
| `tools/ralph/detect_drift.ts` | Drift detection script |
| `tools/ralph/README.md` | This documentation |
| `n8n/workflows/ralph_executor.json` | n8n workflow export |

---

## Next Steps

1. [ ] Configure Supabase credentials in n8n
2. [ ] Configure Telegram Bot for approvals
3. [ ] Set up drift detection cron job
4. [ ] Define initial task library
5. [ ] Test with low-priority tasks before enabling full autonomy
6. [ ] Monitor budget consumption and adjust limits as needed
