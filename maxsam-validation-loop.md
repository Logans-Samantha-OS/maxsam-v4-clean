# CLAUDE + GITHUB VALIDATION LOOP
# Version: 1.0.0
# Status: CANONICAL

## CORE PRINCIPLE

```
Claude has NO persistent memory.
GitHub IS the memory.
Tests ARE the validation.
```

---

## 1. THE VALIDATION LOOP

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CLAUDE + GITHUB VALIDATION LOOP                          │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────────┐
     │                                                                   │
     │  1. READ                                                          │
     │     Claude reads artifacts from GitHub                            │
     │     (workflow JSON, node map, schemas, prompts)                   │
     │                                                                   │
     └───────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │                                                                   │
     │  2. VALIDATE (MCP-TESTER mode)                                    │
     │     Claude validates artifacts against invariants                 │
     │     Returns: PASS or FAIL with specifics                          │
     │                                                                   │
     └───────────────────────────┬───────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
            ┌───────────┐             ┌───────────┐
            │   PASS    │             │   FAIL    │
            └─────┬─────┘             └─────┬─────┘
                  │                         │
                  │                         ▼
                  │               ┌──────────────────┐
                  │               │                  │
                  │               │  3. FIX          │
                  │               │  Claude (BUILDER)│
                  │               │  generates fix   │
                  │               │                  │
                  │               └────────┬─────────┘
                  │                        │
                  │                        ▼
                  │               ┌──────────────────┐
                  │               │                  │
                  │               │  4. COMMIT       │
                  │               │  Human/Automation│
                  │               │  commits to Git  │
                  │               │                  │
                  │               └────────┬─────────┘
                  │                        │
                  │                        ▼
                  │               ┌──────────────────┐
                  │               │                  │
                  │               │  5. RE-VALIDATE  │
                  │               │  Loop back to 1  │
                  │               │                  │
                  │               └────────┬─────────┘
                  │                        │
                  └────────────────────────┘
                                 │
                                 ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │                                                                   │
     │  6. TEST (n8n CI Runner)                                          │
     │     Automated regression tests execute                            │
     │     Results logged to Supabase                                    │
     │                                                                   │
     └───────────────────────────┬───────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
            ┌───────────┐             ┌───────────┐
            │   PASS    │             │   FAIL    │
            └─────┬─────┘             └─────┬─────┘
                  │                         │
                  ▼                         ▼
     ┌──────────────────┐        ┌──────────────────┐
     │                  │        │                  │
     │  7. DEPLOY       │        │  BLOCK           │
     │  n8n activates   │        │  Return to 3     │
     │  production      │        │                  │
     └────────┬─────────┘        └──────────────────┘
              │
              ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │                                                                   │
     │  8. TAG RELEASE                                                   │
     │     GitHub release created                                        │
     │     Version incremented                                           │
     │                                                                   │
     └──────────────────────────────────────────────────────────────────┘
```

---

## 2. STEP-BY-STEP PROTOCOL

### Step 1: READ (Human + Claude)

**Human Action:**
```
1. Navigate to GitHub repository
2. Copy relevant file(s) content
3. Paste into Claude session with role prompt
```

**Alternative (with tools):**
```
1. Claude uses file reading tool
2. Reads from local clone of repo
3. Never writes back
```

**What Claude Reads:**
- /workflows/production/maxsam-pipeline.json
- /docs/node-map.md
- /tests/invariants/schema-invariants.json
- /prompts/mcp-tester.md (for validation mode)

### Step 2: VALIDATE (Claude as MCP-TESTER)

**Invocation:**
```
You are MCP-TESTER for MaxSam.

Here is the candidate workflow JSON:
[paste JSON]

Here is the node map specification:
[paste node map]

Here are the required invariants:
[paste invariants]

Validate now. Return PASS or FAIL with specifics.
```

**Claude Output (PASS):**
```
PASS

Validation Summary:
✓ All 27 nodes present
✓ All nodes connected
✓ All branches wired correctly
✓ Schema invariants satisfied
✓ DRY_RUN flag present
✓ No hardcoded credentials

Artifact is eligible for CI testing.
```

**Claude Output (FAIL):**
```
FAIL

1. Node 14 (ELEANOR Priority Scoring): Missing tier 'B+' in tier assignment
   Fix: Add condition `else if (score >= 55) tier = 'B+';`

2. Node 19 (Parse SAM Response): SMS truncation uses 157 chars, not 160
   Fix: Change `substring(0, 157)` to `substring(0, 160)`

3. Node 20 (Twilio Send SMS): Missing DRY_RUN check
   Fix: Add condition `if (!context.dry_run) { sendSMS(); }`
```

### Step 3: FIX (Claude as MCP-BUILDER)

**Invocation (only after FAIL):**
```
You are MCP-BUILDER for MaxSam.

The following validation failures were reported:
[paste FAIL output]

Here is the current workflow JSON:
[paste JSON]

Produce a corrected version that addresses all failures.
Do NOT change anything else.
```

**Claude Output:**
```
CORRECTED WORKFLOW JSON:
[complete JSON with fixes]

CHANGES MADE:
1. Node 14: Added tier 'B+' condition at line XXX
2. Node 19: Changed truncation to 160 chars at line XXX
3. Node 20: Added DRY_RUN guard at line XXX

CHECKSUM: sha256:abc123...
```

### Step 4: COMMIT (Human or Automation)

**Human Action:**
```bash
# Save Claude's output to file
vim workflows/candidates/maxsam-pipeline-candidate-20260112.json
# Paste corrected JSON

