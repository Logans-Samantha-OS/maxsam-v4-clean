# SKILL: agreement_system_bootstrap

## Meta
- **Name:** Agreement System Bootstrap
- **Version:** 0.1.0
- **Status:** draft
- **Agent Owner:** RALPH
- **n8n Workflow ID:** (multiple — see implementation)

## Description
Bootstraps the full agreement lifecycle: generates an agreement from a lead,
sends it for signing, tracks status, and records completion. Orchestrates
across the `agreements` table, DocuSign/self-hosted signing, and n8n workflows.

## Input Schema
```json
{
  "lead_id": "uuid — the lead to generate an agreement for",
  "type": "string — 'excess_funds' | 'wholesale'",
  "purchase_price": "number — optional, for wholesale deals",
  "fee_percent": "number — default 25 for excess funds, 10 for wholesale"
}
```

## Output Schema
```json
{
  "agreement_id": "uuid — the created agreement record",
  "packet_id": "string | null — signing packet ID",
  "status": "string — current agreement status",
  "success": "boolean"
}
```

## Implementation Notes
- Creates a row in `agreements` table with status=draft.
- Generates the document using `/lib/contract-generator.ts`.
- Sends via the existing agreement dispatch n8n workflow.
- Listens for signing events via webhook to update status.
- The `agreements` table is a stub — full schema to be expanded
  when this skill moves to `active`.

## Guard Rails
- [x] Respects `system_flags.pause_all`
- [x] Logs execution via `logExecution`
- [x] Checks governance gates (`gate_sam_outreach` for send)
- [ ] Requires operator approval before sending agreements > $50K

## Registration SQL
```sql
INSERT INTO skills_registry (slug, name, description, version, status, agent_owner)
VALUES ('agreement_system_bootstrap', 'Agreement System Bootstrap', 'Full agreement lifecycle from lead to signed', '0.1.0', 'draft', 'RALPH');
```
