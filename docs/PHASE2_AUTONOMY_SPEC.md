# Phase 2 Autonomy Specification

## MaxSam V4 - Controlled Autonomy Design

**Status:** DESIGN ONLY - NOT ACTIVATED
**Created:** 2026-01-20
**Author:** Claude Code (Opus 4.5)
**Approval Required:** Explicit authorization before activation

---

## 1. Autonomy Decision Math

### 1.1 Confidence Thresholds

| Action Type | Min Confidence | Min Sentiment | Min Data Completeness | Autonomy Level Required |
|-------------|----------------|---------------|----------------------|------------------------|
| Log Only (Phase 1) | 0.0 | Any | 0% | 0 |
| Suggest Response | 0.50 | Any | 25% | 1 |
| Queue for Outreach | 0.70 | > -0.3 | 50% | 2 |
| Auto-Send SMS | 0.85 | > 0.0 | 75% | 3 |
| Generate Contract | 0.90 | > 0.3 | 90% | 3 |
| Escalate to Human | < 0.50 | < -0.5 | < 50% | Any |
| Abort/Opt-Out | 0.95 | Any | N/A | Any |

### 1.2 Action Decision Formula

```
ACTION_SCORE = (
    (confidence_score * 0.35) +
    (sentiment_normalized * 0.20) +
    (data_completeness * 0.25) +
    (intent_weight * 0.20)
) * risk_multiplier

Where:
- confidence_score: 0.0 to 1.0 (from message_intelligence)
- sentiment_normalized: -1.0 to 1.0 mapped to 0.0 to 1.0
- data_completeness: (filled_fields / required_fields)
- intent_weight: See Intent Weighting Table
- risk_multiplier: 0.5 (high risk) to 1.0 (low risk)
```

### 1.3 Intent Weighting Table

| Detected Intent | Weight | Auto-Action Allowed | Escalate |
|-----------------|--------|---------------------|----------|
| `interested` | 1.0 | Yes | No |
| `callback_request` | 0.9 | Queue only | Yes |
| `question` | 0.7 | Suggest response | Optional |
| `not_interested` | 0.3 | Update status | No |
| `opt_out` | 0.0 | IMMEDIATE OPT-OUT | No |
| `wrong_contact` | 0.0 | Mark invalid | No |
| `unknown` | 0.5 | Hold | Yes |

### 1.4 Risk Scoring

```typescript
interface RiskFactors {
  high_value_lead: boolean;     // excess_amount > $25,000
  recent_contact: boolean;      // contacted within 24h
  multiple_attempts: boolean;   // attempts > 3
  negative_history: boolean;    // previous negative sentiment
  compliance_flag: boolean;     // any TCPA/legal concern
}

function calculateRiskMultiplier(factors: RiskFactors): number {
  let multiplier = 1.0;

  if (factors.high_value_lead) multiplier *= 0.9;      // More careful
  if (factors.recent_contact) multiplier *= 0.7;       // Wait
  if (factors.multiple_attempts) multiplier *= 0.8;    // Slow down
  if (factors.negative_history) multiplier *= 0.6;     // Cautious
  if (factors.compliance_flag) multiplier *= 0.0;      // BLOCK

  return multiplier;
}
```

### 1.5 Data Completeness Calculation

```typescript
const REQUIRED_FIELDS = {
  outreach: ['owner_name', 'phone', 'property_address'],
  contract: ['owner_name', 'phone', 'email', 'property_address', 'excess_amount'],
  invoice: ['owner_name', 'email', 'excess_amount', 'contract_signed']
};

function calculateDataCompleteness(lead: Lead, actionType: string): number {
  const required = REQUIRED_FIELDS[actionType] || [];
  const filled = required.filter(field => lead[field] && lead[field] !== '');
  return filled.length / required.length;
}
```

---

## 2. Intelligence to Action Mapping (DRY RUN)

### 2.1 Message Intelligence → Execution Queue

| Intelligence State | Execution Queue Action | n8n Workflow | Sam Template |
|--------------------|----------------------|--------------|--------------|
| intent=interested, confidence>=0.85 | `send_sms` | sam-follow-up | `qualified_interest` |
| intent=callback_request, confidence>=0.70 | `schedule_callback` | sam-callback-scheduler | `callback_confirm` |
| intent=question, confidence>=0.60 | `send_sms` | sam-question-response | `answer_question` |
| intent=not_interested, confidence>=0.80 | `update_status` | lead-status-update | N/A |
| intent=opt_out, confidence>=0.90 | `opt_out_immediate` | compliance-opt-out | N/A |
| intent=wrong_contact, confidence>=0.85 | `mark_invalid` | lead-invalidate | N/A |
| intent=unknown OR confidence<0.50 | `escalate_human` | human-review-queue | N/A |

