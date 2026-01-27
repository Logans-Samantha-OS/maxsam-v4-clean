# MAXSAM V4 HANDOFF DOCUMENT
## Session: January 25, 2026

---

## SYSTEM OVERVIEW

**MaxSam V4** is an AI-powered excess funds recovery and wholesale real estate system.

| Component | URL/Location |
|-----------|--------------|
| Dashboard | https://maxsam-v4-clean.vercel.app |
| N8N Workflows | https://skooki.app.n8n.cloud |
| Database | Supabase (see ENV V4 Google Doc for credentials) |
| Local Code | C:\Users\MrTin\Downloads\MaxSam-V4 |
| Vercel Project | prj_j995qw1vseFKgQlygLsbAEyLZ4VK (maxsam-v4-clean) |

---

## AGENTS

| Agent | Role | Tech |
|-------|------|------|
| **ALEX** | Data operations, PDF parsing, skip tracing | Gemini + DocumentAI + NotebookLM |
| **ELEANOR** | Lead scoring, classification, offer calculation | Claude |
| **SAM** | SMS outreach, follow-ups, deal closing | GPT-4o + Twilio |
| **ORION** | Monitoring, reporting, Telegram notifications | System |
| **RALPH** | Orchestration, autonomy control, decision making | System |

---

## FIXES COMPLETED TODAY

### 1. Vercel Project ID Fixed
- `.vercel/project.json` now correctly points to `maxsam-v4-clean`
- ProjectId: `prj_j995qw1vseFKgQlygLsbAEyLZ4VK`
- OrgId: `team_8ZF5lpi9IISysvcHjmKvr5FV`

### 2. N8N Resource Hogs Deactivated
Disabled workflows that were burning 336 executions/day (10,080/month):

| Workflow | Was Running | Status Now |
|----------|-------------|------------|
| AGENT • Loop (15min) | Every 15 min | ❌ DISABLED |
| MAXSAM • Agreement Auto-Send | Every 10 min | ❌ DISABLED |
| ORION • Heartbeat | Every 15 min | ❌ DISABLED |
| CEO • Morning Report | Daily 8 AM | ❌ DISABLED (duplicate) |

### 3. Critical Workflows Activated
| Workflow | Schedule | Status |
|----------|----------|--------|
| SAM • Morning Campaign (9AM CT) | Daily 9 AM CST | ✅ ACTIVE |
| CEO • 8AM Daily Brief | Daily 8 AM CST | ✅ ACTIVE |
| ALEX • Overnight Skip Trace | Daily 2 AM CST | ✅ ACTIVE |
| ORION • Daily Report | Daily 10 PM CST | ✅ ACTIVE |

### 4. 53% Failure Rate - ROOT CAUSE FOUND
All failures were caused by hitting N8N execution limit (2,500/month).
The resource hog workflows were consuming 4x the monthly budget.
After deactivation, system is now at ~47% budget usage.

---

## CURRENT N8N EXECUTION BUDGET

| Metric | Before | After |
|--------|--------|-------|
| Daily executions | 336/day | ~39/day |
| Monthly executions | 10,080/mo | ~1,170/mo |
| Budget (2,500/mo) | 403% OVER | **47% used** |
| Buffer remaining | None | ~1,330 executions |

---

## ACTIVE CRON SCHEDULE (CST)

| Time | Workflow | Agent | What It Does |
|------|----------|-------|--------------|
| 2:00 AM | ALEX • Overnight Skip Trace | ALEX | Find phone numbers for leads |
| 8:00 AM | CEO • 8AM Daily Brief | ORION | Telegram summary to Logan |
| 9:00 AM | SAM • Morning Campaign | SAM | Send outreach SMS |
| 10:00 PM | ORION • Daily Report | ORION | End of day summary |

---

## CEO DASHBOARD CONTROLS - VERIFIED WORKING