# Commit
git add workflows/candidates/
git commit -m "[WORKFLOW] Fix validation failures: B+ tier, SMS truncation, DRY_RUN"
git push origin develop
```

**Automation Action (n8n):**
```
1. Receive corrected JSON via webhook
2. Base64 encode content
3. POST to GitHub API:
   PUT /repos/owner/maxsam-v4/contents/workflows/candidates/...
   {
     "message": "[WORKFLOW] Automated fix commit",
     "content": "<base64 JSON>",
     "branch": "develop"
   }
```

### Step 5: RE-VALIDATE (Loop)

After commit, return to Step 1:
- Read new version from GitHub
- Validate again
- Repeat until PASS

### Step 6: TEST (n8n CI Runner)

**Trigger:**
- Webhook on GitHub push to develop
- Or: Manual trigger in n8n

**Execution:**
```
1. CI Runner workflow activates
2. Imports candidate from GitHub
3. Executes all unit tests
4. Executes integration tests
5. Logs results to test_logs
6. Updates test_runs with summary
```

**Output:**
- test_runs.status = 'passed' OR 'failed'
- test_runs.can_deploy = TRUE OR FALSE
- Telegram notification sent

### Step 7: DEPLOY (n8n MCP-DEPLOYER)

**Condition:**
```sql
SELECT can_deploy FROM test_runs 
WHERE workflow_key = 'maxsam_pipeline' 
  AND version_tag = 'candidate-20260112'
ORDER BY finished_at DESC LIMIT 1;
-- Must return TRUE
```

**Execution:**
```
1. Verify can_deploy = TRUE
2. Deactivate current production workflow
3. Import candidate as new production
4. Activate new production workflow
5. Update workflow_versions status = 'deployed'
6. Create deploy_logs record
7. Move candidate to production/ in GitHub
```

### Step 8: TAG RELEASE (GitHub)

**Action:**
```bash
git tag v1.0.1 -m "Fix validation failures: B+ tier, SMS truncation, DRY_RUN"
git push origin v1.0.1
```

**Automation:**
```
POST /repos/owner/maxsam-v4/releases
{
  "tag_name": "v1.0.1",
  "name": "v1.0.1 - Validation Fixes",
  "body": "Fixed: B+ tier, SMS truncation, DRY_RUN guard"
}
```

---

## 3. MEMORY ISOLATION RULES

### What Claude CANNOT Do
| Action | Reason |
|--------|--------|
| Remember previous sessions | No persistent memory |
| Claim to have deployed | It cannot deploy |
| Reference "last time" | Session isolation |
| Store state internally | No persistence |
| Trust its own output | Must re-validate |

### What Claude MUST Do
| Action | Reason |
|--------|--------|
| Re-read specs every session | No memory assumption |
| Request current GitHub state | Source of truth |
| Produce complete artifacts | No incremental trust |
| Output checksums | Verification |
| Declare unknowns explicitly | No guessing |

---

## 4. VALIDATION CHECKPOINTS

### Before Build
- [ ] Node map provided
- [ ] Schema invariants provided
- [ ] Current production JSON available
- [ ] MCP-BUILDER prompt active

### Before Test
- [ ] Candidate committed to GitHub
- [ ] MCP-TESTER returned PASS
- [ ] No blocking TODOs declared
- [ ] Checksum recorded

### Before Deploy
- [ ] CI tests completed
- [ ] can_deploy = TRUE
- [ ] blocker_failures = 0
- [ ] Human approval (optional)

### After Deploy
- [ ] Smoke tests pass
- [ ] deploy_logs record created
- [ ] workflow_versions updated
- [ ] GitHub release tagged

---

## 5. FAILURE RECOVERY

### Scenario: Validation Loop Stuck (3+ cycles)

**Symptoms:**
- Same failures keep recurring
- Claude cannot produce correct fix

**Resolution:**
```
1. Stop automation
2. Human reviews failure list
3. Human makes manual corrections
4. Human commits directly
5. Resume validation
```

### Scenario: CI Passes but Production Fails

**Symptoms:**
- can_deploy = TRUE but production errors

**Resolution:**
```
1. Trigger immediate rollback
2. Review test coverage gaps
3. Add regression test for failure case
4. Fix workflow
5. Re-run full validation loop
```

### Scenario: GitHub Desync

**Symptoms:**
- n8n workflow differs from GitHub

**Resolution:**
```
1. Export current n8n workflow
2. Compare with GitHub version
3. Determine correct version
4. Either:
   a. Import GitHub version to n8n
   b. Commit n8n version to GitHub
5. Add sync verification check
```

---

## 6. AUDIT TRAIL

### Every Validation Produces
| Artifact | Location | Contents |
|----------|----------|----------|
| Validation report | Claude output | PASS/FAIL + details |
| Commit | GitHub | File changes |
| Test results | Supabase test_logs | Per-test outcomes |
| Deploy log | Supabase deploy_logs | Deployment record |
| Release tag | GitHub releases | Version bundle |

### Query: Full History of a Version
```sql
-- Get all test runs for a version
SELECT * FROM test_logs 
WHERE version_tag = 'candidate-20260112'
ORDER BY started_at;

-- Get deployment attempts
SELECT * FROM deploy_logs
WHERE version_tag = 'candidate-20260112';

-- Get final status
SELECT * FROM workflow_versions
WHERE version_tag = 'candidate-20260112';
```

---

## VERSION HISTORY

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-01-12 | Initial canonical loop |