### 2.2 Action Flow Diagram

```
message_intelligence row
        │
        ▼
┌───────────────────┐
│ Check autonomy_   │
│ enabled flag      │
└───────────────────┘
        │
        ▼ (if false: STOP)
┌───────────────────┐
│ Check autonomy_   │
│ level >= required │
└───────────────────┘
        │
        ▼ (if insufficient: HOLD)
┌───────────────────┐
│ Check governance  │
│ gates (master,    │
│ sam, ralph)       │
└───────────────────┘
        │
        ▼ (if blocked: STOP)
┌───────────────────┐
│ Calculate         │
│ ACTION_SCORE      │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Route to:         │
│ - execution_queue │
│ - escalation      │
│ - hold            │
└───────────────────┘
        │
        ▼ (if queued)
┌───────────────────┐
│ RALPH picks up    │
│ and executes via  │
│ n8n workflow      │
└───────────────────┘
```

### 2.3 Proposed Execution Queue Entry Structure

```typescript
interface Phase2ExecutionEntry {
  id: string;
  lead_id: string;
  message_intelligence_id: string;  // NEW: Link to intelligence
  action_type: 'send_sms' | 'schedule_callback' | 'update_status' | 'generate_contract' | 'escalate_human';
  payload: {
    template_id?: string;
    response_text?: string;
    status_change?: string;
    escalation_reason?: string;
  };
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'held';

  // Phase 2 additions
  source: 'manual' | 'phase2_auto';
  confidence_score: number;
  risk_multiplier: number;
  action_score: number;
  requires_confirmation: boolean;
  auto_approved: boolean;
  approved_by?: 'ORION' | 'HUMAN';

  created_at: string;
  executed_at?: string;
}
```

---

## 3. ORION Phase 2 Validators

### 3.1 Pre-Action Validators

```typescript
const PHASE2_PRE_ACTION_VALIDATORS = [
  {
    name: 'AUTONOMY_FLAG_CHECK',
    check: async (action) => {
      const flag = await getSystemConfig('autonomy_enabled');
      return {
        passed: flag === true,
        reason: flag ? 'Autonomy enabled' : 'BLOCKED: autonomy_enabled = false'
      };
    }
  },
  {
    name: 'AUTONOMY_LEVEL_CHECK',
    check: async (action) => {
      const level = await getSystemConfig('autonomy_level');
      const required = ACTION_AUTONOMY_REQUIREMENTS[action.action_type];
      return {
        passed: level >= required,
        reason: level >= required
          ? `Level ${level} >= required ${required}`
          : `BLOCKED: Level ${level} < required ${required}`
      };
    }
  },
  {
    name: 'GATE_CHECK',
    check: async (action) => {
      const gates = await checkRelevantGates(action);
      return {
        passed: gates.all_open,
        reason: gates.all_open
          ? 'All gates open'
          : `BLOCKED: Gate ${gates.blocked_by} is closed`
      };
    }
  },
  {
    name: 'CONFIDENCE_THRESHOLD',
    check: (action) => {
      const threshold = ACTION_CONFIDENCE_THRESHOLDS[action.action_type];
      return {
        passed: action.confidence_score >= threshold,
        reason: action.confidence_score >= threshold
          ? `Confidence ${action.confidence_score} >= ${threshold}`
          : `BLOCKED: Confidence ${action.confidence_score} < ${threshold}`
      };
    }
  },
  {
    name: 'RISK_CHECK',
    check: (action) => {
      return {
        passed: action.risk_multiplier > 0,
        reason: action.risk_multiplier > 0
          ? `Risk multiplier ${action.risk_multiplier} acceptable`
          : 'BLOCKED: Risk multiplier is 0 (compliance flag)'
      };
    }
  },
  {
    name: 'RATE_LIMIT_CHECK',
    check: async (action) => {
      const recentActions = await countRecentActions(action.lead_id, '1 hour');
      const limit = RATE_LIMITS[action.action_type];
      return {
        passed: recentActions < limit,
        reason: recentActions < limit
          ? `Rate ${recentActions}/${limit} OK`
          : `BLOCKED: Rate limit ${recentActions}/${limit} exceeded`
      };
    }
  },
  {
    name: 'OPT_OUT_CHECK',
    check: async (action) => {
      const isOptedOut = await checkOptOutStatus(action.lead_id);
      return {
        passed: !isOptedOut,
        reason: isOptedOut
          ? 'BLOCKED: Lead has opted out'
          : 'Not opted out'
      };
    }
  },
  {
    name: 'COOLDOWN_CHECK',
    check: async (action) => {
      const lastContact = await getLastContactTime(action.lead_id);
      const cooldown = COOLDOWN_PERIODS[action.action_type];
      const elapsed = Date.now() - new Date(lastContact).getTime();
      return {
        passed: elapsed >= cooldown,
        reason: elapsed >= cooldown
          ? `Cooldown elapsed (${elapsed}ms >= ${cooldown}ms)`
          : `BLOCKED: Cooldown not elapsed (${elapsed}ms < ${cooldown}ms)`
      };
    }
  }
];
```

