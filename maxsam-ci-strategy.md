# MAXSAM CI REGRESSION STRATEGY
# Version: 1.0.0
# Status: CANONICAL

## OVERVIEW

Every change to MaxSam infrastructure MUST pass regression tests before deployment.
This document defines HOW tests work, WHAT they validate, and WHEN they run.

---

## 1. TEST ARCHITECTURE

### Test Hierarchy
```
┌─────────────────────────────────────────────────────────────┐
│                    TEST PYRAMID                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                      ▲ E2E Tests                             │
│                     ╱ ╲ (Full pipeline)                      │
│                    ╱   ╲ ~5 tests                            │
│                   ╱─────╲                                    │
│                  ╱       ╲                                   │
│                 ╱Integration╲                                │
│                ╱   Tests     ╲                               │
│               ╱   ~10 tests   ╲                              │
│              ╱─────────────────╲                             │
│             ╱                   ╲                            │
│            ╱    Unit Tests       ╲                           │
│           ╱    (Per node)         ╲                          │
│          ╱      ~27 tests          ╲                         │
│         ╱───────────────────────────╲                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Test Types

| Type | Scope | Count | Blocking? |
|------|-------|-------|-----------|
| Unit | Single node logic | 27+ | BLOCKER |
| Integration | Multi-node flow | 10+ | BLOCKER |
| E2E | Full pipeline | 5+ | BLOCKER |
| Smoke | Quick sanity | 3 | WARN |

---

## 2. NODE-BY-NODE UNIT TESTS

### Node 1-3: Triggers
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Cron fires | Time trigger | Returns execution context | INFO |
| Webhook responds | POST request | Returns 200 + context | BLOCKER |
| Merge combines | Both triggers | Single output stream | BLOCKER |

### Node 4: ALEX Gemini Lead Extractor
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Schema output | Sample PDF text | Has: cause_number, owner_name, property_address, excess_amount, county | BLOCKER |
| Amount positive | Any input | excess_amount > 0 | BLOCKER |
| JSON valid | Any input | Response is valid JSON array | BLOCKER |
| Handles empty | Empty doc | Returns empty array, no crash | WARN |

**Fixture:**
```json
{
  "document_text": "CAUSE NO: 2024-TX-12345\nOWNER: John Smith\nADDRESS: 123 Main St, Dallas, TX\nAMOUNT: $47,892.33\nCOUNTY: Dallas\nDEADLINE: 2025-06-15"
}
```

**Expected Output Schema:**
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "required": ["cause_number", "owner_name", "property_address", "excess_amount", "county"],
    "properties": {
      "cause_number": {"type": "string", "minLength": 1},
      "owner_name": {"type": "string", "minLength": 1},
      "property_address": {"type": "string", "minLength": 1},
      "excess_amount": {"type": "number", "minimum": 0.01},
      "county": {"type": "string", "minLength": 1}
    }
  }
}
```

