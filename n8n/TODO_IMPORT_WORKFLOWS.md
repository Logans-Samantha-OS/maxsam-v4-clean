# n8n Workflow Import TODO

The following n8n workflows are referenced by MaxSam V4 but their JSON is
not yet exported into this repo. Export them from
`https://skooki.app.n8n.cloud` and save here for version control.

## Missing Workflows

- [ ] `sam-initial-outreach` — webhook at `/webhook/sam-initial-outreach`
- [ ] `send-agreement` — webhook at `/webhook/send-agreement`
- [ ] Any new workflows created by the Skill Factory

## How to Export

1. Open the workflow in n8n.
2. Click the three-dot menu → **Download**.
3. Save the `.json` file in this directory under `n8n/workflows/`.
4. Commit to the repo.

## Related

- Skill: `SKILL_n8n_workflow_builder` (`ops/skills/`)
- Execution log: `workflow_executions` table