### 3.2 Post-Action Validators

```typescript
const PHASE2_POST_ACTION_VALIDATORS = [
  {
    name: 'DELIVERY_CONFIRMATION',
    check: async (result) => {
      if (result.action_type === 'send_sms') {
        return {
          passed: result.twilio_status === 'delivered' || result.twilio_status === 'sent',
          reason: `SMS status: ${result.twilio_status}`
        };
      }
      return { passed: true, reason: 'N/A for this action type' };
    }
  },
  {
    name: 'STATE_CONSISTENCY',
    check: async (result) => {
      const lead = await getLead(result.lead_id);
      const expectedState = EXPECTED_STATES[result.action_type];
      return {
        passed: lead.status === expectedState,
        reason: lead.status === expectedState
          ? `State consistent: ${lead.status}`
          : `INCONSISTENT: Expected ${expectedState}, got ${lead.status}`
      };
    }
  },
  {
    name: 'AUDIT_RECORDED',
    check: async (result) => {
      const auditExists = await checkAuditExists(result.execution_id);
      return {
        passed: auditExists,
        reason: auditExists
          ? 'Audit record created'
          : 'WARNING: Audit record missing'
      };
    }
  }
];
```

### 3.3 Rollback Validators

```typescript
const PHASE2_ROLLBACK_VALIDATORS = [
  {
    name: 'ROLLBACK_AVAILABLE',
    check: async (action) => {
      const canRollback = ROLLBACK_CAPABLE_ACTIONS.includes(action.action_type);
      return {
        passed: canRollback,
        reason: canRollback
          ? 'Action is rollback-capable'
          : 'Action cannot be rolled back (SMS sent, etc.)'
      };
    }
  },
  {
    name: 'PREVIOUS_STATE_STORED',
    check: async (action) => {
      const hasSnapshot = await checkStateSnapshot(action.execution_id);
      return {
        passed: hasSnapshot,
        reason: hasSnapshot
          ? 'Previous state snapshot available'
          : 'No state snapshot - rollback may be incomplete'
      };
    }
  }
];
```

### 3.4 Escalation Validators

```typescript
const PHASE2_ESCALATION_VALIDATORS = [
  {
    name: 'ESCALATION_REQUIRED',
    check: (action) => {
      const conditions = [
        action.confidence_score < 0.50,
        action.sentiment_score < -0.5,
        action.detected_intent === 'unknown',
        action.risk_multiplier < 0.5,
        action.data_completeness < 0.50
      ];
      const shouldEscalate = conditions.some(c => c);
      return {
        passed: true, // Always passes, just determines routing
        escalate: shouldEscalate,
        reason: shouldEscalate
          ? `Escalation triggered: ${conditions.filter(c => c).length} conditions met`
          : 'No escalation needed'
      };
    }
  },
  {
    name: 'HIGH_VALUE_REVIEW',
    check: async (action) => {
      const lead = await getLead(action.lead_id);
      const isHighValue = lead.excess_amount > 50000;
      return {
        passed: true,
        escalate: isHighValue,
        reason: isHighValue
          ? `HIGH VALUE ($${lead.excess_amount}) - Recommend human review`
          : 'Standard value lead'
      };
    }
  }
];
```

---

## 4. Proposed Database Changes

### 4.1 New Columns for `message_intelligence` (Phase 2)

