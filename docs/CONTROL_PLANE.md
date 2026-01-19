# MaxSam V4 Control Plane

## Overview

The control plane provides human oversight over automated operations. All execution is gated by governance controls that can be toggled from the CEO Dashboard.

## Control Surfaces

### 1. CEO Dashboard (`/dashboard/stats`)

Primary operational view showing:
- KPI cards (Total Leads, Pipeline Value, Signed Value, Response Rate)
- Conversion funnel visualization
- Activity chart
- Needs Attention / Recent Wins
- Lead Classification (A/B/C) summary
- Execution Queue

### 2. System Control Center (`/dashboard/governance`)

Full governance control:
- Master kill switch
- Per-agent gates (Eleanor, RALPH, SAM, ORION)
- n8n workflow gates
- Audit log

### 3. Workflow Control Panel (embedded in CEO Dashboard)

Simplified intent-based control:
- Master RALPH toggle
- Emergency stop button
- Autonomy level selector (0-3)
- Workflow toggles (Intake, Outreach, Contracts, Payments)

## Autonomy Levels

| Level | Name | Description |
|-------|------|-------------|
| 0 | STOPPED | All automation halted |
| 1 | READ-ONLY | Can read data, no mutations |
| 2 | SAFE | Safe operations only (scoring, classification) |
| 3 | FULL AUTO | Complete autonomy (outreach, contracts, payments) |

## Workflow Toggles

| Toggle | Controls |
|--------|----------|
| Intake | PDF/CSV upload, ORION scoring, lead ingestion |
| Outreach | SAM SMS campaigns, voice calls |
| Contracts | DocuSign generation and sending |
| Payments | Stripe invoicing and collection |

## State Storage

Workflow state is stored in `system_config` table:

| Key | Type | Description |
|-----|------|-------------|
| `ralph_enabled` | boolean | Master switch |
| `intake_enabled` | boolean | Intake toggle |
| `outreach_enabled` | boolean | Outreach toggle |
| `contracts_enabled` | boolean | Contracts toggle |
| `payments_enabled` | boolean | Payments toggle |
| `autonomy_level` | int | 0-3 level |
| `workflow_last_updated` | timestamp | Last change |
| `workflow_updated_by` | string | Who changed |

## Governance Gates

Stored in `governance_gates` table:

| Gate | Purpose |
|------|---------|
| `master_kill_switch` | Emergency halt all execution |
| `eleanor_gate` | Enable/disable Eleanor scoring |
| `ralph_gate` | Enable/disable RALPH execution |
| `sam_gate` | Enable/disable SAM outreach |
| `orion_gate` | Enable/disable ORION classification |

## API Endpoints

### Workflow Control (`/api/workflow-control`)

```typescript
// GET - Retrieve state
GET /api/workflow-control
Response: {
  intake_enabled: boolean,
  outreach_enabled: boolean,
  contracts_enabled: boolean,
  payments_enabled: boolean,
  autonomy_level: number,
  ralph_enabled: boolean,
  last_updated: string,
  updated_by: string
}

// POST - Update toggles
POST /api/workflow-control
Body: { intake_enabled?: boolean, ralph_enabled?: boolean, ... }

// PUT - Emergency stop
PUT /api/workflow-control
Response: { success: true, action: 'emergency_stop' }
```

### Governance (`/api/governance`)

```typescript
// GET - All gates
GET /api/governance
Response: {
  system_killed: boolean,
  governance_gates: [...],
  workflow_controls: [...]
}

// POST - Kill system
POST /api/governance
Body: { action: 'kill', reason?: string }

// POST - Revive system
POST /api/governance
Body: { action: 'revive' }

// POST - Toggle gate
POST /api/governance
Body: { gate_type: 'system'|'n8n', gate_key: string, enabled: boolean }
```

## Safety Principles

1. **Buttons grant authority, RALPH enforces execution**
   - UI toggles only set intent
   - RALPH checks gates before every action

2. **Graceful degradation**
   - If database unavailable, default to STOPPED
   - Always return valid JSON, never HTML errors

3. **Audit trail**
   - Every gate change is logged
   - Includes who, what, when, why

4. **Emergency stop**
   - One-click halt all automation
   - Requires manual revive to resume