### Node 5: Parse Gemini Response
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Returns array | Gemini response | typeof result === 'array' | BLOCKER |
| Strips markdown | ```json wrapped | Clean JSON output | BLOCKER |
| Adds metadata | Any input | _extracted_at timestamp present | BLOCKER |
| Handles malformed | Bad JSON | Error object, not crash | WARN |

### Node 6: Check Duplicate Lead
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Query structure | cause_number | SQL WHERE cause_number = X | BLOCKER |
| Null handling | null cause_number | Rejects/errors, not query | BLOCKER |
| Returns array | Valid query | Array (empty or matches) | BLOCKER |

### Node 7: New Lead Check
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Empty → INSERT | [] | Routes to Insert node | BLOCKER |
| Match → UPDATE | [{id: X}] | Routes to Update node | BLOCKER |
| No double-fire | Any | Only ONE path taken | BLOCKER |

### Node 8-9: Insert/Update Lead
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Insert succeeds | New lead | Returns ID | BLOCKER |
| Update succeeds | Existing lead | rows_affected >= 1 | BLOCKER |
| Upsert safe | Conflict | No duplicate error | BLOCKER |

### Node 10: ALEX SerpAPI Search
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Query format | Name + address | Includes 'phone' keyword | WARN |
| API responds | Valid query | organic_results array | WARN |
| Timeout handled | Slow API | Graceful degradation | WARN |

### Node 11: ALEX Browserless Skip Trace
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Returns HTML | Valid name | content.length > 100 | WARN |
| Timeout handled | Blocked site | Empty result, not crash | WARN |
| URL encoded | Special chars | Proper encoding | BLOCKER |

### Node 12: ALEX Extract Contact Info
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Phone regex | HTML with phones | Extracts 10-digit numbers | BLOCKER |
| Email regex | HTML with emails | Valid email format | BLOCKER |
| Deduplication | Duplicate phones | Unique array | BLOCKER |
| Primary assignment | Multiple phones | primary_phone = phones[0] | BLOCKER |

### Node 13: Update Contact Info
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| JSONB storage | phones array | Stored as JSONB | BLOCKER |
| Skip trace status | found/not_found | Valid enum value | BLOCKER |

### Node 14: ELEANOR Priority Scoring (CRITICAL)
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Score range | Any lead | 0 <= score <= 100 | BLOCKER |
| Tier valid | Any score | tier IN (A+,A,B+,B,C,D) | BLOCKER |
| Amount scoring | $50K lead | +25 points | BLOCKER |
| Contact scoring | Phone+Email | +25 points | BLOCKER |
| Urgency scoring | 7 days left | +25 points | BLOCKER |
| Golden bonus | is_golden=true | +25 points | BLOCKER |
| Ready logic | score>=40 AND phone | ready_for_outreach=true | BLOCKER |

**Test Matrix:**
```
| Amount | Phone | Email | Expiry | Golden | Expected Score | Expected Tier |
|--------|-------|-------|--------|--------|----------------|---------------|
| $50K+  | Yes   | Yes   | ≤14d   | Yes    | 100            | A+            |
| $50K+  | Yes   | Yes   | ≤14d   | No     | 75             | A             |
| $25K   | Yes   | No    | ≤30d   | No     | 62             | B+            |
| $10K   | Yes   | No    | None   | No     | 35             | C             |
| $3K    | No    | No    | None   | No     | 5              | D             |
```

### Node 15: Update Lead Score
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Persists score | Valid score | Stored in DB | BLOCKER |
| JSONB factors | Array | scoring_factors as JSONB | BLOCKER |

### Node 16: Ready for Outreach
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Gates correctly | ready=true | Routes to SAM | BLOCKER |
| Blocks correctly | ready=false | Skips outreach | BLOCKER |
| Phone required | score=50, no phone | ready=false | BLOCKER |

### Node 17: Critical Priority Check
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Triggers alert | score >= 85 | Routes to Critical Alert | BLOCKER |
| No false alert | score < 85 | Does NOT alert | BLOCKER |

### Node 18: SAM Claude Generate Outreach (CRITICAL)
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| JSON keys | Any lead | Has: sms_script, email_subject, email_body, voice_script | BLOCKER |
| Personalized | Lead with name | Uses owner_name in output | WARN |
| Amount included | Lead with amount | Uses excess_amount | WARN |

### Node 19: Parse SAM Response (CRITICAL)
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| SMS max length | 200 char SMS | Truncated to ≤160 | BLOCKER |
| Preserves meaning | Long SMS | Truncates at word boundary | WARN |
| Fallback works | Parse error | Uses template | BLOCKER |

### Node 20: Twilio Send SMS
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| DRY_RUN safe | dry_run=true | Does NOT send real SMS | BLOCKER |
| E.164 format | Phone number | +1XXXXXXXXXX format | BLOCKER |
| Returns SID | Successful send | message.sid exists | BLOCKER |
| Retry logic | Failure | Retries up to 3x | WARN |

### Node 21-22: Logging
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Logs outreach | Sent SMS | outreach_log row created | BLOCKER |
| Updates lead | After send | status='contacted' | BLOCKER |

### Node 23-24: Telegram Notifications
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Standard notify | Any send | Message delivered | WARN |
| Critical alert | Score ≥85 | CRITICAL header in message | BLOCKER |

### Node 25: Webhook Twilio Incoming
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Parses payload | Twilio POST | Extracts From, Body | BLOCKER |
| Handles empty | Empty body | Does not crash | WARN |

### Node 26: SAM Classify Response (CRITICAL)
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Valid labels | Any response | classification IN allowed | BLOCKER |
| Confidence range | Any response | 0 <= confidence <= 100 | BLOCKER |
| DO_NOT_CONTACT | "STOP" message | Correctly classified | BLOCKER |
| INTERESTED | "Yes tell me more" | Correctly classified | WARN |

**Allowed Classifications:**
- INTERESTED
- NOT_INTERESTED
- SKEPTICAL
- CONFUSED
- APPOINTMENT
- WRONG_NUMBER
- DO_NOT_CONTACT
- OTHER

### Node 27: Log SMS Response
| Test | Input | Assertion | Severity |
|------|-------|-----------|----------|
| Creates record | Classified response | sms_responses row | BLOCKER |

---

## 3. TEST EXECUTION FLOW

### Trigger Conditions
| Event | Test Suite | Blocking? |
|-------|------------|-----------|
| Manual trigger | Full suite | YES |
| Pre-deployment | Full suite | YES |
| Scheduled (daily) | Full suite | NO (report only) |
| Post-deployment | Smoke tests | NO (rollback if fail) |

### Execution Sequence
```
1. Initialize test run
   └─ Generate run_id
   └─ Create test_runs row (status='running')

