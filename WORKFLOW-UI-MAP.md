# MaxSam V4 - N8N Workflows vs UI Access T-Chart

Generated: 2026-01-20

## Complete Workflow Analysis

| N8N Workflow | Webhook URL | Dashboard UI | API Route | Status |
|--------------|-------------|--------------|-----------|--------|
| **INGESTION** |
| INGEST • PDF Processor | `/webhook/pdf-processor` | `/dashboard/upload` Upload Zone | - | ✅ CONNECTED |
| INGEST • Gemini Extractor | `/webhook/alex` | `/dashboard` UploadZone | `/api/import/parse-pdf` | ✅ CONNECTED |
| INGEST • Dallas Foreclosure PDFs | - | - | - | ❌ MISSING |
| INGEST • Google Drive | - | - | - | ❌ MISSING |
| INGEST • Propwire | - | - | - | ❌ MISSING |
| INGEST • Auction.com | - | - | - | ❌ MISSING |
| **SCORING & ENRICHMENT** |
| SCORE • Eleanor AI | `/webhook/eleanor-score` | LeadTable row button | `/api/eleanor/score`, `/api/eleanor/score-all` | ✅ CONNECTED |
| ALEX • Auto Skip Trace | `/webhook/skip-trace` | LeadTable row button | - | ✅ CONNECTED |
| ENRICH • Full Pipeline | - | - | - | ❌ MISSING |
| ENRICH • ARV Calculator | - | - | - | ❌ MISSING |
| ENRICH • Phone Validation | - | - | - | ❌ MISSING |
| ENRICH • Property Comps | - | - | - | ❌ MISSING |
| ENRICH • Skip Trace Fallback | - | - | - | ❌ MISSING |
| **OUTREACH (SAM)** |
| SAM • Initial SMS | `/webhook/sam-initial-outreach` | BulkActionsBar "SAM Blast" | `/api/sms/send` | ✅ CONNECTED |
| SAM • Response Handler | - | - | `/api/twilio/inbound-sms` | ⚠️ API ONLY |
| SAM • Manual SMS (Dashboard) | - | - | `/api/leads/[id]/sms` | ⚠️ API ONLY |
| SAM • Auto Outreach | - | - | `/api/cron/outreach` | ⚠️ API ONLY |
| SAM • Agreement Sender | - | - | - | ❌ MISSING |
| SAM • SMS Consent | `/webhook/sms-consent` | - | - | ❌ MISSING |
| SAM • SMS Agreement | `/webhook/sms-agreement` | - | - | ❌ MISSING |
| SAM • 10-Day Countdown | - | - | - | ❌ MISSING |
| SAM • Brain (AI) | - | - | - | ❌ MISSING |
| SAM • Buyer Blast | - | - | - | ❌ MISSING |
| SAM • Deal Blast | `/webhook/push-to-buyers` | `/deals/[id]/blast` | `/api/deals/[id]/blast` | ✅ CONNECTED |
| SAM • Email Initial | - | - | - | ❌ MISSING |
| SAM • Proactive | - | - | - | ❌ MISSING |
| SAM • Signature Handler | - | - | - | ❌ MISSING |
| SAM • Money Machine Outbound | - | - | - | ❌ MISSING |
| SAM • Voice Brain | - | - | - | ❌ MISSING |
| SAM • Voice Handler | - | - | - | ❌ MISSING |
| **DOCUMENTS** |
| DOCS • Agreement Sender | - | - | - | ❌ MISSING |
| DOCS • Generator | `/webhook/doc-generator` | - | `/api/contracts/send` | ⚠️ API ONLY |
| DOCS • BoldSign Send | - | - | `/api/webhooks/boldsign` | ⚠️ API ONLY |
| DOCS • Claim Packet | - | - | - | ❌ MISSING |
| DOCS • Collector | - | - | - | ❌ MISSING |
| **PAYMENTS** |
| PAY • Stripe Webhook | `/webhook/assignment-fee-paid` | - | `/api/webhooks/stripe` | ⚠️ API ONLY |
| PAY • Fee Invoice | - | - | `/api/deals/[id]/invoice` | ⚠️ API ONLY |
| **CEO TOOLS** |
| CEO • Morning Report | - | - | `/api/morning-brief` | ⚠️ API ONLY |
| CEO • SMS Command | - | - | - | ❌ MISSING |
| CEO • Context Gatherer | - | - | - | ❌ MISSING |
| CEO • Golden Lead Review | - | - | - | ❌ MISSING |
| CEO • Health Check | - | - | - | ❌ MISSING |
| CEO • Quick Add | - | - | - | ❌ MISSING |
| CEO • Telegram Bot | `/webhook/telegram-blast` | `/deals/[id]` | `/api/telegram/notify` | ✅ CONNECTED |
| CEO • Thinking Pad | - | - | - | ❌ MISSING |
| **MATCHING** |
| MATCH • Golden Lead Hunter | - | - | - | ❌ MISSING |
| MATCH • Zillow Detector | `/webhook/zillow-scan` | - | - | ❌ MISSING |
| MATCH • Zillow DUAL Finder | - | - | - | ❌ MISSING |
| **TRACKING** |
| TRACK • Claim Status | - | - | - | ❌ MISSING |
| TRACK • Daily Metrics | - | - | - | ❌ MISSING |
| TRACK • Notification Queue | - | - | - | ❌ MISSING |
| TRACK • Weekend Updates | - | - | - | ❌ MISSING |
| **ORCHESTRATION** |
| Ralph Executor | - | - | `/api/ralph/run`, `/api/ralph/loop` | ⚠️ API ONLY |
| Golden Lead Pipeline | - | - | - | ❌ MISSING |
| META • Self Healer | - | - | - | ❌ MISSING |