```sql
-- MIGRATION: 20260120020000_message_intelligence_phase2.sql
-- STATUS: PREPARED - NOT EXECUTED
-- REQUIRES: explicit approval

-- Add Phase 2 columns to message_intelligence
ALTER TABLE message_intelligence
ADD COLUMN IF NOT EXISTS action_score numeric,
ADD COLUMN IF NOT EXISTS risk_multiplier numeric DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS data_completeness numeric,
ADD COLUMN IF NOT EXISTS auto_action_allowed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS escalation_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS queued_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS execution_queue_id uuid;

-- Index for Phase 2 queries
CREATE INDEX IF NOT EXISTS idx_message_intelligence_action_score
ON message_intelligence(action_score)
WHERE action_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_message_intelligence_escalation
ON message_intelligence(escalation_required)
WHERE escalation_required = true;
```

### 4.2 New Table: `autonomy_decisions`

```sql
-- Track all Phase 2 autonomy decisions
CREATE TABLE IF NOT EXISTS autonomy_decisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  message_intelligence_id uuid REFERENCES message_intelligence(id),

  -- Decision details
  decision_type text NOT NULL CHECK (decision_type IN (
    'auto_approve', 'auto_hold', 'escalate', 'block', 'rate_limit'
  )),
  action_type text NOT NULL,
  action_score numeric NOT NULL,

  -- Validator results
  validators_passed jsonb NOT NULL DEFAULT '[]',
  validators_failed jsonb NOT NULL DEFAULT '[]',

  -- Outcome
  approved boolean NOT NULL,
  approved_by text, -- 'ORION_PHASE2', 'HUMAN', etc.
  execution_queue_id uuid,

  -- Audit
  decided_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_autonomy_decisions_lead ON autonomy_decisions(lead_id);
CREATE INDEX idx_autonomy_decisions_approved ON autonomy_decisions(approved);
CREATE INDEX idx_autonomy_decisions_type ON autonomy_decisions(decision_type);
```

### 4.3 New Table: `autonomy_audit_log`

```sql
-- Immutable audit log for Phase 2 operations
CREATE TABLE IF NOT EXISTS autonomy_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN (
    'phase2_enabled', 'phase2_disabled', 'auto_action', 'escalation',
    'human_override', 'rollback', 'gate_change', 'threshold_change'
  )),
  actor text NOT NULL, -- 'ORION', 'RALPH', 'HUMAN:logan', etc.
  target_id uuid,
  target_type text,

  -- Event details
  previous_state jsonb,
  new_state jsonb,
  reason text,

  -- Immutable timestamp
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,

  -- Prevent modifications
  CONSTRAINT no_update CHECK (true)
);

-- Make truly append-only
REVOKE UPDATE, DELETE ON autonomy_audit_log FROM PUBLIC;
```

---

## 5. Feature Flag Design

### 5.1 Single Source of Truth

```sql
-- In system_config table
INSERT INTO system_config (key, value) VALUES
  ('autonomy_enabled', 'false'),
  ('phase2_active', 'false'),
  ('phase2_dry_run', 'true')
ON CONFLICT (key) DO NOTHING;
```

### 5.2 Feature Flag Hierarchy

```
system_config.autonomy_enabled = false  ← MASTER FLAG
          │
          ▼ (must be true)
system_config.phase2_active = false
          │
          ▼ (must be true)
system_config.autonomy_level >= 2
          │
          ▼ (level check)
governance_gates.master_kill_switch = false
          │
          ▼ (must be false)
governance_gates.gate_* = true
          │
          ▼ (per-action check)
EXECUTE ACTION
```

### 5.3 Flag Check Implementation

```typescript
// lib/autonomy/flags.ts

export interface AutonomyFlags {
  autonomy_enabled: boolean;
  phase2_active: boolean;
  phase2_dry_run: boolean;
  autonomy_level: 0 | 1 | 2 | 3;
  master_killed: boolean;
}

export async function getAutonomyFlags(): Promise<AutonomyFlags> {
  const supabase = createClient();

  const [configResult, gatesResult] = await Promise.all([
    supabase.from('system_config')
      .select('key, value')
      .in('key', ['autonomy_enabled', 'phase2_active', 'phase2_dry_run', 'autonomy_level']),
    supabase.from('governance_gates')
      .select('control_key, enabled')
      .eq('control_key', 'master_kill_switch')
      .single()
  ]);

  const config = Object.fromEntries(
    (configResult.data || []).map(r => [r.key, r.value])
  );

  return {
    autonomy_enabled: config.autonomy_enabled === 'true',
    phase2_active: config.phase2_active === 'true',
    phase2_dry_run: config.phase2_dry_run !== 'false', // Default true
    autonomy_level: parseInt(config.autonomy_level || '0') as 0 | 1 | 2 | 3,
    master_killed: gatesResult.data?.enabled || false
  };
}

export async function canExecuteAutonomously(actionType: string): Promise<{
  allowed: boolean;
  reason: string;
  dry_run: boolean;
}> {
  const flags = await getAutonomyFlags();

  // Check hierarchy
  if (!flags.autonomy_enabled) {
    return { allowed: false, reason: 'autonomy_enabled = false', dry_run: false };
  }

  if (!flags.phase2_active) {
    return { allowed: false, reason: 'phase2_active = false', dry_run: false };
  }

  if (flags.master_killed) {
    return { allowed: false, reason: 'Master kill switch active', dry_run: false };
  }

  const requiredLevel = ACTION_AUTONOMY_REQUIREMENTS[actionType] || 3;
  if (flags.autonomy_level < requiredLevel) {
    return {
      allowed: false,
      reason: `autonomy_level ${flags.autonomy_level} < required ${requiredLevel}`,
      dry_run: false
    };
  }

  // If dry run mode, allow but flag it
  if (flags.phase2_dry_run) {
    return { allowed: true, reason: 'Dry run mode', dry_run: true };
  }

  return { allowed: true, reason: 'All checks passed', dry_run: false };
}
```

