# SKILL_n8n_workflow_builder

Build or patch n8n workflow JSON with deterministic, auditable behavior.

## Required
- workflow name
- trigger path
- expected input schema
- expected output schema

## Steps
1. Load workflow JSON from `/n8n/workflows`.
2. Ensure outbound `sms_messages` writes resolve `lead_id` by payload or phone fallback.
3. Add structured execution logging fields for status transitions.
4. Save updated JSON and include migration/version notes.

## Validation
- JSON parses
- Trigger path documented
- Lead resolution logic deterministic
