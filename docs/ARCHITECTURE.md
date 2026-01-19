# MaxSam V4 Architecture

## Overview

MaxSam V4 is an automated real estate money machine that recovers excess funds from Dallas County foreclosures and facilitates wholesale property transactions.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 19, Tailwind CSS |
| Database | Supabase PostgreSQL |
| Deployment | Vercel |
| Integrations | DocuSign, Twilio, Stripe, Telegram, ElevenLabs |

## Core Components

### AI Agents

| Agent | Role | Location |
|-------|------|----------|
| **Eleanor** | Intelligence - Lead scoring & classification | `lib/eleanor.ts`, `lib/classification/` |
| **RALPH** | Execution - Queue management & safeguards | `lib/governance/`, `app/api/ralph/` |
| **SAM** | Outreach - SMS/voice campaigns | `lib/sam-outreach.ts` |
| **ORION** | Classification - A/B/C lead categorization | `lib/classification/eleanorClassifier.ts` |

### Lead Classification (Economic Reality)

| Class | Name | Criteria | Revenue Paths |
|-------|------|----------|---------------|
| **A** | GOLDEN_TRANSACTIONAL | $15K+ excess + $10K+ equity OR cross-referenced | Recovery (25%) + Wholesale (10%) |
| **B** | GOLDEN_RECOVERY_ONLY | $75K+ excess funds | Recovery (25%) |
| **C** | STANDARD_RECOVERY | $5K-$75K excess funds | Recovery (25%) |

### Governance Gates

Located in `lib/governance/gates.ts`:
- Master kill switch
- Per-workflow enable/disable
- Autonomy level (0-3)
- n8n workflow sync

## Directory Structure

```
app/
  api/                    # API routes
    governance/           # Kill switch, gate controls
    workflow-control/     # Workflow toggles, autonomy
    leads/                # Lead CRUD
    ralph/                # Ralph execution
    eleanor/              # Scoring endpoints
  dashboard/
    stats/                # CEO Dashboard
    governance/           # System Control Center
    command-center/       # Ralph execution queue

lib/
  classification/         # Lead classification (A/B/C)
  governance/             # Gate logic
  n8n/                    # n8n integration
  supabase/               # Database client

components/
  governance/             # GovernanceCommandCenter
  dashboard/              # Dashboard widgets
  command-center/         # CommandCenter
  WorkflowControlPanel.tsx
```

## Data Flow

```
PDF Upload → Parse → Eleanor Score → ORION Classify → RALPH Queue
                                                          ↓
                                              SAM Outreach (SMS/Voice)
                                                          ↓
                                              Contract Generation
                                                          ↓
                                              DocuSign Signing
                                                          ↓
                                              Stripe Invoice
                                                          ↓
                                              Telegram Notification
```

## API Routes

### Core Routes
- `GET/POST /api/leads` - Lead management
- `POST /api/eleanor/score` - Score a lead
- `POST /api/eleanor/score-all` - Batch scoring
- `GET /api/classification/summary` - Class breakdown

### Control Plane
- `GET/POST /api/governance` - Gate controls
- `GET/POST/PUT /api/workflow-control` - Workflow toggles
- `POST /api/governance/n8n-sync` - Sync gates to n8n

### Execution
- `POST /api/ralph/run` - Execute queued actions
- `POST /api/sam/run-batch` - Outreach batch

## Database Tables

| Table | Purpose |
|-------|---------|
| `maxsam_leads` | Lead data with Eleanor scores |
| `system_config` | Workflow state, settings |
| `governance_gates` | Kill switch, agent gates |
| `workflow_controls` | n8n workflow gates |
| `contracts` | DocuSign contracts |
| `revenue` | Payment tracking |

## Revenue Model

- **Excess Funds Recovery**: 25% fee
- **Wholesale Assignment**: 10% fee
- **Dual Deal (Class A)**: Both fees apply

## Deployment

- **Production**: Vercel auto-deploy from `main` branch
- **Domain**: `maxsam-v4-clean.vercel.app`
- **Environment**: Supabase, DocuSign, Twilio, Stripe credentials in Vercel env vars
