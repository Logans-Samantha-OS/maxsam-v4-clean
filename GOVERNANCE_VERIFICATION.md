# MaxSam V4 Governance Verification Checklist

## Architecture Overview

```
Pipeline: Upload -> ORION -> RALPH -> SAM -> n8n -> External World

Agent Roles:
- ORION: Decision engine ONLY (scoring, classification, next-action reasoning)
- RALPH: Deterministic governor (policy enforcement, safeguards, execution authority)
- SAM: Execution agent (SMS, voice, contracts, payments)
- n8n: Automation fabric (NEVER autonomous, always gated)

Core Principle: Buttons NEVER execute workflows.
               Buttons ONLY grant/revoke authority.
               RALPH enforces ALL execution.
```

## 1. Master Kill Switch Test

### Activate Kill Switch

```bash
curl -X POST http://localhost:3000/api/governance \
  -H "Content-Type: application/json" \
  -d '{"action": "kill", "reason": "Verification test"}'
```

**Expected Response:**

```json
{
  "success": true,
  "action": "kill",
  "message": "SYSTEM KILLED: All execution halted",
  "timestamp": "2026-01-19T..."
}
```

### Verify Blocked Behavior (ORION)

```bash
curl -X POST http://localhost:3000/api/eleanor/score \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "test"}'
```

**Expected Response (503):**

```json
{
  "success": false,
  "blocked": true,
  "gate": "master_kill_switch",
  "reason": "SYSTEM KILLED: Master kill switch is active",
  "timestamp": "2026-01-19T..."
}
```

### Verify Blocked Behavior (RALPH)

```bash
curl -X POST http://localhost:3000/api/ralph/run
```

**Expected Response (503):**

```json
{
  "success": false,
  "blocked": true,
  "gate": "master_kill_switch",
  "reason": "SYSTEM KILLED: Master kill switch is active",
  "timestamp": "2026-01-19T..."
}
```

### Verify Blocked Behavior (SAM)

```bash
curl -X POST http://localhost:3000/api/sam/run-batch \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response (503):**

```json
{
  "success": false,
  "blocked": true,
  "gate": "master_kill_switch",
  "reason": "SYSTEM KILLED: Master kill switch is active",
  "timestamp": "2026-01-19T..."
}
```

### Revive System

```bash
curl -X POST http://localhost:3000/api/governance \
  -H "Content-Type: application/json" \
  -d '{"action": "revive", "reason": "Test complete"}'
```

**Expected Response:**

```json
{
  "success": true,
  "action": "revive",
  "message": "System revived: Kill switch deactivated. Individual gates still apply.",
  "timestamp": "2026-01-19T..."
}
```

## 2. Individual Gate Tests

### Disable ORION Scoring

```bash
curl -X POST http://localhost:3000/api/governance \
  -H "Content-Type: application/json" \
  -d '{"gate_type": "system", "gate_key": "gate_orion_scoring", "enabled": false}'
```

### Enable ORION Scoring

```bash
curl -X POST http://localhost:3000/api/governance \
  -H "Content-Type: application/json" \
  -d '{"gate_type": "system", "gate_key": "gate_orion_scoring", "enabled": true}'
```

### Disable SAM Outreach Only

```bash
curl -X POST http://localhost:3000/api/governance \
  -H "Content-Type: application/json" \
  -d '{"gate_type": "system", "gate_key": "gate_sam_outreach", "enabled": false}'
```

### Verify SAM blocked but ORION works

```bash
# This should work (ORION enabled)
curl -X POST http://localhost:3000/api/eleanor/score \
  -H "Content-Type: application/json" \
  -d '{"lead_data": {"excess_amount": 50000}}'

# This should be blocked (SAM disabled)
curl -X POST http://localhost:3000/api/sam/run-batch \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 3. N8N Sync Tests

### Sync All Workflows from N8N

```bash
curl http://localhost:3000/api/governance/n8n-sync
```

**Expected Response:**

```json
{
  "success": true,
  "synced": 15,
  "total": 15,
  "timestamp": "2026-01-19T..."
}
```

### Disable Specific N8N Workflow

```bash
# First get the workflow ID from the sync response or dashboard
curl -X POST http://localhost:3000/api/governance/n8n-sync \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "abc123", "enabled": false}'
```

### Verify Gate Prevents N8N Activation

```bash
# With gate closed, trying to enable in n8n should fail
curl -X POST http://localhost:3000/api/governance/n8n-sync \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "abc123", "enabled": true}'
```

**Expected Response (403):**

```json
{
  "success": false,
  "error": "Cannot enable n8n workflow: Gate is closed in Supabase",
  "gate_state": false,
  "requested_state": true,
  "message": "Open the gate first via /api/governance before syncing to n8n"
}
```

## 4. Get Full State

```bash
curl http://localhost:3000/api/governance
```

**Expected Response:**

```json
{
  "success": true,
  "system_killed": false,
  "governance_gates": [
    {"control_key": "master_kill_switch", "enabled": false, ...},
    {"control_key": "gate_orion_scoring", "enabled": true, ...},
    ...
  ],
  "workflow_controls": [...],
  "timestamp": "2026-01-19T..."
}
```

## 5. Partial Enablement Scenario

Enable Skip Trace, Disable Everything Else:

```bash
# Disable all agent gates
curl -X POST http://localhost:3000/api/governance -H "Content-Type: application/json" \
  -d '{"gate_type": "system", "gate_key": "gate_sam_outreach", "enabled": false}'

curl -X POST http://localhost:3000/api/governance -H "Content-Type: application/json" \
  -d '{"gate_type": "system", "gate_key": "gate_sam_contracts", "enabled": false}'

curl -X POST http://localhost:3000/api/governance -H "Content-Type: application/json" \
  -d '{"gate_type": "system", "gate_key": "gate_sam_payments", "enabled": false}'

curl -X POST http://localhost:3000/api/governance -H "Content-Type: application/json" \
  -d '{"gate_type": "system", "gate_key": "gate_orion_scoring", "enabled": false}'

curl -X POST http://localhost:3000/api/governance -H "Content-Type: application/json" \
  -d '{"gate_type": "system", "gate_key": "gate_ralph_execution", "enabled": false}'

# Enable skip trace only
curl -X POST http://localhost:3000/api/governance -H "Content-Type: application/json" \
  -d '{"gate_type": "system", "gate_key": "gate_skip_trace", "enabled": true}'
```

## 6. Audit Log Verification

Check that all gate changes are logged:

```sql
SELECT * FROM gate_audit_log ORDER BY created_at DESC LIMIT 20;
```

## Verification Complete Checklist

- [ ] Kill switch stops ALL routes (returns 503 with blocked: true)
- [ ] Individual gates can be toggled independently
- [ ] ORION gate controls /api/eleanor/* routes
- [ ] RALPH gate controls /api/ralph/* routes
- [ ] SAM gate controls /api/sam/* routes
- [ ] Intake gate controls /api/cron/import-leads route
- [ ] N8N workflows sync bidirectionally
- [ ] Gate closure prevents n8n workflow activation
- [ ] Dashboard (/dashboard/stats) reflects real-time state
- [ ] Audit log captures all changes
- [ ] No silent failures - all blocked actions return JSON reason

## Database Tables

### governance_gates

| Column          | Type        | Description                        |
| --------------- | ----------- | ---------------------------------- |
| id              | UUID        | Primary key                        |
| control_key     | TEXT        | Unique gate identifier             |
| enabled         | BOOLEAN     | Gate state (true = open)           |
| disabled_by     | TEXT        | Who disabled the gate              |
| disabled_at     | TIMESTAMPTZ | When disabled                      |
| disabled_reason | TEXT        | Why disabled                       |
| created_at      | TIMESTAMPTZ | Record creation time               |
| updated_at      | TIMESTAMPTZ | Last modification time             |

### workflow_controls

| Column           | Type        | Description                        |
| ---------------- | ----------- | ---------------------------------- |
| id               | UUID        | Primary key                        |
| n8n_workflow_id  | TEXT        | N8N workflow ID (unique)           |
| workflow_name    | TEXT        | Human-readable name                |
| enabled          | BOOLEAN     | Gate state (true = open)           |
| n8n_active_state | BOOLEAN     | Synced state from n8n              |
| last_synced_at   | TIMESTAMPTZ | Last sync time                     |
| disabled_by      | TEXT        | Who disabled                       |
| disabled_at      | TIMESTAMPTZ | When disabled                      |
| disabled_reason  | TEXT        | Why disabled                       |
| created_at       | TIMESTAMPTZ | Record creation time               |
| updated_at       | TIMESTAMPTZ | Last modification time             |

### gate_audit_log

| Column         | Type        | Description                         |
| -------------- | ----------- | ----------------------------------- |
| id             | UUID        | Primary key                         |
| gate_type      | TEXT        | system \| workflow \| n8n           |
| gate_key       | TEXT        | Gate identifier                     |
| action         | TEXT        | enable \| disable \| kill           |
| previous_state | BOOLEAN     | State before change                 |
| new_state      | BOOLEAN     | State after change                  |
| triggered_by   | TEXT        | Who triggered the change            |
| reason         | TEXT        | Why the change was made             |
| metadata       | JSONB       | Additional context                  |
| created_at     | TIMESTAMPTZ | When the change occurred            |

## API Endpoints Summary

| Endpoint                     | Method | Description                    |
| ---------------------------- | ------ | ------------------------------ |
| /api/governance              | GET    | Get all gate states            |
| /api/governance              | POST   | Update gate (kill/revive/toggle) |
| /api/governance/n8n-sync     | GET    | Sync workflows from n8n        |
| /api/governance/n8n-sync     | POST   | Push gate state to n8n         |

## Enforced Routes

| Route                      | Gate(s)                           |
| -------------------------- | --------------------------------- |
| /api/eleanor/score         | master + orion + gate_orion_scoring |
| /api/eleanor/score-all     | master + orion + gate_orion_scoring |
| /api/ralph/run             | master + ralph + gate_ralph_execution |
| /api/ralph/loop            | master + ralph + gate_ralph_execution |
| /api/sam/run-batch         | master + sam + gate_sam_outreach |
| /api/cron/score-leads      | master + orion + gate_orion_scoring |
| /api/cron/outreach         | master + sam + gate_sam_outreach |
| /api/cron/import-leads     | master + gate_intake              |
