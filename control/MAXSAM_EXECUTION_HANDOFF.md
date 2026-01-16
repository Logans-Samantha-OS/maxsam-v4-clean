# MAXSAM V4 - EXECUTION HANDOFF DOCUMENT
## Golden Lead Governed Execution Pipeline

**Document Version:** 1.0
**Created:** 2026-01-15
**Authority:** This document is the SINGLE SOURCE OF TRUTH

---

## SYSTEM INTENT (LOCKED)

Implement a governed Golden Lead execution pipeline with:
- Autonomous discovery (Gemini)
- Guarded declaration (Claude)
- Controlled outreach (Sam)
- Deterministic execution (n8n)
- Human-supervised escalation (Logan via Telegram)

---

## CANONICAL END-TO-END FLOW (IMMUTABLE)

```
PDF arrives
  ↓
Gemini reads & extracts (Autonomy Level 0)
  ↓
Claude evaluates & normalizes (Autonomy Level 1)
  ↓
Claude declares golden lead (Autonomy Level 2)
  ↓
Supabase emits declaration event
  ↓
n8n triggers
  ↓
Telegram alert to Logan
  ↓
If within Sam's hours → create call task (Autonomy Level 3)
```

---

## AUTONOMY LADDER (LOCKED)

### Level 0 — Gemini (Intelligence Only)
**Allowed:**
- Read PDFs
- Extract entities
- Propose candidate leads

**Forbidden:**
- Writing to Supabase
- Triggering automation
- Contacting humans

### Level 1 — Claude (Recommendation Only)
**Allowed:**
- Normalize Gemini output
- Score confidence
- Recommend approve/reject

**Forbidden:**
- Declaring golden leads
- Triggering n8n
- Outreach

### Level 2 — Claude (Conditional Declaration)
**Allowed:**
- Declare golden leads ONLY via function: `declare_golden_lead()`
- Write to golden_leads
- Emit declaration events

**Required Criteria (ALL must pass):**
- Priority score ≥ threshold
- Excess funds present
- Valid deal_type enum
- Candidate must be approved

**Forbidden:**
- Outreach
- Contacting Sam
- Scheduling calls

### Level 3 — n8n + Sam (Assisted Outreach)
**Allowed:**
- Telegram alert to Logan
- Create call task for Sam only during allowed hours

**Required Guards:**
- Time window enforcement (9am-6pm local)
- Kill switch check (sam_enabled flag)
- Rate limits

**Forbidden:**
- Declaring leads
- Modifying Supabase schemas
- Making decisions

---

## AUTHORITY HIERARCHY (ABSOLUTE)

```
Human (Logan)
  >
Claude
  >
Ralph Wiggum
  >
n8n
  >
Gemini
```

No layer may exceed its authority or bypass another.

---

## DATABASE SCHEMA REQUIREMENTS

### Golden Lead Candidate Table
Stores candidates proposed by Gemini/Claude for evaluation.

### Golden Lead Table
Stores declared golden leads. MUST NOT be inserted directly.
Only created via `declare_golden_lead()` function.

### Golden Lead Events Table
Stores declaration events for n8n polling/triggers.

### Deal Type Enum (LOCKED)
- `excess_only` - Excess funds recovery only
- `wholesale` - Wholesale deal only
- `dual` - Combined excess + wholesale

---

## COMPLETED WORK

1. ✅ Core MaxSam schema (001_complete_schema.sql)
2. ✅ Ralph Wiggum autonomous layer (005_ralph_wiggum_autonomous_layer.sql)
3. ✅ System controls table with kill switches
4. ✅ Agent task queue infrastructure
5. ✅ Telegram notification system (lib/telegram.ts)
6. ✅ Sam outreach engine (lib/sam-outreach.ts)
7. ✅ Eleanor scoring system (lib/eleanor.ts)

---

## IMPLEMENTATION STATUS — COMPLETED 2026-01-15

### 1. Golden Lead Schema (PRIORITY: HIGH)
- [x] Create `golden_lead_candidates` table
- [x] Create `golden_leads` table
- [x] Create `golden_lead_events` table
- [x] Create `deal_type_enum` type

### 2. Declaration Function (PRIORITY: HIGH)
- [x] Implement `declare_golden_lead()` PostgreSQL function
- [x] Enforce candidate approval requirement
- [x] Enforce schema + enum validation
- [x] Emit event on declaration

### 3. Event Emission (PRIORITY: HIGH)
- [x] Implement event emission mechanism
- [x] Using polling via `get_unprocessed_golden_events()`

### 4. Sam Hours Control (PRIORITY: MEDIUM)
- [x] Add `sam_enabled` control flag
- [x] Add `sam_hours_start` control
- [x] Add `sam_hours_end` control
- [x] Add `sam_daily_rate_limit` control

### 5. n8n Workflow (PRIORITY: HIGH)
- [x] Create workflow JSON (`n8n/golden_lead_execution_workflow.json`)
- [x] Poll golden_lead_events
- [x] Send Telegram alert
- [x] Check Sam availability window
- [x] Create call task if allowed

### 6. Telegram Golden Lead Notification (PRIORITY: MEDIUM)
- [x] Add `notifyGoldenLeadDeclared()` function

**All artifacts are INERT and ready for review/deployment.**

---

## TEST CASE (MANDATORY VALIDATION)

**Sharon Denise Wright — Dallas County**

Expected output when system is complete:
```
🚨 GOLDEN LEAD DECLARED

Name: Sharon Denise Wright
Jurisdiction: Dallas County, TX

💰 Excess Funds Available:
$105,629.61 (expires Nov 4, 2027)

🏠 Distressed Property:
Foreclosure scheduled Feb 3, 2026
Loan balance: $292,592

📊 Leverage Profile:
• Combined strategy: Excess + Wholesale
• Priority score: 75/100
• Estimated firm upside: ~$55,407

🧠 Decision Rationale:
High-confidence surname + geo match
Temporal overlap of financial distress

⚙️ System:
Declared by: Claude
Status: Locked & ready for outreach
```

---

## SUCCESS CRITERIA (BINARY)

The system is working only if:
1. A PDF is ingested
2. Gemini proposes candidates
3. Claude approves & declares a golden lead
4. Supabase records declaration
5. Event is emitted
6. n8n fires once
7. Logan receives Telegram alert
8. Sam is queued ONLY during allowed hours

Anything less is **incomplete**.

---

## SAFETY RULES (NON-NEGOTIABLE)

1. **NO** direct inserts into `golden_leads` — use function only
2. **NO** outreach outside Sam hours window
3. **NO** automation without kill switch checks
4. **NO** schema changes without explicit instruction
5. **NO** production deployment — artifacts only

---

## OUTPUT ARTIFACTS

All implementation must produce:
1. SQL migration files
2. n8n workflow JSON exports
3. TypeScript library updates
4. Markdown status reports

---

*END OF HANDOFF DOCUMENT*
