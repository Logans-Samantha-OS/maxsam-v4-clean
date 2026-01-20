# Phase 2 Risk Matrix

## MaxSam V4 - Controlled Autonomy Risk Assessment

**Document Status:** DESIGN ONLY - NOT ACTIVATED
**Last Updated:** 2026-01-20

---

## 1. Risk Categories

### 1.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|------|------------|--------|------------|---------------|
| False positive intent detection | Medium | Medium | Confidence thresholds, human escalation | Low |
| False negative opt-out detection | Low | Critical | 95% confidence requirement, keyword matching | Very Low |
| Rate limit bypass | Very Low | High | Database-enforced limits, circuit breaker | Very Low |
| Kill switch failure | Very Low | Critical | Multiple redundant checks, default-deny | Minimal |
| Database unavailable | Low | High | Default to disabled state, graceful degradation | Low |

### 1.2 Compliance Risks

| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|------|------------|--------|------------|---------------|
| TCPA violation (wrong time) | Low | Critical | Business hours validator, timezone check | Very Low |
| Contacting opted-out lead | Very Low | Critical | Pre-action opt-out check, immediate processing | Minimal |
| Over-contacting lead | Low | Medium | Per-lead rate limits, cooldown periods | Low |
| Sending to wrong number | Low | High | Data validation, phone format check | Low |

### 1.3 Business Risks

| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|------|------------|--------|------------|---------------|
| Inappropriate message sent | Low | High | Sentiment check, template-only responses | Low |
| Lost high-value lead | Medium | High | High-value escalation, human review | Medium |
| Competitor mentioned in response | Low | Medium | Entity extraction, escalation trigger | Low |
| Negative PR from automation | Very Low | High | Dry-run mode, gradual rollout | Low |

### 1.4 Operational Risks

| Risk | Likelihood | Impact | Mitigation | Residual Risk |
|------|------------|--------|------------|---------------|
| System runs unchecked | Very Low | Critical | Self-pause logic, monitoring alerts | Minimal |
| Audit trail incomplete | Low | High | Pre-action logging, append-only audit | Very Low |
| Rollback impossible | N/A | Medium | Acknowledge limitation, prevent irreversible actions without confirmation | Low |
| Cost overrun (API usage) | Low | Medium | Rate limits, daily caps | Low |

---

## 2. Risk Scoring Formula

```
RISK_SCORE = (Likelihood × Impact) / Mitigations

Where:
- Likelihood: 1 (Very Low) to 5 (Very High)
- Impact: 1 (Minimal) to 5 (Critical)
- Mitigations: 1 (None) to 5 (Comprehensive)
```

### Risk Thresholds

| Score | Level | Action Required |
|-------|-------|-----------------|
| < 2 | Acceptable | Monitor |
| 2-4 | Moderate | Additional controls recommended |
| 4-8 | High | Mitigation required before activation |
| > 8 | Critical | Do not activate |

---

## 3. Action-Specific Risk Assessment

### 3.1 Send SMS (Autonomous)

| Factor | Assessment |
|--------|------------|
| **Risk Level** | MEDIUM |
| **Reversible** | NO |
| **Confidence Required** | 85% |
| **Autonomy Level** | 3 (Full Auto) |
| **Rate Limit** | 1/lead/4h, 50/global/h |
| **Validators** | 10 pre-action checks |

**Specific Risks:**
- Sending at wrong time → Business hours check
- Wrong message tone → Sentiment validation
- Over-contact → Rate limit + cooldown
- Opt-out violation → Pre-send opt-out check

**Risk Score:** 3.2 (Acceptable with current mitigations)

### 3.2 Schedule Callback (Autonomous)

| Factor | Assessment |
|--------|------------|
| **Risk Level** | LOW |
| **Reversible** | YES (can cancel) |
| **Confidence Required** | 70% |
| **Autonomy Level** | 2 (Safe) |
| **Rate Limit** | 1/lead/24h, 20/global/h |
| **Validators** | 8 pre-action checks |

**Specific Risks:**
- Scheduling unwanted callback → Explicit callback_request intent required
- Wrong time scheduled → Business hours enforcement

