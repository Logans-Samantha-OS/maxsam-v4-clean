# SKILL: [slug]

## Meta
- **Name:** [Human-readable name]
- **Version:** 0.1.0
- **Status:** draft
- **Agent Owner:** [RALPH | SAM | ALEX | ORION | operator]
- **n8n Workflow ID:** (none)

## Description
[What this skill does in 1-2 sentences.]

## Input Schema
```json
{
  "param1": "string — description",
  "param2": "number — description (optional)"
}
```

## Output Schema
```json
{
  "result": "string — description",
  "success": "boolean"
}
```

## Implementation Notes
[How the skill is implemented — API route, n8n workflow, agent prompt, etc.]

## Guard Rails
- [ ] Respects `system_flags.pause_all`
- [ ] Logs execution via `logExecution`
- [ ] Checks governance gates if applicable

## Registration SQL
```sql
INSERT INTO skills_registry (slug, name, description, version, status, agent_owner)
VALUES ('[slug]', '[Name]', '[Description]', '0.1.0', 'draft', '[AGENT]');
```
