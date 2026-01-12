# MAXSAM GITHUB WIRING PLAN
# Version: 1.0.0
# Status: CANONICAL

## OVERVIEW

GitHub serves as the IMMUTABLE LEDGER for MaxSam.
It is the ONLY source of truth for structural artifacts.
Claude reads from GitHub but NEVER writes directly.

---

## 1. REPOSITORY STRUCTURE

```
maxsam-v4/
├── README.md                    # Project overview
├── CHANGELOG.md                 # Version history
├── .github/
│   └── workflows/
│       └── validate.yml         # GitHub Actions for validation
│
├── workflows/                   # n8n workflow definitions
│   ├── production/
│   │   └── maxsam-pipeline.json      # Active production workflow
│   ├── candidates/
│   │   └── maxsam-pipeline-candidate-YYYYMMDD.json
│   └── ci/
│       ├── regression-runner.json    # CI test runner
│       └── deployer-gate.json        # Deployment gate
│
├── schemas/                     # Database schemas
│   ├── core/
│   │   └── maxsam-schema.sql         # Main tables
│   ├── ci/
│   │   └── maxsam-cicd-schema.sql    # CI/CD tables
│   └── migrations/
│       └── YYYYMMDD_description.sql  # Incremental changes
│
├── prompts/                     # MCP role prompts
│   ├── mcp-builder.md
│   ├── mcp-tester.md
│   └── system-directive.md
│
├── docs/                        # Architecture documentation
│   ├── architecture.md
│   ├── node-map.md              # Canonical 27-node map
│   ├── ci-strategy.md
│   ├── mcp-roles.md
│   └── github-wiring.md
│
├── tests/                       # Test definitions
│   ├── fixtures/
│   │   ├── gemini-extraction.json
│   │   ├── eleanor-scoring.json
│   │   ├── sam-outreach.json
│   │   └── classifier.json
│   └── invariants/
│       └── schema-invariants.json
│
└── releases/                    # Tagged releases
    └── v1.0.0/
        ├── workflow.json
        ├── schema.sql
        └── RELEASE_NOTES.md
```

---

## 2. WHAT GOES IN GITHUB (ALLOWED)

| Artifact Type | Location | Example |
|--------------|----------|---------|
| n8n workflow JSON | /workflows/ | maxsam-pipeline.json |
| CI runner workflows | /workflows/ci/ | regression-runner.json |
| Database schemas | /schemas/ | maxsam-schema.sql |
| MCP prompts | /prompts/ | mcp-builder.md |
| Architecture docs | /docs/ | node-map.md |
| Test fixtures | /tests/fixtures/ | gemini-extraction.json |
| Schema invariants | /tests/invariants/ | schema-invariants.json |
| Release bundles | /releases/ | v1.0.0/ |

---

## 3. WHAT NEVER GOES IN GITHUB (FORBIDDEN)

| Data Type | Reason | Where It Lives |
|-----------|--------|----------------|
| Leads | PII, runtime data | Supabase only |
| Phone numbers | PII | Supabase only |
| Email addresses | PII | Supabase only |
| SMS content | Runtime data | Supabase outreach_log |
| Test results | Runtime data | Supabase test_logs |
| API keys | Security | n8n variables / env |
| Credentials | Security | n8n credentials store |
| Enrichment results | Runtime data | Supabase only |
| Conversation logs | Runtime data | Not stored |

---

## 4. COMMIT RULES

### When to Commit
| Event | Commit? | What |
|-------|---------|------|
| New workflow version created | YES | Candidate JSON |
| Workflow passes tests | YES | Promote to production/ |
| Schema change | YES | New migration file |
| MCP prompt update | YES | Updated prompt |
| Architecture change | YES | Updated docs |
| Bug fix in workflow | YES | New candidate |
| Daily operations | NO | Nothing |
| Lead processing | NO | Nothing |
| Test execution | NO | Results go to Supabase |

### Commit Message Format
```
[TYPE] Brief description

TYPE:
- [WORKFLOW] Changes to n8n workflows
- [SCHEMA] Database schema changes
- [DOCS] Documentation updates
- [CI] CI/CD related changes
- [RELEASE] Tagged release

Examples:
[WORKFLOW] Add retry logic to Twilio Send SMS node
[SCHEMA] Add test_fixtures table for regression tests
[RELEASE] v1.0.1 - Fix SMS truncation bug
```

