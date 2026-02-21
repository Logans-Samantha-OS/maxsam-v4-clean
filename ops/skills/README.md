# MaxSam V4 — Skill Registry

Skills are discrete, versioned capabilities that agents can invoke.
Each skill is defined in a markdown file and registered in the `skills_registry` Supabase table.

## Lifecycle

```
draft → active → deprecated → disabled
```

| State        | Meaning                                      |
|--------------|----------------------------------------------|
| `draft`      | Defined but not yet runnable                  |
| `active`     | Available for agent invocation                |
| `deprecated` | Still works but scheduled for removal         |
| `disabled`   | Hard-stopped — agents must not invoke         |

## Registration

1. Create a markdown file in this directory: `SKILL_<slug>.md`
2. Insert a row into `skills_registry`:

```sql
INSERT INTO skills_registry (slug, name, description, version, status, agent_owner)
VALUES ('my_skill', 'My Skill', 'What it does', '0.1.0', 'draft', 'RALPH');
```

3. Implement the skill (n8n workflow, API route, or agent prompt).
4. Change status to `active` once tested.

## File Convention

```
ops/skills/
  README.md                           ← this file
  SKILL_TEMPLATE.md                   ← blank template
  SKILL_<slug>.md                     ← one per skill
```

## Fields

| Column          | Type   | Description                              |
|-----------------|--------|------------------------------------------|
| `slug`          | text   | Unique identifier (snake_case)           |
| `name`          | text   | Human-readable name                      |
| `description`   | text   | What the skill does                      |
| `version`       | text   | SemVer string                            |
| `status`        | text   | draft / active / deprecated / disabled   |
| `agent_owner`   | text   | Which agent owns this skill              |
| `input_schema`  | jsonb  | Expected input shape                     |
| `output_schema` | jsonb  | Expected output shape                    |
| `n8n_workflow_id` | text | Linked n8n workflow (nullable)           |
| `metadata`      | jsonb  | Anything else                            |

## Guard Rails

- Skills with `status != 'active'` must not be invoked.
- All skill invocations should be logged via `logExecution`.
- The `system_flags.pause_all` flag overrides all skill execution.
