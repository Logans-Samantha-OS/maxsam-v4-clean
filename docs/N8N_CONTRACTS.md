# MaxSam V4 n8n Integration Contracts

## Overview

MaxSam V4 integrates with n8n for workflow orchestration. The system maintains bidirectional sync between Supabase governance gates and n8n workflow activation states.

## n8n Workflows

Workflows are registered in the `workflow_controls` table:

| Workflow | Purpose | Activation Trigger |
|----------|---------|-------------------|
| Lead Import | Daily PDF scraping | Cron (5:30 AM) |
| Lead Scoring | Batch Eleanor scoring | Cron (6:00 AM) |
| Outreach | SMS/voice campaigns | Cron (hourly 9AM-8PM) |
| Contract Gen | DocuSign creation | Event (lead qualified) |
| Payment | Stripe invoicing | Event (contract signed) |
| Notifications | Telegram alerts | Event (various) |

## Sync Mechanism

### Supabase to n8n

When a gate is toggled in the dashboard, the change is written to `workflow_controls`. To propagate to n8n:

```typescript
POST /api/governance/n8n-sync
Body: {
  workflow_id: string,
  action: 'activate' | 'deactivate'
}
```

This calls the n8n API to activate/deactivate the workflow.

### n8n to Supabase

n8n workflows check governance gates before execution:

1. Workflow starts
2. First node queries `governance_gates` for relevant gate
3. If gate disabled, workflow exits early
4. If gate enabled, execution continues

## Gate Check Pattern

Every n8n workflow should include this pattern at the start:

```
[Start] → [HTTP Request: Check Gate] → [IF Gate Enabled] → [Continue]
                                              ↓
                                        [Stop/No-op]
```

HTTP Request configuration:
- Method: GET
- URL: `${MAXSAM_API_URL}/api/governance`
- Response path: Check `governance_gates` array for relevant gate

## Environment Variables

Required in n8n:
- `MAXSAM_API_URL` - Base URL (e.g., `https://maxsam-v4-clean.vercel.app`)
- `SUPABASE_URL` - Direct Supabase access
- `SUPABASE_SERVICE_KEY` - Service role key for direct queries

## Workflow Registration

When adding a new n8n workflow:

1. Create workflow in n8n
2. Get workflow ID from n8n URL
3. Insert into `workflow_controls`:

```sql
INSERT INTO workflow_controls (
  workflow_name,
  n8n_workflow_id,
  description,
  enabled,
  category
) VALUES (
  'New Workflow',
  'abc123',
  'Description',
  true,
  'automation'
);
```

4. Create corresponding gate in `governance_gates` if needed

## API Response Format

The `/api/governance` endpoint returns:

```json
{
  "success": true,
  "system_killed": false,
  "governance_gates": [
    {
      "control_key": "master_kill_switch",
      "enabled": false,
      "disabled_by": null,
      "disabled_at": null,
      "disabled_reason": null
    }
  ],
  "workflow_controls": [
    {
      "workflow_name": "Lead Import",
      "n8n_workflow_id": "abc123",
      "enabled": true,
      "category": "automation"
    }
  ],
  "timestamp": "2025-01-19T00:00:00Z"
}
```

## Error Handling

If n8n sync fails:
1. Gate state is updated in Supabase (authoritative)
2. Error is logged
3. Response includes warning about sync failure
4. Manual sync can be triggered via dashboard

## Kill Switch Behavior

When master kill switch is activated:
1. `master_kill_switch.enabled = true` in `governance_gates`
2. All n8n workflows should check this gate first
3. No n8n workflows deactivated directly (they self-halt)

When revived:
1. `master_kill_switch.enabled = false`
2. Workflows resume checking their individual gates