---

## 5. BRANCHING STRATEGY

### Branches
```
main                    # Production-ready only
├── develop             # Integration branch
│   ├── feature/XXX     # Feature development
│   └── fix/XXX         # Bug fixes
└── releases/           # Release branches
    └── v1.0.0
```

### Branch Rules
| Branch | Who Can Commit | Requirements |
|--------|---------------|--------------|
| main | Automation only | CI passed, review approved |
| develop | Developers | CI must pass |
| feature/* | Anyone | None |
| releases/* | Automation | Tagged from main |

---

## 6. GITHUB → N8N SYNC

### Option A: Manual Sync (Current)
1. Export workflow from n8n
2. Commit to GitHub
3. Human verifies

### Option B: Automated Sync (Recommended)
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   n8n       │────▶│  GitHub     │────▶│   n8n       │
│  (export)   │     │  (store)    │     │  (import)   │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     │                    │                    │
     ▼                    ▼                    ▼
  Webhook on        Webhook on            API call to
  workflow save     push to main         import workflow
```

### Sync Workflow (n8n)
```
Trigger: Workflow saved in n8n
   ↓
Extract workflow JSON
   ↓
POST to GitHub API
   - Create/update file
   - Create commit
   ↓
Log sync to Supabase
```

---

## 7. CLAUDE ↔ GITHUB INTERACTION

### Claude READS from GitHub
```
1. Human provides GitHub file URL
2. Or: Human pastes file content
3. Claude validates content
4. Claude produces artifacts based on content
```

### Claude NEVER WRITES to GitHub
```
Claude output → Human review → Human commits

OR

Claude output → n8n automation → n8n commits via API
```

### Why Claude Cannot Write
- No persistent identity
- No authentication continuity
- Cannot be held accountable
- Cannot be audited reliably

---

## 8. RELEASE TAGGING

### Tag Format
```
v{MAJOR}.{MINOR}.{PATCH}

Examples:
v1.0.0  - Initial release
v1.0.1  - Bug fix
v1.1.0  - New feature
v2.0.0  - Breaking change
```

### Release Process
```
1. All tests pass on develop
2. Merge develop → main
3. CI runs final validation
4. Tag created: v1.X.X
5. Release bundle created in /releases/
6. n8n imports production workflow
7. deploy_logs record created
```

### Release Bundle Contents
```
releases/v1.0.0/
├── workflow.json         # Exact workflow deployed
├── schema.sql            # Schema at this version
├── RELEASE_NOTES.md      # What changed
├── test_results.json     # CI results summary
└── checksum.txt          # SHA256 of all files
```

---

## 9. GITHUB ACTIONS (CI)

### Validation Workflow
```yaml
# .github/workflows/validate.yml
name: Validate MaxSam Artifacts

on:
  push:
    paths:
      - 'workflows/**'
      - 'schemas/**'
  pull_request:
    paths:
      - 'workflows/**'
      - 'schemas/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate workflow JSON
        run: |
          for file in workflows/**/*.json; do
            jq . "$file" > /dev/null || exit 1
          done
          
      - name: Validate SQL syntax
        run: |
          for file in schemas/**/*.sql; do
            # Basic syntax check
            grep -q "CREATE TABLE\|ALTER TABLE\|INSERT INTO" "$file"
          done
          
      - name: Check for secrets
        run: |
          # Ensure no hardcoded secrets
          ! grep -rE "(sk-|api_key.*=.*['\"][a-zA-Z0-9]{20,})" .
```

---

## 10. DISASTER RECOVERY

### Scenario: Production Workflow Lost
```
1. Check GitHub releases/
2. Find latest tagged release
3. Import workflow.json to n8n
4. Verify with smoke tests
5. Resume operations
```

### Scenario: Schema Corruption
```
1. Check GitHub schemas/
2. Apply migrations in order
3. Verify table structure
4. Resume operations
```

### Scenario: Need to Rollback
```
1. Check workflow_versions in Supabase
2. Find previous version_tag
3. Get workflow JSON from GitHub releases/
4. Import to n8n
5. Update workflow_versions status
```

---

## VERSION HISTORY

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-01-12 | Initial canonical plan |