**Risk Score:** 1.8 (Acceptable)

### 3.3 Generate Contract (Autonomous)

| Factor | Assessment |
|--------|------------|
| **Risk Level** | HIGH |
| **Reversible** | NO (once sent) |
| **Confidence Required** | 90% |
| **Autonomy Level** | 3 (Full Auto) |
| **Rate Limit** | 1/lead/7d, 10/global/d |
| **Validators** | 12 pre-action checks |

**Specific Risks:**
- Wrong contract type → Data completeness check
- Premature contract → High confidence + positive sentiment required
- Legal exposure → Human escalation for edge cases

**Risk Score:** 5.1 (Requires additional controls - PHASE 2.5)

### 3.4 Update Status (Autonomous)

| Factor | Assessment |
|--------|------------|
| **Risk Level** | VERY LOW |
| **Reversible** | YES |
| **Confidence Required** | 60% |
| **Autonomy Level** | 1 (Read-Only+) |
| **Rate Limit** | 5/lead/h, 200/global/h |
| **Validators** | 5 pre-action checks |

**Specific Risks:**
- Incorrect status → Audit trail allows review
- Lost information → Previous state logged

**Risk Score:** 0.8 (Acceptable)

---

## 4. Escalation Risk Matrix

### When to Escalate vs. Auto-Execute

| Condition | Confidence | Sentiment | Recommendation |
|-----------|------------|-----------|----------------|
| Clear positive intent | > 85% | > 0.3 | Auto-execute |
| Positive but uncertain | 70-85% | > 0 | Auto-execute with logging |
| Neutral | 50-70% | -0.3 to 0.3 | Hold for review |
| Uncertain | < 50% | Any | Escalate |
| Negative sentiment | Any | < -0.3 | Escalate |
| Very negative | Any | < -0.5 | Escalate (priority) |
| High value lead | Any | Any | Flag for review |
| Legal/threat mention | Any | Any | Block + escalate |

---

## 5. Failure Mode Analysis

### 5.1 Single Point of Failure Analysis

| Component | Failure Mode | Impact | Backup |
|-----------|--------------|--------|--------|
| Supabase | Unavailable | System stops | Default to disabled |
| system_config table | Corrupted | System stops | Default values + alert |
| governance_gates | Missing | System stops | Default to closed |
| autonomy_decisions | Write failure | Lost audit | Log to file fallback |
| Twilio | API failure | SMS not sent | Retry with backoff |

### 5.2 Cascading Failure Prevention

1. **Circuit Breaker:** Self-pause after 10 errors/hour
2. **Rate Limiting:** Hard caps prevent runaway execution
3. **Kill Switch:** Immediate halt at any time
4. **Audit Trail:** Every action logged before execution

---

## 6. Monitoring & Alerting

### Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|-------------------|-------------------|--------|
| Error rate | > 5% | > 10% | Self-pause |
| Escalation rate | > 15% | > 25% | Review thresholds |
| Opt-out rate | > 2/hour | > 5/hour | Self-pause |
| Response time | > 5s | > 10s | Alert |
| Queue depth | > 50 | > 100 | Throttle |

### Alert Channels

1. **Telegram (Logan):** All critical alerts, daily summary
2. **Dashboard:** Real-time metrics visible
3. **Audit Log:** Complete history for review

---

## 7. Acceptance Criteria

### Before Phase 2 Activation:

- [ ] All HIGH risk items have additional controls
- [ ] All CRITICAL risk items score < 4
- [ ] Self-pause logic tested
- [ ] Kill switch tested
- [ ] Dry-run mode produces expected decisions
- [ ] Telegram alerts configured
- [ ] Dashboard shows Phase 2 metrics
- [ ] Weekly audit review process defined

### During Phase 2 Operation:

- [ ] Error rate < 5%
- [ ] Escalation rate < 20%
- [ ] Opt-out rate < 3/day
- [ ] No compliance incidents
- [ ] Daily audit review

---

*This risk matrix should be reviewed weekly during initial Phase 2 operation.*
