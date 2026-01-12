# MAXSAM V4 - COMPLETE SYSTEM ARCHITECTURE
# Version: 1.0.0
# Date: 2026-01-12
# Status: CANONICAL - PRODUCTION READY

## EXECUTIVE SUMMARY

MaxSam V4 is a fully automated, test-gated, version-controlled AI-driven real estate automation system. This document serves as the single source of truth for system architecture.

### Core Principles
1. **No memory reliance** - GitHub is the only persistent memory
2. **Test-gated deployment** - Nothing deploys without passing tests
3. **Complete audit trail** - Every action is logged
4. **Role separation** - Claude builds, n8n tests, n8n deploys
5. **Immutable ledger** - GitHub stores all structural artifacts

---

## SYSTEM COMPONENTS

### 1. N8N Workflows

| Workflow | ID | Purpose | Status |
|----------|-----|---------|--------|
| MaxSam V4 - Master Pipeline | DNWKWtVt15rWamOU | Production lead processing | Ready |
| MaxSam - CI Regression Test Runner | Wml33W9lLd9y7TKv | Automated testing | Deployed |
| MaxSam - MCP Deployer Gate | (Import required) | Deployment automation | JSON Ready |

### 2. Supabase Tables

| Table | Purpose |
|-------|---------|
| leads | Lead data storage |
| outreach_log | SMS/email tracking |
| sms_responses | Inbound messages |
| test_logs | Per-test results |
| test_runs | Test suite summaries |
| deploy_logs | Deployment audit trail |
| workflow_versions | Version control |
| test_fixtures | Known-good test inputs |

### 3. External Services

| Service | Role | Agent |
|---------|------|-------|
| Gemini API | PDF extraction | ALEX |
| Claude API | Outreach generation, classification | SAM |
| Twilio | SMS delivery | SAM |
| SerpAPI | Skip trace search | ALEX |
| Browserless | Web scraping | ALEX |
| Telegram | Notifications | System |

---

## DEPLOYMENT CHECKLIST

### Phase 1: Database Setup
```
[ ] Run maxsam-supabase-schema.sql (main tables)
[ ] Run maxsam-cicd-schema.sql (CI/CD tables)
[ ] Verify all tables created
[ ] Verify all functions created
[ ] Verify all views created
```

### Phase 2: N8N Variables
```
[ ] GEMINI_API_KEY
[ ] ANTHROPIC_API_KEY
[ ] SERPAPI_KEY
[ ] TWILIO_PHONE_NUMBER
[ ] TELEGRAM_BOT_TOKEN
[ ] TELEGRAM_CHAT_ID
```

### Phase 3: N8N Credentials
```
[ ] Supabase/Postgres connection
[ ] Twilio API credentials
[ ] Browserless HTTP Header Auth
```

### Phase 4: Workflow Import
```
[ ] CI Regression Test Runner (Wml33W9lLd9y7TKv) - DONE
[ ] MCP Deployer Gate - Import maxsam-mcp-deployer-gate.json
[ ] Master Pipeline (DNWKWtVt15rWamOU) - DONE
```

### Phase 5: Validation
```
[ ] Run CI Test Runner manually
[ ] Verify test_logs populated
[ ] Verify test_runs populated
[ ] Verify Telegram notifications working
[ ] Run MCP Deployer Gate manually
[ ] Verify deploy_logs populated
```

### Phase 6: Activation
```
[ ] Activate CI Test Runner (schedule or webhook)
[ ] Activate MCP Deployer Gate
[ ] Activate Master Pipeline (production)
```

---

## WEBHOOK ENDPOINTS

| Endpoint | Purpose |
|----------|---------|
| `https://skooki.app.n8n.cloud/webhook/maxsam-manual-trigger` | Manual pipeline trigger |
| `https://skooki.app.n8n.cloud/webhook/twilio-incoming` | Inbound SMS |
| `https://skooki.app.n8n.cloud/webhook/maxsam-deploy-gate` | Deployment trigger |

---

## MCP ROLE USAGE

### When to Use MCP-BUILDER
- Creating new workflows
- Modifying existing workflows
- Creating database schemas
- Updating MCP prompts

**Invocation:** Paste the MCP-BUILDER prompt from `/prompts/mcp-builder.md`

### When to Use MCP-TESTER
- Validating workflow JSON before commit
- Checking schema compliance
- Verifying safety constraints

**Invocation:** Paste the MCP-TESTER prompt from `/prompts/mcp-tester.md`

### When to Use MCP-DEPLOYER
- After CI tests pass
- Promoting candidate to production
- Never directly by Claude

**Invocation:** Trigger via n8n webhook or manual execution

---

## BUILD → TEST → DEPLOY FLOW