| Control | Status | What It Does |
|---------|--------|--------------|
| RALPH Toggle | ✅ WORKS | Enables/disables RALPH orchestration |
| Autonomy Level (0-3) | ✅ WORKS | Controls how autonomous RALPH is |
| Intake Toggle | ✅ WORKS | Blocks/allows PDF processing & lead import |
| Outreach Toggle | ✅ WORKS | Blocks/allows SAM SMS campaigns |
| Contracts Toggle | ✅ WORKS | Blocks/allows document generation |
| Payments Toggle | ⚠️ PARTIAL | Gate works but payment functionality deprecated |
| Kill Switch (STOP) | ✅ WORKS | Emergency stop - halts ALL API routes |
| N8N Workflow Toggles | ✅ WORKS | Syncs to N8N via `/api/governance/n8n-sync` |

All gates enforced via `enforceGates()` middleware before execution.

---

## KNOWN ISSUES - NOT YET FIXED

### 1. Dashboard Data Inconsistency
- Lead Classification shows: 22 leads, $398K pipeline
- Command Center shows: 230 leads, $1.37M pipeline
- Different API routes returning different data

### 2. "Error: Invalid API key" 
- Still showing on Executive Dashboard top right
- Specific API route is broken (not env vars)

### 3. Analytics Overview Shows Zeros
- Total Pipeline: 0
- Estimated Fees: 0
- Status Counts: all 0
- Queries different endpoint than working sections

### 4. 208 Unclassified Leads
- 230 total leads
- Only 22 classified (17 Class A, 5 Class C, 0 Class B)
- ELEANOR needs to score remaining 208

---

## SKIP TRACE OPTIMIZATION - DECIDED

### Strategy: Webhook + Monday Backup

**Trigger 1: After PDF Upload (Webhook)**
- Fires when you upload county PDF
- Skip traces only NEW leads from that upload
- Uses Browserless + TruePeopleSearch (unlimited, free)

**Trigger 2: Monday 2 AM (Cron Backup)**
- Catches any leads that failed or were missed
- Runs weekly, not daily
- Saves ~22 executions/month

### Skip Trace Tech Stack
- **DO USE:** Browserless → TruePeopleSearch (unlimited)
- **DON'T USE:** SerpAPI (limited to 250/month)
- Browserless Token: `2TaFV71D6Cm56Ua44ab549b7e251fe9a85eb1e7a9b11a0aec`
- Browserless URL: `wss://production-sfo.browserless.io`

---

## SAM MESSAGE TEMPLATES - DECIDED

### Business Model Clarification
- Logan does NOT buy houses
- Logan CONNECTS sellers with cash buyers
- Logan recovers excess funds (25% fee, no upfront cost)
- Wholesale: 10% assignment fee

### Template Requirements
**INCLUDE in messages (builds trust):**
- First name, property address, county
- Exact dollar amount, case number, expiry date
- "No upfront cost" language

**WITHHOLD (keeps them needing you):**
- How to file claims, where to file, forms needed
- Buyer contact info

### Three Templates Needed

**EXCESS_FUNDS:**
```
{first_name} - {county} County has ${excess_amount} from {property_address} (Case #{case_number}).

This expires {expiry_date} and requires specific paperwork to claim.

I handle the entire process - no upfront cost, I only get paid when you do.

Want me to recover this for you? Reply YES
```

**WHOLESALE:**
```
{first_name} - I work with cash buyers looking for properties like {property_address}.

Based on recent sales in {city}, they're offering around ${offer_amount} for homes in your area. No repairs, no fees, close in 2 weeks.

Want to see what they'd offer? Reply YES
```

**GOLDEN (Both):**
```
{first_name} - Two things about {property_address}:

1) {county} County is holding ${excess_amount} for you (Case #{case_number}, expires {expiry_date})

2) I have buyers paying ${offer_amount}+ for properties in {city}

I can help with either or both - no upfront cost.

Interested? Reply YES
```

### Offer Calculation
- Use `eleanor_calculated_offer` if available
- OR `assessed_value * 0.90` as fallback

---

## OPTIMAL LEAD PIPELINE - DECIDED

