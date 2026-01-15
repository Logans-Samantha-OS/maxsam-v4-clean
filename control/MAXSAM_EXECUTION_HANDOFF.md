MAXSAM_EXECUTION_HANDOFF.md
MaxSam V4 — Execution Continuity & Autonomy Governance
Purpose
This document is the single source of truth for resuming MaxSam V4 execution after quota interruption.
 Claude Code must resume from the last incomplete step, not redesign or redo completed work.

1. LOCKED SYSTEM INTENT (DO NOT REDESIGN)
Core Goal
Implement a governed Golden Lead pipeline with autonomous discovery, guarded declaration, and controlled outreach.
Canonical End-to-End Flow (THIS IS THE TARGET STATE)
PDF arrives
   ↓
Gemini reads & extracts (Autonomy Level 0)
   ↓
Claude evaluates & normalizes (Autonomy Level 1)
   ↓
Claude declares golden lead (Autonomy Level 2)
   ↓
Supabase emits event
   ↓
n8n triggers
   ↓
Telegram alert to YOU
   ↓
If within Sam’s hours → create call task (Autonomy Level 3)

This flow is intentional, final, and must be preserved.

2. AUTONOMY LADDER (LOCKED)
Level 0 — Intelligence Only (Gemini)
Allowed:
Read PDFs


Extract entities


Cluster patterns


Propose candidate leads


Forbidden:
Writing to Supabase


Triggering automation


Contacting humans



Level 1 — Recommendation (Claude, no execution)
Allowed:
Normalize Gemini output


Score confidence


Recommend approve/reject


Forbidden:
Declaring golden leads


Triggering n8n


Outreach



Level 2 — Conditional Declaration (Claude)
Allowed:
Declare golden leads via function only if criteria pass


Write to golden_leads


Emit declaration events


Required criteria:
Priority score ≥ threshold


Excess funds present


Distressed property present


Enum-compliant deal_type


Forbidden:
Outreach


Contacting Sam


Scheduling calls



Level 3 — Assisted Outreach (n8n + Sam)
Allowed:
Telegram alert to Logan


Create call task for Sam only during allowed hours


Required guards:
Time window enforcement


Kill switch


Rate limits



3. DATABASE STRUCTURE (FINALIZED)
Golden Lead Declaration is NOT DIRECT INSERT
Golden leads are declared only via:
declare_golden_lead(candidate_id, deal_type, declared_by, reason)

This function:
Requires approved candidate


Enforces schema


Prevents positional inserts


Emits a declaration event


Direct inserts into golden_leads are forbidden.

4. EVENT EMISSION (INCOMPLETE — NEXT STEP)
Golden lead declaration must emit an event using ONE of:
Polling on golden_lead_events (initial)


OR LISTEN / NOTIFY (later hardening)


OR Supabase Edge Function → webhook


n8n must react only to declared truth, never to Gemini suggestions.

5. N8N RESPONSIBILITIES (TO BE IMPLEMENTED)
n8n workflow must:
Detect newly declared golden leads


Deduplicate events


Send Telegram alert to Logan


Check Sam availability window


If allowed → create call task


If not allowed → queue for next window


n8n must not:
Decide golden leads


Call Gemini


Modify Supabase schemas



6. SAM HOURS & SAFETY (REQUIRED)
Outreach to Sam must be guarded by:
Allowed hours (e.g., 9am–6pm local)


system_controls.sam_enabled flag


Manual kill switch


Rate limit per day


No outreach outside window. No exceptions.

7. CURRENT STATE (AS OF HANDOFF)
Completed
Golden Lead schema design


Candidate evaluation model


Declaration function design


Autonomy ladder defined


Governance boundaries locked


Incomplete (DO NEXT)
Implement event emission on golden lead declaration


Create n8n workflow (JSON export)


Wire Telegram alert


Add Sam hours + kill switch enforcement


Test end-to-end with Sharon Denise Wright data



8. HARD RULES FOR CLAUDE CODE
Claude Code MUST:
Resume from incomplete steps only


NOT redesign schemas


NOT re-run completed migrations


NOT relax autonomy levels


NOT let Gemini write to Supabase


NOT bypass declaration function


Claude Code MUST:
Implement missing pieces deterministically


Commit small, scoped changes


Log results clearly


Stop and report blockers



9. SUCCESS CRITERIA
The system is “working” only when:
A PDF can be ingested


Gemini proposes candidates


Claude approves & declares a golden lead


Supabase records it


n8n fires


Logan receives Telegram alert


Sam is queued only during allowed hours


Anything less is incomplete.

10. RESUME INSTRUCTION (FOR CLAUDE CODE)
Resume execution from Golden Lead → n8n trigger wiring.
 Do not redo completed work.
 Implement missing automation safely and deterministically.

END OF HANDOFF
