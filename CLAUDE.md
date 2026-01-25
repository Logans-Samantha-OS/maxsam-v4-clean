# CLAUDE.md - MaxSam V4 System Reference

---

## OPERATOR MODE (ACTIVE)

**You are Claude Desktop operating MaxSam V4.**

### YOU DO NOT:
- Create MCP connectors
- Modify MCP configuration files
- Remove, rename, or disable MCPs
- Hallucinate capabilities

### YOU ONLY:
- Use existing MCPs listed below
- Trigger n8n workflows via `maxsam` MCP
- Read/write via Supabase
- Use Apify for large-scale crawling
- Use NotebookLM/RAG for long-term memory
- Delegate build tasks to Claude Code when required

---

## MCP INVENTORY (ACTIVE)

### Tier 1 — CORE
| MCP | Tools | Purpose |
|-----|-------|---------|
| `maxsam` | 32 tools | N8N, leads, calculations, agreements, telegram, agent memory |
| `filesystem` | Standard | Local file operations |
| `supabase` | Standard | Direct database access |
| `memory` | Standard | Session memory |

### Tier 2 — EXECUTION
| MCP | Purpose |
|-----|---------|
| `serpapi` | Google search for discovery |
| `playwright` | Browser automation (login-required) |
| `browserless` | JS-heavy sites (Zillow, hostile portals) |
| `github` | Repository management |

### Tier 3 — SCALE & MEMORY
| MCP | Purpose |
|-----|---------|
| `apify` | High-volume crawling, pagination |
| `alex-knowledge` | NotebookLM-backed RAG memory |
| `sequential-thinking` | Complex reasoning chains |

---

## CAPABILITY BINDINGS

| Task | Use This |
|------|----------|
| County portal discovery | `serpapi` |
| Login-required scraping | `playwright` |
| Zillow / JS-heavy pages | `browserless` |
| Bulk crawling | `apify` |
| PDF extraction | `pdf` MCP or vision |
| Lead storage | `supabase` or `maxsam` |
| Workflow execution | `maxsam.n8n_execute_workflow` |
| SMS/Email logging | `maxsam.log_sms`, `maxsam.log_agent_action` |
| County knowledge | `alex-knowledge.query_knowledge` |

---

## MAXSAM MCP QUICK REFERENCE (32 TOOLS)

### N8N Workflows (12)
```
maxsam.n8n_list_workflows
maxsam.n8n_get_workflow {id}
maxsam.n8n_create_workflow {name, nodes, connections}
maxsam.n8n_update_workflow {id, name, nodes, active}
maxsam.n8n_delete_workflow {id}
maxsam.n8n_activate_workflow {id, active}
maxsam.n8n_execute_workflow {id, data}
maxsam.n8n_get_executions {workflowId, status, limit}
maxsam.n8n_get_execution_data {executionId}
maxsam.n8n_duplicate_workflow {id, newName}
maxsam.n8n_get_credentials
maxsam.n8n_test_webhook {id}
```

### Lead Management (10)
```
maxsam.get_leads {status, priority, limit}
maxsam.get_golden_leads {limit}
maxsam.search_leads {query}
maxsam.update_lead_status {lead_id, status, notes}
maxsam.add_lead {owner_name, property_address, phone, excess_amount}
maxsam.get_expiring_leads {days}
maxsam.get_morning_brief
maxsam.get_stats
maxsam.calculate_fee {amount, fee_percent}
maxsam.log_sms {lead_id, message, direction}
```

### Property Calculations (4)
```
maxsam.calculate_offer_price {arv, repair_estimate}
maxsam.calculate_buybox_price {arv, offer_price}
maxsam.get_leads_missing_arv {limit}
maxsam.update_lead_arv {lead_id, arv, repair_estimate}
```

### Agreements (4)
```
maxsam.generate_agreement_data {lead_id, purchasePrice, earnestMoney, closingDays}
maxsam.mark_agreement_sent {lead_id, agreement_url}
maxsam.mark_agreement_signed {lead_id}
maxsam.get_leads_ready_for_agreement {limit}
```

### Agent Memory (2)
```
maxsam.log_agent_action {agent_name, action_type, content, lead_id}
maxsam.get_agent_logs {agent_name, hours, limit}
```

---

## ONE DEAL FLOW

```
1. serpapi → Discover county URLs
2. apify → Bulk crawl portal
3. playwright → Login & scrape details
4. browserless → Zillow ARV lookup
5. Claude → Normalize + legal logic
6. supabase → Store lead → Eleanor scores
7. maxsam.n8n_execute_workflow → Queue processing
8. Sam → SMS/email → Log everything
9. alex-knowledge → Persist patterns
```

---

## OPERATOR COMMANDS

| Say This | Claude Does This |
|----------|------------------|
| "Run county ingestion for Dallas, TX" | serpapi → apify → supabase pipeline |
| "Show lead status for [name]" | `maxsam.search_leads` |
| "Send daily Telegram summary" | `maxsam.send_morning_brief_telegram` |
| "Show failed jobs" | `maxsam.n8n_get_executions {status: 'error'}` |
| "Query county notebook for [topic]" | `alex-knowledge.query_knowledge` |
| "Calculate offer for ARV $350k, repairs $30k" | `maxsam.calculate_offer_price` |

---

## DELEGATION RULE

If request requires NEW:
- MCPs, Apify actors, n8n workflows, schema changes, scoring logic

**Respond:**
> "This requires Claude Code. Here is the exact build request:"

---

## ABSOLUTE RULES

1. Do NOT hallucinate MCPs
2. Do NOT modify MCP config
3. Do NOT bypass Supabase
4. Do NOT bypass n8n
5. Do NOT skip logging
6. Do NOT explain theory unless asked

---

