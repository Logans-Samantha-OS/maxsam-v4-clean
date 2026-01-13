# DAILY RUNBOOK
> Canonical daily execution plan for MaxSam

This runbook defines EXACTLY how the system operates each day.
No steps may be skipped.
No steps may be reordered.

---

## PRE-FLIGHT CHECK (MANDATORY)

Before ANY execution:

- [ ] META_COGNITION_APPENDIX.md present
- [ ] CLAUDE_CONTRACT.md present
- [ ] Active Git branch declared
- [ ] Target workflows identified

If any are missing → STOP.

---

## DAILY EXECUTION FLOW

### STEP 1 — DATA INGESTION
- Ingest county records
- Normalize names, addresses, case numbers
- Deduplicate entities

**Output:** Candidate lead set

---

### STEP 2 — LEAD SCORING
- Score for excess funds
- Score for distress
- Score for urgency

**Output:** Ranked leads

---

### STEP 3 — CONFIDENCE ASSESSMENT
(Required by Meta-Cognition Appendix)

- Compute confidence score
- Document basis
- Gate autonomy

**Output:** Approved / Restricted / Escalated leads

---

### STEP 4 — SECOND-THOUGHT CHECK
- Identify failure modes
- Evaluate downside
- Confirm intent alignment

If failed → STOP or downgrade.

---

### STEP 5 — OUTREACH EXECUTION
- SMS / Voice via Sam
- Present options:
  - 1 = Recovery
  - 2 = Wholesale
  - 3 = Both

All outreach MUST be logged.

---

### STEP 6 — AGREEMENT DELIVERY
- Trigger correct BoldSign template
- Track signature state
- No manual follow-ups before SLA expires

---

### STEP 7 — TRANSACTION ADVANCEMENT
Depending on path:
- Excess funds → County submission
- Wholesale → Buyer portal distribution
- Payments → Stripe reconciliation

---

### STEP 8 — END-OF-DAY REVIEW
- What worked?
- What failed?
- What surprised us?

---

### STEP 9 — PATTERN EXTRACTION
(Required)

- Extract 1–3 learnings
- Write them to GitHub under `/docs/patterns/`
- Commit changes

If no pattern written → learning is LOST.

---

## HARD STOPS

The system MUST STOP if:
- Confidence <50
- Legal ambiguity detected
- Duplicate outreach risk
- Missing agreements

---

## VERSIONING

Daily Runbook: v1.0.0
Depends on: META_COGNITION_APPENDIX v1.0.0

swift
Copy code

This runbook is non-optional.