---

## 6. Governance & Safety Controls

### 6.1 Kill Switch Behavior

```typescript
// When master_kill_switch = true:
// 1. All automation IMMEDIATELY halts
// 2. No new items enter execution_queue
// 3. Pending items are held (not deleted)
// 4. All Phase 2 decisions are blocked
// 5. Telegram alert sent to Logan
// 6. Audit log entry created

async function handleKillSwitch(triggered_by: string, reason: string) {
  const supabase = createClient();

  // 1. Set kill switch
  await supabase.from('governance_gates')
    .update({ enabled: true, disabled_by: triggered_by, disabled_reason: reason })
    .eq('control_key', 'master_kill_switch');

  // 2. Hold all pending queue items
  await supabase.from('execution_queue')
    .update({ status: 'held', held_reason: 'Kill switch activated' })
    .eq('status', 'pending');

  // 3. Disable Phase 2
  await supabase.from('system_config')
    .update({ value: 'false' })
    .eq('key', 'phase2_active');

  // 4. Create audit entry
  await supabase.from('autonomy_audit_log').insert({
    event_type: 'gate_change',
    actor: triggered_by,
    target_type: 'system',
    previous_state: { master_kill_switch: false },
    new_state: { master_kill_switch: true },
    reason
  });

  // 5. Send Telegram alert
  await sendTelegramAlert({
    type: 'EMERGENCY',
    message: `🚨 KILL SWITCH ACTIVATED by ${triggered_by}: ${reason}`
  });
}
```

### 6.2 Max Retry Limits

```typescript
const MAX_RETRIES = {
  send_sms: 3,
  schedule_callback: 2,
  generate_contract: 1,
  escalate_human: 1
};

const RETRY_DELAYS = {
  send_sms: [60000, 300000, 900000], // 1min, 5min, 15min
  schedule_callback: [300000, 900000],
  generate_contract: [600000],
  escalate_human: [0]
};
```

### 6.3 Time-Based Cooldowns

```typescript
const COOLDOWN_PERIODS = {
  // Per-lead cooldowns (in milliseconds)
  send_sms: 4 * 60 * 60 * 1000,        // 4 hours between SMS
  schedule_callback: 24 * 60 * 60 * 1000, // 24 hours
  generate_contract: 7 * 24 * 60 * 60 * 1000, // 7 days

  // Global rate limits (per hour)
  global_sms_per_hour: 50,
  global_contracts_per_day: 10
};

const BUSINESS_HOURS = {
  start: 9,  // 9 AM
  end: 20,   // 8 PM
  timezone: 'America/Chicago'
};
```

### 6.4 Human Escalation Triggers

```typescript
const ESCALATION_TRIGGERS = [
  // Automatic escalation conditions
  { condition: 'confidence < 0.50', action: 'escalate', priority: 'high' },
  { condition: 'sentiment < -0.5', action: 'escalate', priority: 'high' },
  { condition: 'intent = unknown', action: 'escalate', priority: 'medium' },
  { condition: 'excess_amount > 50000', action: 'flag_for_review', priority: 'medium' },
  { condition: 'attempts > 5', action: 'escalate', priority: 'low' },
  { condition: 'error_count > 2', action: 'escalate', priority: 'high' },

  // Hard blocks (require human before proceeding)
  { condition: 'legal_mention', action: 'block', priority: 'critical' },
  { condition: 'threat_detected', action: 'block', priority: 'critical' },
  { condition: 'competitor_mention', action: 'flag_for_review', priority: 'medium' }
];
```

