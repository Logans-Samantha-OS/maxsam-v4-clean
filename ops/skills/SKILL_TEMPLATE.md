# SKILL_TEMPLATE

## Purpose
Short description of what this skill does and when to use it.

## Inputs
- Required inputs
- Optional inputs

## Outputs
- Deterministic artifacts produced

## Workflow
1. Validate inputs
2. Gather context
3. Produce draft/output
4. Persist artifacts
5. Emit audit notes

## Guardrails
- Do not mutate production data without explicit flag
- Write all state transitions to `workflow_executions` and `tasks`

## Verification Checklist
- [ ] Type-safe code paths
- [ ] Idempotent writes
- [ ] Rollback notes included