---

## Summary Statistics

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ CONNECTED | 9 | 16% |
| ⚠️ API ONLY | 10 | 18% |
| ❌ MISSING | 37 | 66% |
| **Total** | **56** | 100% |

---

## UI Buttons Needed for Full CEO Dashboard Control

### Priority 1: Critical Operations (Add to Command Center)
1. **Run Ralph** - Button to trigger `/api/ralph/run`
2. **Score All Leads** - Button to trigger `/api/eleanor/score-all`
3. **Morning Brief** - Button to trigger `/api/morning-brief`
4. **Run SAM Batch** - Button to trigger `/api/sam/run-batch`
5. **Sync N8N** - Already exists in `/dashboard/governance`

### Priority 2: Pipeline Controls (Add to Command Center)
6. **Run Skip Trace Batch** - Bulk skip trace for untraced leads
7. **Send Contracts** - Button to trigger contract generation
8. **Buyer Blast** - Send deals to buyers list
9. **Golden Lead Scan** - Trigger Zillow cross-reference

### Priority 3: Reporting (Add to Stats page)
10. **Daily Metrics Export** - Generate daily report
11. **Claim Status Report** - View all claim statuses
12. **Pipeline Health Check** - System diagnostics

---

## Current Dashboard UI → N8N Mappings

### /dashboard (Main)
| UI Element | N8N Webhook | Notes |
|------------|-------------|-------|
| UploadZone | `/webhook/alex` | PDF ingestion |
| LeadTable Skip Trace | `/webhook/skip-trace` | Per-lead button |
| LeadTable Eleanor | `/webhook/eleanor-score` | Per-lead button |
| BulkActionsBar SMS | `/webhook/sam-initial-outreach` | Bulk action |

### /dashboard/upload
| UI Element | N8N Webhook | Notes |
|------------|-------------|-------|
| PDF Upload | `/webhook/pdf-processor` | Dallas County PDFs |

### /dashboard/governance
| UI Element | N8N Webhook | Notes |
|------------|-------------|-------|
| Workflow Toggles | N8N API | Enable/disable workflows |
| Kill Switch | Supabase | System halt |

### /dashboard/command-center
| UI Element | N8N Webhook | Notes |
|------------|-------------|-------|
| (Empty) | - | Needs buttons added |

---

## API Routes → N8N Webhook Mappings

| API Route | N8N Webhook | Purpose |
|-----------|-------------|---------|
| `/api/import/parse-pdf` | `/webhook/alex` | PDF parsing |
| `/api/import/scrape-url` | `/webhook/alex` | URL scraping |
| `/api/sms/send` | `/webhook/sam-initial-outreach` | SMS sending |
| `/api/contracts/send` | `/webhook/doc-generator` | Contract generation |
| `/api/deals/[id]/blast` | `/webhook/push-to-buyers` | Buyer blast |
| `/api/deals/[id]/bid` | `/webhook/submit-bid` | Bid submission |
| `/api/webhooks/stripe` | `/webhook/assignment-fee-paid` | Payment webhook |

---

## Recommended Command Center Layout

```
┌─────────────────────────────────────────────────────────┐
│  COMMAND CENTER                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  PIPELINE ACTIONS                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  Run Ralph  │ │ Score All   │ │ Skip Trace  │       │
│  │    🤖       │ │    🎯       │ │    📞       │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  OUTREACH                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  SAM Batch  │ │ Buyer Blast │ │ Contracts   │       │
│  │    📱       │ │    📢       │ │    📝       │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  REPORTS                                                 │
│  ┌─────────────┐ ┌─────────────┐                       │
│  │ Morning     │ │ Health      │                       │
│  │ Brief  ☀️   │ │ Check  🏥   │                       │
│  └─────────────┘ └─────────────┘                       │
│                                                          │
│  EXECUTION QUEUE                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Pending: 12  |  Running: 3  |  Completed: 847    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```