2. Load test catalog
   └─ Unit tests (27)
   └─ Integration tests (10)
   └─ E2E tests (5)

3. Execute tests sequentially
   └─ For each test:
       ├─ Load fixture
       ├─ Execute test logic
       ├─ Validate assertions
       ├─ Log result to test_logs
       └─ Accumulate failures

4. Complete test run
   └─ Calculate totals
   └─ Update test_runs (status, can_deploy)
   └─ Send notification

5. Gate decision
   └─ blocker_failures = 0 → PASS
   └─ blocker_failures > 0 → FAIL (block deployment)
```

---

## 4. FAILURE HANDLING

### Blocker Failures
- Immediately block deployment
- Alert via Telegram
- Log exact failure details
- Require human review

### Warning Failures
- Do NOT block deployment
- Log for review
- Include in report
- May indicate degraded functionality

### Info Failures
- Informational only
- Log for metrics
- No action required

---

## 5. ROLLBACK PROCEDURE

If post-deployment smoke tests fail:

```
1. Detect failure
   └─ Smoke test returns FAIL

2. Trigger rollback
   └─ n8n workflow: MCP-DEPLOYER-ROLLBACK

3. Identify previous version
   └─ Query workflow_versions WHERE status='rollback'
   └─ Order by deployed_at DESC
   └─ Select first

4. Execute rollback
   └─ Deactivate current workflow
   └─ Activate previous version
   └─ Update workflow_versions status

5. Notify
   └─ Telegram: ROLLBACK EXECUTED
   └─ Include failure reason

6. Log
   └─ deploy_logs: deployment_type='rollback'
```

---

## 6. TEST DATA ISOLATION

### Test Schema
All tests MUST use isolated data:
- Test fixtures are static/known
- Test database operations use transactions
- Real production data is NEVER used in tests

### DRY_RUN Enforcement
```javascript
// Every external call must check
if (context.dry_run === true) {
  // Return mock response
  return { status: 'test_mode', sid: 'SM_TEST_' + Date.now() };
}
// Otherwise make real call
```

---

## 7. METRICS & REPORTING

### Per-Run Metrics
- Total tests executed
- Pass count
- Fail count (by severity)
- Execution time
- Blocker failure details

### Aggregate Metrics
- Pass rate over time
- Most common failures
- Average execution time
- Deployment success rate

### Dashboard Views
```sql
-- Recent test results
SELECT * FROM v_test_summary ORDER BY started_at DESC LIMIT 10;

-- Recent failures
SELECT * FROM v_recent_test_failures;

-- Deployment history
SELECT * FROM v_deployment_history;
```

---

## VERSION HISTORY

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-01-12 | Initial canonical strategy |
