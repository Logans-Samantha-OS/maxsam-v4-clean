# SKILL: repo_patch_generator

## Meta
- **Name:** Repo Patch Generator
- **Version:** 0.1.0
- **Status:** draft
- **Agent Owner:** RALPH
- **n8n Workflow ID:** (none — code-only)

## Description
Generates a git-ready patch (diff) for the MaxSam V4 repository from a
high-level instruction. Produces file creates/edits/deletes as a unified diff
that can be applied with `git apply`.

## Input Schema
```json
{
  "instruction": "string — what code change is needed",
  "target_files": "string[] — optional list of files to focus on",
  "branch_name": "string — branch to target (default: current)"
}
```

## Output Schema
```json
{
  "patch": "string — unified diff",
  "files_changed": "string[] — list of affected file paths",
  "success": "boolean"
}
```

## Implementation Notes
- Delegates to Claude Code for actual code generation.
- Validates the patch can apply cleanly.
- Does NOT commit or push — operator must review.

## Guard Rails
- [x] Respects `system_flags.pause_all`
- [x] Logs execution via `logExecution`
- [ ] Never pushes to main without operator approval
- [ ] Patch must be reviewed before apply

## Registration SQL
```sql
INSERT INTO skills_registry (slug, name, description, version, status, agent_owner)
VALUES ('repo_patch_generator', 'Repo Patch Generator', 'Generates git patches from instructions', '0.1.0', 'draft', 'RALPH');
```
