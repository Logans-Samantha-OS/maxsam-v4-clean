# Skills Registry (Repo)

This folder holds human-readable skill specs that pair with `skills_registry` table entries.

## Lifecycle
1. Draft skill markdown in this folder.
2. Register in `skills_registry` with `status='draft'`.
3. Promote to `active` after validation.
4. Deprecate/archive via status transitions only.

## Operational rules
- Every skill execution should emit `workflow_executions` rows.
- Task orchestration should use `tasks` for queue and audit state.