```
PDF Upload 
    ↓ (chains to)
ALEX Parse PDF → Save leads to Supabase
    ↓ (chains to)
ALEX Skip Trace → Get phone numbers via TruePeopleSearch
    ↓ (chains to)
ELEANOR Score → Classify A/B/C, calculate offers
    ↓ (marks)
Leads ready_for_outreach = true
    ↓ (picked up by)
SAM Morning Campaign (9 AM) → Sends personalized SMS
```

Monday 2 AM backup cron catches any failures.

---

## NEXT STEPS - PRIORITY ORDER

### Priority 1: Fix Dashboard Data Inconsistency
- Make all sections query same data source
- Fix "Invalid API key" error
- Sync Lead Classification with Command Center

### Priority 2: Classify All Leads
- Run ELEANOR on all 230 leads
- Currently only 22 classified
- Should have Class A, B, and C populated

### Priority 3: Implement SMS Templates
- Create `sms_templates` table in Supabase
- Store three templates (excess_funds, wholesale, golden)
- Update SAM workflows to use templates with variable injection

### Priority 4: Build Skip Trace Chain
- Connect PDF upload → skip trace → scoring
- Change skip trace from daily to Monday-only
- Add webhook trigger after uploads

### Priority 5: Test Full Pipeline
- Upload a test PDF
- Watch it flow through: Parse → Skip Trace → Score → Ready for SAM
- Verify 9 AM outreach sends correctly

---

## CLAUDE CODE BOOTSTRAP RULES

Located at: `C:\Users\MrTin\Downloads\MaxSam-V4\CLAUDE_BOOTSTRAP.md`

**NEVER:**
- Use `git worktree add`
- Create new Vercel projects
- Work outside the main repo directory

**ALWAYS:**
- Work in `C:\Users\MrTin\Downloads\MaxSam-V4`
- Verify `.vercel/project.json` shows correct projectId
- Run `npm run build` before deploying
- Push to main branch (Vercel auto-deploys)

---

## KEY CREDENTIALS & TOKENS

All stored in ENV V4 Google Doc and Vercel environment variables.

**Services:**
- Supabase (database)
- Twilio (SMS)
- Browserless (web scraping)
- N8N (workflows)
- Telegram (notifications)

**Browserless Token:** `2TaFV71D6Cm56Ua44ab549b7e251fe9a85eb1e7a9b11a0aec`

---

## FILES CREATED THIS SESSION

1. `MAXSAM_V4_CERTIFICATE_OF_FUNCTION.md` - Full operational specs
2. `MAXSAM_V4_CRON_SCHEDULE.md` - Active cron schedule
3. `CLAUDE_BOOTSTRAP.md` - Rules for Claude Code
4. This handoff document

---

## STARTING A NEW THREAD

Paste this context:

```
I'm continuing work on MaxSam V4. Here's the current state:

SYSTEM: AI-powered excess funds recovery + wholesale real estate
DASHBOARD: https://maxsam-v4-clean.vercel.app
N8N: https://skooki.app.n8n.cloud
CODE: C:\Users\MrTin\Downloads\MaxSam-V4

COMPLETED TODAY:
- Fixed Vercel project.json pointing to wrong project
- Disabled resource-hog N8N workflows (was at 403% budget, now 47%)
- Activated SAM Morning Campaign, CEO Daily Brief, ALEX Skip Trace
- Verified CEO Dashboard controls actually work (RALPH, gates, etc.)

STILL NEEDS FIXING:
1. Dashboard data inconsistency (22 leads vs 230 leads in different sections)
2. "Invalid API key" error on Executive Dashboard
3. 208 leads unclassified (need ELEANOR scoring)
4. SMS templates need to be created with personalization
5. Skip trace needs to be webhook-triggered + Monday backup only

BUSINESS MODEL:
- Excess funds: 25% fee, no upfront cost
- Wholesale: Connect sellers with buyers, 10% assignment fee
- Golden leads: Both excess funds AND wholesale potential
- Logan does NOT buy houses, he connects with buyers

See MAXSAM_V4_HANDOFF_JAN25.md for full details.
```

---

*Last Updated: January 25, 2026 @ 2:00 PM CST*