```
1. HUMAN requests change
   ↓
2. CLAUDE (MCP-BUILDER) generates candidate artifact
   ↓
3. HUMAN reviews and commits to GitHub
   ↓
4. CI RUNNER executes regression tests
   ↓
5. TEST RESULTS logged to Supabase
   ↓
6. IF PASS: MCP-DEPLOYER activates production
   IF FAIL: Block and report failures
   ↓
7. GITHUB tagged with release version
   ↓
8. TELEGRAM notification sent
```

---

## FILE INVENTORY

### Workflows (JSON)
- `/mnt/user-data/outputs/maxsam-v4-master-workflow.json` - Production pipeline
- `/mnt/user-data/outputs/maxsam-mcp-deployer-gate.json` - Deployment gate

### Database Schemas (SQL)
- `/mnt/user-data/outputs/maxsam-supabase-schema.sql` - Core tables
- `/mnt/user-data/outputs/maxsam-cicd-schema.sql` - CI/CD tables

### Documentation (MD)
- `/mnt/user-data/outputs/maxsam-v4-workflow-docs.md` - Workflow documentation
- `/mnt/user-data/outputs/maxsam-mcp-roles.md` - MCP role definitions
- `/mnt/user-data/outputs/maxsam-ci-strategy.md` - CI strategy
- `/mnt/user-data/outputs/maxsam-github-wiring.md` - GitHub integration
- `/mnt/user-data/outputs/maxsam-validation-loop.md` - Claude+GitHub loop

### Test Definitions (JSON)
- `/mnt/user-data/outputs/maxsam-unit-tests.json` - Unit test definitions

---

## CRITICAL INVARIANTS

### Gemini Extractor Output MUST Have:
- cause_number (string, non-empty)
- owner_name (string, non-empty)
- property_address (string, non-empty)
- excess_amount (number, > 0)
- county (string, non-empty)
- expiry_date (string, ISO date format)

### ELEANOR Scoring MUST:
- Return score 0-100 (integer)
- Return tier in [A+, A, B+, B, C, D]
- Set ready_for_outreach = TRUE only if score >= 40 AND phone exists

### SAM Outreach MUST:
- Return sms_script (string, max 160 chars)
- Return email_subject (string)
- Return email_body (string)
- Return voice_script (string)

### Classifier MUST:
- Return classification in allowed list only
- Allowed: INTERESTED, NOT_INTERESTED, SKEPTICAL, CONFUSED, APPOINTMENT, WRONG_NUMBER, DO_NOT_CONTACT, OTHER

### DRY_RUN MUST:
- Prevent real Twilio sends when true
- Be checked BEFORE any external action

---

## ROLLBACK PROCEDURE

```sql
-- 1. Find previous version
SELECT version_tag, n8n_workflow_id 
FROM workflow_versions 
WHERE workflow_key = 'maxsam_pipeline' 
  AND status = 'rollback'
ORDER BY deployed_at DESC 
LIMIT 1;

-- 2. Deactivate current (via n8n API)
-- 3. Activate previous (via n8n API)

-- 4. Update status
UPDATE workflow_versions 
SET status = 'deployed' 
WHERE version_tag = '<previous_version>';

UPDATE workflow_versions 
SET status = 'rollback' 
WHERE version_tag = '<current_version>';

-- 5. Log rollback
INSERT INTO deploy_logs (workflow_key, version_tag, run_id, deployed, deployment_type, notes)
VALUES ('maxsam_pipeline', '<previous_version>', 'rollback_' || NOW(), true, 'rollback', 'Emergency rollback');
```

---

## MONITORING QUERIES

### Check Latest Test Run
```sql
SELECT * FROM test_runs 
WHERE workflow_key = 'maxsam_pipeline' 
ORDER BY finished_at DESC 
LIMIT 1;
```

### Check Recent Failures
```sql
SELECT * FROM v_recent_test_failures 
LIMIT 20;
```

### Check Deployment History
```sql
SELECT * FROM v_deployment_history 
LIMIT 10;
```

### Check Pipeline Metrics
```sql
SELECT * FROM get_pipeline_metrics();
```

---

## SUPPORT CONTACTS

- **System Owner:** Logan (MaxSam Recovery Services)
- **n8n Instance:** skooki.app.n8n.cloud
- **Supabase Project:** (configure in credentials)

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-12 | Initial production release |

---

## APPENDIX: QUICK START

### Run Tests Now
1. Open n8n: https://skooki.app.n8n.cloud
2. Find workflow: "MaxSam - CI Regression Test Runner"
3. Click "Execute Workflow"
4. Check Telegram for results

### Deploy New Version
1. Ensure tests have passed
2. POST to webhook:
```bash
curl -X POST https://skooki.app.n8n.cloud/webhook/maxsam-deploy-gate \
  -H "Content-Type: application/json" \
  -d '{"workflow_key": "maxsam_pipeline", "version_tag": "candidate-YYYYMMDD"}'
```

### Emergency Stop
1. Open n8n
2. Deactivate "MaxSam V4 - Master Pipeline"
3. Investigate logs in Supabase