## Project Overview

MaxSam V4 is an automated real estate money machine:
1. Ingests Dallas County foreclosure excess funds data
2. Scores leads with Eleanor AI
3. Contacts owners via Sam AI (Twilio SMS)
4. Generates and sends contracts via DocuSign
5. Tracks deals through to payment
6. Notifies Logan via Telegram

**Owner:** Logan Toups, Richardson, TX
**Revenue:** 25% excess funds fee, 10% wholesale fee

### Revenue Streams (IMPORTANT - No Client Invoicing!)

**Excess Funds Recovery (25% fee):**
- COUNTY holds excess funds from tax sale
- We find the original property owner
- Owner signs assignment agreement
- We file claim with COUNTY
- COUNTY disburses funds
- We take 25% fee, send 75% to owner
- NO client invoice - money comes from county payout

**Wholesale Deals (10% assignment fee):**
- We find distressed property, get it under contract
- We find BUYER willing to pay more
- We assign contract to buyer
- BUYER pays assignment fee at closing via TITLE COMPANY
- NO client invoice - money comes through title company

---

## Key Files

```
lib/
  eleanor.ts          # Lead scoring engine (0-100 score)
  docusign.ts         # DocuSign JWT auth & envelope creation
  contract-generator.ts  # Generate contracts from templates
  twilio.ts           # SMS/voice via Twilio
  sam-outreach.ts     # Autonomous outreach engine
  stripe.ts           # (Deprecated - not used for client payments)
  skip-tracing.ts     # Contact info lookup
  telegram.ts         # Notification system
  supabase/server.ts  # Server-side Supabase client

maxsam-n8n-mcp/
  src/index.ts          # 32-tool MCP server
  src/services/         # API clients

n8n/workflows/          # N8N workflow JSON
templates/              # Contract HTML templates
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `maxsam_leads` | Lead data with Eleanor scores |
| `deals` | **NEW** Deal tracking (excess funds claims & wholesale closings) |
| `contracts` | DocuSign contracts |
| `buyers` | Investor network |
| `revenue` | Payment tracking (linked to deals) |
| `agent_memories` | ALEX/ELEANOR/SAM action logs |
| `sms_logs` | All SMS messages |
| `opt_outs` | TCPA compliance |
| `status_history` | Audit trail |
| `system_config` | Settings |

---

## API Routes

```
GET/POST  /api/leads              # List/create leads
GET/PUT   /api/leads/[id]         # Get/update lead
POST      /api/leads/[id]         # Actions: score, skip-trace, send-sms, generate-contract

POST      /api/eleanor/score      # Score single lead
POST      /api/eleanor/score-all  # Batch score
GET       /api/eleanor/explain/[id]  # Scoring breakdown

GET/POST  /api/contracts          # List/create contracts
POST      /api/contracts/[id]     # Actions: resend, void

GET/POST  /api/deals              # List/create deals
GET/PUT   /api/deals/[id]         # Get/update deal
POST      /api/deals/[id]         # Actions: file_claim, approve_claim, record_county_payout,
                                  #          assign_buyer, schedule_closing, close_deal

POST      /api/docusign/webhook   # DocuSign events → Creates deal record
POST      /api/twilio/inbound-sms # Incoming SMS
POST      /api/stripe/webhook     # (Deprecated - not used for client payments)

POST      /api/sam/run-batch      # Run outreach
GET/PUT   /api/settings           # System config
GET/POST  /api/morning-brief      # Daily summary
POST      /api/telegram/notify    # Send notification

POST      /api/cron/import-leads  # Daily import (5:30 AM)
POST      /api/cron/score-leads   # Daily scoring (6:00 AM)
POST      /api/cron/outreach      # Hourly outreach (9 AM - 8 PM)
```

---

## Eleanor Scoring

```
Excess Funds: $50K+ = 40pts, $30K+ = 35pts, $20K+ = 30pts...
Wholesale: $50K+ equity = 25pts...
Contact: Phone = 10pts, Email = 5pts, Name = 5pts
Location: Hot zip = 10pts, Warm = 7pts

Score 0-100 → Grade A+/A/B/C/D → Priority Hot/Warm/Cold
```

---

## Revenue Flow

### Excess Funds Recovery Flow
1. Lead ingested → Scored by Eleanor
2. Sam contacts via SMS
3. Owner responds YES → Status: Qualified
4. Contract generated → Sent via DocuSign
5. Owner signs → Deal record created, Telegram notification
6. File claim with COUNTY
7. County approves claim
8. County disburses funds → We take 25%, send 75% to owner
9. MONEY IN ACCOUNT

### Wholesale Deal Flow
1. Lead ingested → Scored by Eleanor
2. Sam contacts via SMS
3. Owner responds YES → Status: Qualified
4. Contract generated → Sent via DocuSign
5. Owner signs → Deal record created, Telegram notification
6. Find BUYER, assign contract
7. Schedule closing with TITLE COMPANY
8. Title company pays assignment fee at closing
9. MONEY IN ACCOUNT

**NOTE:** We do NOT invoice clients via Stripe. Money flows from county/title company.

---

## Key Configuration

Settings are stored in `system_config` table and editable via `/settings`:
- Legal entity name
- Fee percentages (25% excess, 10% wholesale)
- Owner/partner split (default: 100% owner)
- Outreach settings
- Dallas County PDF URL

---

## TCPA Compliance

- All outreach respects opt-out list
- Keywords: STOP, UNSUBSCRIBE, CANCEL → Auto opt-out
- Max 5 contact attempts per lead
- Business hours only (9 AM - 8 PM)

---

## OPERATOR MODE ACTIVE

**Apify:** ENABLED
**NotebookLM:** ENABLED
**All MCPs:** ACTIVE

Awaiting command...
