# SKILL: n8n_workflow_builder

## Meta
- **Name:** N8N Workflow Builder
- **Version:** 0.1.0
- **Status:** draft
- **Agent Owner:** RALPH
- **n8n Workflow ID:** (to be assigned)

## Description
Generates and deploys n8n workflow JSON from a high-level instruction.
Accepts a natural-language description of the desired automation, produces
valid n8n workflow JSON, and optionally deploys it via the n8n API.

## Input Schema
```json
{
  "instruction": "string — natural-language description of the workflow",
  "deploy": "boolean — whether to deploy immediately (default false)",
  "workflow_name": "string — human-readable name for the workflow"
}
```

## Output Schema
```json
{
  "workflow_json": "object — the generated n8n workflow",
  "n8n_workflow_id": "string | null — ID if deployed",
  "success": "boolean"
}
```

## Implementation Notes
- Uses Claude to generate n8n-compatible JSON from the instruction.
- Validates the JSON schema before deployment.
- Deploys via `maxsam.n8n_create_workflow` MCP tool.
- Stores the workflow in the repo under `n8n/workflows/` for version control.

## Guard Rails
- [x] Respects `system_flags.pause_all`
- [x] Logs execution via `logExecution`
- [x] Checks governance gates (`gate_ralph_execution`)
- [ ] Requires operator approval before deploy=true

## Registration SQL
```sql
INSERT INTO skills_registry (slug, name, description, version, status, agent_owner)
VALUES ('n8n_workflow_builder', 'N8N Workflow Builder', 'Generates and deploys n8n workflows from instructions', '0.1.0', 'draft', 'RALPH');
```
