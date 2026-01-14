# How to Change MaxSam Safely

This document explains how to evolve MaxSam without breaking money, authority, or trust.

---

## Core Rule

> If a change affects money, authority, or execution, it must go through governance.

---

## Step 1: Classify the Change

### Governance-Level (LAW)
Requires branch + PR.

Includes:
- Money-state changes
- Agreement templates
- ORION decision rules
- Intake schemas affecting execution
- System invariants
- Agent authority boundaries

### Operational-Level (OPS)
Commit directly to main.

Includes:
- County data
- PDFs
- Research
- Dashboards
- Non-authoritative workflows

---

## Step 2: If Governance-Level

1. Branch from `main`
2. Make changes
3. Open PR
4. Describe intent + impact
5. Merge
6. Delete branch

No shortcuts.

---

## Step 3: If Operational-Level

1. Commit directly to `main`
2. Push
3. Done

---

## Step 4: Verify

Ask:
- Can ORION still enforce rules?
- Is money still in exactly one state?
- Is every decision auditable?

If yes → safe.

---

## Final Principle

MaxSam does not evolve by intuition.

It evolves by:
- Written rules
- Versioned changes
- Enforced boundaries

When in doubt: treat it as law.