### 6.5 Self-Pause Logic

```typescript
async function checkSelfPause(): Promise<{ should_pause: boolean; reason: string }> {
  const supabase = createClient();

  // Check error rate (last hour)
  const { count: errors } = await supabase
    .from('execution_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('updated_at', new Date(Date.now() - 3600000).toISOString());

  if (errors > 10) {
    return { should_pause: true, reason: `High error rate: ${errors} failures in last hour` };
  }

  // Check escalation rate
  const { count: escalations } = await supabase
    .from('autonomy_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'escalate')
    .gte('decided_at', new Date(Date.now() - 3600000).toISOString());

  if (escalations > 20) {
    return { should_pause: true, reason: `High escalation rate: ${escalations} in last hour` };
  }

  // Check opt-out rate
  const { count: optouts } = await supabase
    .from('opt_outs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 3600000).toISOString());

  if (optouts > 5) {
    return { should_pause: true, reason: `High opt-out rate: ${optouts} in last hour` };
  }

  return { should_pause: false, reason: 'All metrics nominal' };
}
```

---

## 7. Phase 2 Enablement Checklist

### Pre-Activation Requirements

- [ ] **Database Ready**
  - [ ] `message_intelligence` Phase 2 columns added
  - [ ] `autonomy_decisions` table created
  - [ ] `autonomy_audit_log` table created
  - [ ] All indexes created
  - [ ] RLS policies configured

- [ ] **Feature Flags Configured**
  - [ ] `autonomy_enabled = false` (initial state)
  - [ ] `phase2_active = false` (initial state)
  - [ ] `phase2_dry_run = true` (initial state)
  - [ ] All flags readable by API

- [ ] **ORION Validators Deployed**
  - [ ] Pre-action validators implemented
  - [ ] Post-action validators implemented
  - [ ] Rollback validators implemented
  - [ ] Escalation validators implemented
  - [ ] All validators tested in dry-run mode

- [ ] **Safety Controls Active**
  - [ ] Kill switch tested
  - [ ] Max retry limits configured
  - [ ] Cooldown periods set
  - [ ] Business hours enforced
  - [ ] Self-pause logic active
  - [ ] Telegram alerts configured

- [ ] **Monitoring Ready**
  - [ ] Dashboard shows Phase 2 metrics
  - [ ] Error rate alerts configured
  - [ ] Escalation queue visible
  - [ ] Audit log accessible

### Activation Sequence

1. **DRY RUN MODE** (Week 1)
   - Set `phase2_dry_run = true`
   - Set `phase2_active = true`
   - Monitor: All decisions logged, no actions taken
   - Review: Daily audit of proposed vs expected actions

2. **LIMITED ACTIVATION** (Week 2)
   - Set `autonomy_level = 2` (Safe operations only)
   - Allow: Status updates, escalations
   - Block: SMS, contracts, payments
   - Monitor: Human approval rate

3. **SUPERVISED FULL** (Week 3)
   - Set `autonomy_level = 3`
   - Set `phase2_dry_run = false`
   - First 24h: All actions require human confirmation
   - Review: Each auto-action outcome

4. **AUTONOMOUS** (Week 4+)
   - Set `autonomy_enabled = true`
   - Remove human confirmation requirement
   - Monitor: Error rate < 5%, escalation rate < 20%
   - Weekly audit reviews

### Rollback Procedure

1. Set `autonomy_enabled = false`
2. All pending autonomous actions held
3. Review escalation queue
4. Address any issues
5. Re-enable only after root cause resolved

---

## 8. Final Status

| Component | Status |
|-----------|--------|
| Decision Math | DESIGNED |
| Intelligence → Action Mapping | DESIGNED |
| ORION Validators | DESIGNED |
| Database Schema | DESIGNED (not executed) |
| Feature Flags | DESIGNED |
| Governance Controls | DESIGNED |
| Enablement Checklist | COMPLETE |

**FINAL STATUS: READY FOR REVIEW**

Phase 2 design is complete. Implementation code and migrations are prepared but NOT executed.

**AWAITING EXPLICIT AUTHORIZATION BEFORE:**
- Executing database migrations
- Deploying Phase 2 code
- Enabling any feature flags
- Activating autonomous operations

---

*Document generated by Claude Code (Opus 4.5) on 2026-01-20*
*This design respects all Phase 1 locks and governance constraints*
