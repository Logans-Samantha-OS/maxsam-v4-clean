-- ============================================================================
-- MIGRATION 008: Economic Lead Classification - Phase 13.3
-- ============================================================================
-- Purpose: Reclassify leads by economic reality, not superficial labels
--
-- New Fields on maxsam_leads:
--   - lead_class: A | B | C
--   - class_reason: text
--   - expected_value: numeric
--   - expected_time_to_cash: interval
--   - daily_rank: integer
--   - last_attempt_at: timestamp
--
-- New Tables:
--   - campaign_state: Daily capacity and class tracking
--   - class_metrics: Per-class performance metrics (separate, not blended)
--   - class_approval_log: ORION class approval decisions
--
-- Key Principle: Class A > Class B > Class C (immutable priority order)
-- ============================================================================

-- ============================================================================
-- SECTION 1: LEAD CLASS ENUM
-- ============================================================================

-- Economic lead classification
CREATE TYPE lead_class_type AS ENUM ('A', 'B', 'C');

-- ============================================================================
-- SECTION 2: EXTEND maxsam_leads
-- ============================================================================

-- Add economic classification fields to leads
DO $$
BEGIN
  -- Lead class (A, B, C)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'maxsam_leads' AND column_name = 'lead_class') THEN
    ALTER TABLE maxsam_leads ADD COLUMN lead_class lead_class_type;
  END IF;

  -- Classification reason (human-readable)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'maxsam_leads' AND column_name = 'class_reason') THEN
    ALTER TABLE maxsam_leads ADD COLUMN class_reason TEXT;
  END IF;

  -- Expected value (total expected revenue)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'maxsam_leads' AND column_name = 'expected_value') THEN
    ALTER TABLE maxsam_leads ADD COLUMN expected_value DECIMAL(12,2) DEFAULT 0;
  END IF;

  -- Expected time to cash (days)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'maxsam_leads' AND column_name = 'expected_time_to_cash') THEN
    ALTER TABLE maxsam_leads ADD COLUMN expected_time_to_cash INTEGER;
  END IF;

  -- Daily rank (1 = highest priority today)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'maxsam_leads' AND column_name = 'daily_rank') THEN
    ALTER TABLE maxsam_leads ADD COLUMN daily_rank INTEGER;
  END IF;

  -- Last contact attempt timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'maxsam_leads' AND column_name = 'last_attempt_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN last_attempt_at TIMESTAMPTZ;
  END IF;

  -- Classification timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'maxsam_leads' AND column_name = 'classified_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN classified_at TIMESTAMPTZ;
  END IF;

  -- Classification confidence
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'maxsam_leads' AND column_name = 'class_confidence') THEN
    ALTER TABLE maxsam_leads ADD COLUMN class_confidence TEXT
      CHECK (class_confidence IN ('HIGH', 'MEDIUM', 'LOW'));
  END IF;
END $$;

-- Indexes for classification queries
CREATE INDEX IF NOT EXISTS idx_leads_lead_class ON maxsam_leads(lead_class);
CREATE INDEX IF NOT EXISTS idx_leads_daily_rank ON maxsam_leads(daily_rank) WHERE daily_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_expected_value ON maxsam_leads(expected_value DESC);
CREATE INDEX IF NOT EXISTS idx_leads_last_attempt ON maxsam_leads(last_attempt_at);

-- ============================================================================
-- SECTION 3: CAMPAIGN STATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,

  -- Capacity tracking
  daily_capacity_target INTEGER NOT NULL DEFAULT 50,
  used_capacity INTEGER NOT NULL DEFAULT 0,

  -- Per-class tracking
  class_a_contacted INTEGER NOT NULL DEFAULT 0,
  class_a_remaining INTEGER NOT NULL DEFAULT 0,
  class_b_contacted INTEGER NOT NULL DEFAULT 0,
  class_b_remaining INTEGER NOT NULL DEFAULT 0,
  class_c_contacted INTEGER NOT NULL DEFAULT 0,
  class_c_remaining INTEGER NOT NULL DEFAULT 0,

  -- Active class
  active_class lead_class_type,
  halted_reason TEXT,

  -- Classes allowed today (set by ORION)
  allowed_classes lead_class_type[] NOT NULL DEFAULT ARRAY['A', 'B', 'C']::lead_class_type[],

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one state per day
CREATE INDEX IF NOT EXISTS idx_campaign_state_date ON campaign_state(date);

-- ============================================================================
-- SECTION 4: CLASS METRICS TABLE (SEPARATE BY CLASS)
-- ============================================================================

CREATE TYPE metrics_period AS ENUM ('day', 'week', 'month', 'all_time');

CREATE TABLE IF NOT EXISTS class_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class lead_class_type NOT NULL,
  period metrics_period NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Volume metrics
  total_leads INTEGER NOT NULL DEFAULT 0,
  contacted INTEGER NOT NULL DEFAULT 0,
  responded INTEGER NOT NULL DEFAULT 0,
  qualified INTEGER NOT NULL DEFAULT 0,
  contracted INTEGER NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,

  -- Revenue metrics
  total_expected_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_recovered DECIMAL(12,2) NOT NULL DEFAULT 0,
  avg_deal_size DECIMAL(12,2),

  -- Efficiency metrics (computed)
  conversion_rate DECIMAL(5,4), -- contacted -> closed
  response_rate DECIMAL(5,4), -- contacted -> responded
  qualification_rate DECIMAL(5,4), -- responded -> qualified
  close_rate DECIMAL(5,4), -- qualified -> closed

  -- Time metrics
  avg_time_to_response_hours DECIMAL(10,2),
  avg_time_to_close_days DECIMAL(10,2),
  avg_time_to_cash_days DECIMAL(10,2),

  -- Cost metrics
  cost_per_lead DECIMAL(10,2),
  cost_per_close DECIMAL(10,2),
  cost_per_recovered_dollar DECIMAL(10,4),

  -- Signal metrics
  opt_out_rate DECIMAL(5,4),
  negative_response_rate DECIMAL(5,4),
  dropoff_stages JSONB DEFAULT '{}',

  -- Timestamps
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint per class/period/dates
  UNIQUE (class, period, period_start, period_end)
);

-- Indexes for metrics queries
CREATE INDEX IF NOT EXISTS idx_class_metrics_class ON class_metrics(class);
CREATE INDEX IF NOT EXISTS idx_class_metrics_period ON class_metrics(period, period_start);

-- ============================================================================
-- SECTION 5: ORION CLASS APPROVAL LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_approval_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,

  -- Decision details
  class lead_class_type NOT NULL,
  approved BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  conditions TEXT[],
  max_leads INTEGER,
  expires_at TIMESTAMPTZ,

  -- Context
  autonomy_level INTEGER NOT NULL CHECK (autonomy_level BETWEEN 0 AND 3),
  lead_count_at_decision INTEGER,
  total_expected_value_at_decision DECIMAL(12,2),

  -- Timestamps
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Immutable
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent modifications
CREATE OR REPLACE FUNCTION prevent_approval_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'class_approval_log is append-only. Updates and deletes are prohibited.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_approval_log_update_delete
    BEFORE UPDATE OR DELETE ON class_approval_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_approval_log_modification();

-- Index for querying approvals
CREATE INDEX IF NOT EXISTS idx_class_approval_date ON class_approval_log(date, class);

-- ============================================================================
-- SECTION 6: CLASSIFICATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION classify_lead(p_lead_id UUID)
RETURNS TABLE (
  lead_class lead_class_type,
  class_reason TEXT,
  expected_value DECIMAL,
  expected_time_to_cash INTEGER,
  confidence TEXT
) AS $$
DECLARE
  v_excess_amount DECIMAL;
  v_arv DECIMAL;
  v_repair_cost DECIMAL;
  v_equity DECIMAL;
  v_is_cross_referenced BOOLEAN;
  v_has_phone BOOLEAN;
  v_recovery_fee DECIMAL;
  v_wholesale_fee DECIMAL;
BEGIN
  -- Get lead data
  SELECT
    COALESCE(excess_funds_amount, 0),
    COALESCE(estimated_arv, COALESCE(excess_funds_amount, 0) * 3),
    COALESCE(estimated_repair_cost, COALESCE(estimated_arv, COALESCE(excess_funds_amount, 0) * 3) * 0.15),
    COALESCE(is_cross_referenced, FALSE),
    (phone IS NOT NULL OR phone_1 IS NOT NULL OR phone_2 IS NOT NULL)
  INTO v_excess_amount, v_arv, v_repair_cost, v_is_cross_referenced, v_has_phone
  FROM maxsam_leads
  WHERE id = p_lead_id;

  -- Check minimum viability
  IF v_excess_amount < 5000 THEN
    RETURN; -- Not viable, return empty
  END IF;

  -- Calculate expected values
  v_recovery_fee := v_excess_amount * 0.25;
  v_equity := GREATEST(0, v_arv - v_repair_cost - (v_arv * 0.70));
  v_wholesale_fee := CASE WHEN v_equity >= 10000 THEN v_equity * 0.10 ELSE 0 END;

  -- Determine class
  -- Class A: Dual deal potential
  IF (v_is_cross_referenced AND v_excess_amount >= 15000) OR
     (v_excess_amount >= 15000 AND v_equity >= 10000) OR
     (v_equity >= 25000 AND v_excess_amount >= 10000) THEN
    RETURN QUERY SELECT
      'A'::lead_class_type,
      CASE
        WHEN v_is_cross_referenced THEN
          format('Cross-referenced dual deal: $%s excess + distressed property', to_char(v_excess_amount, 'FM999,999,999'))
        ELSE
          format('Dual deal potential: $%s excess + $%s equity', to_char(v_excess_amount, 'FM999,999,999'), to_char(v_equity, 'FM999,999,999'))
      END,
      v_recovery_fee + v_wholesale_fee,
      CASE WHEN v_has_phone THEN 45 ELSE 60 END,
      CASE WHEN v_is_cross_referenced THEN 'HIGH' ELSE 'MEDIUM' END;

  -- Class B: Big fish recovery (>= $75K)
  ELSIF v_excess_amount >= 75000 THEN
    RETURN QUERY SELECT
      'B'::lead_class_type,
      format('Big fish recovery: $%s excess funds ($%s expected fee)', to_char(v_excess_amount, 'FM999,999,999'), to_char(v_recovery_fee, 'FM999,999,999')),
      v_recovery_fee,
      CASE WHEN v_has_phone THEN 30 ELSE 45 END,
      'HIGH'::TEXT;

  -- Class C: Standard recovery
  ELSE
    RETURN QUERY SELECT
      'C'::lead_class_type,
      format('Standard recovery: $%s excess funds', to_char(v_excess_amount, 'FM999,999,999')),
      v_recovery_fee,
      CASE WHEN v_has_phone THEN 35 ELSE 50 END,
      CASE WHEN v_excess_amount >= 10000 THEN 'MEDIUM' ELSE 'LOW' END;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- SECTION 7: BACKFILL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_lead_classifications()
RETURNS TABLE (
  total_processed INTEGER,
  class_a_count INTEGER,
  class_b_count INTEGER,
  class_c_count INTEGER,
  not_viable_count INTEGER
) AS $$
DECLARE
  v_lead RECORD;
  v_classification RECORD;
  v_total INTEGER := 0;
  v_class_a INTEGER := 0;
  v_class_b INTEGER := 0;
  v_class_c INTEGER := 0;
  v_not_viable INTEGER := 0;
BEGIN
  -- Process each unclassified lead
  FOR v_lead IN
    SELECT id FROM maxsam_leads
    WHERE lead_class IS NULL
    ORDER BY excess_funds_amount DESC NULLS LAST
  LOOP
    v_total := v_total + 1;

    -- Get classification
    SELECT * INTO v_classification FROM classify_lead(v_lead.id);

    IF v_classification.lead_class IS NOT NULL THEN
      -- Update lead with classification
      UPDATE maxsam_leads SET
        lead_class = v_classification.lead_class,
        class_reason = v_classification.class_reason,
        expected_value = v_classification.expected_value,
        expected_time_to_cash = v_classification.expected_time_to_cash,
        class_confidence = v_classification.confidence,
        classified_at = NOW()
      WHERE id = v_lead.id;

      -- Count by class
      IF v_classification.lead_class = 'A' THEN v_class_a := v_class_a + 1;
      ELSIF v_classification.lead_class = 'B' THEN v_class_b := v_class_b + 1;
      ELSIF v_classification.lead_class = 'C' THEN v_class_c := v_class_c + 1;
      END IF;
    ELSE
      v_not_viable := v_not_viable + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total, v_class_a, v_class_b, v_class_c, v_not_viable;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 8: DAILY RANKING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_daily_rankings()
RETURNS INTEGER AS $$
DECLARE
  v_rank INTEGER := 0;
  v_lead RECORD;
BEGIN
  -- Reset all ranks
  UPDATE maxsam_leads SET daily_rank = NULL;

  -- Rank leads: Class A first, then B, then C
  -- Within each class, order by expected_value and urgency
  FOR v_lead IN
    SELECT id, lead_class, expected_value, days_until_expiration
    FROM maxsam_leads
    WHERE lead_class IS NOT NULL
      AND status NOT IN ('closed', 'dead')
      AND (phone IS NOT NULL OR phone_1 IS NOT NULL OR phone_2 IS NOT NULL)
    ORDER BY
      CASE lead_class
        WHEN 'A' THEN 1
        WHEN 'B' THEN 2
        WHEN 'C' THEN 3
      END,
      COALESCE(days_until_expiration, 999) ASC,
      expected_value DESC
  LOOP
    v_rank := v_rank + 1;
    UPDATE maxsam_leads SET daily_rank = v_rank WHERE id = v_lead.id;
  END LOOP;

  RETURN v_rank;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 9: VIEWS
-- ============================================================================

-- Class summary view
CREATE OR REPLACE VIEW v_class_summary AS
SELECT
  lead_class,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE status NOT IN ('closed', 'dead')) as active_leads,
  COUNT(*) FILTER (WHERE phone IS NOT NULL OR phone_1 IS NOT NULL OR phone_2 IS NOT NULL) as contactable_leads,
  COALESCE(SUM(expected_value), 0) as total_expected_value,
  COALESCE(AVG(expected_value), 0) as avg_expected_value,
  COALESCE(AVG(expected_time_to_cash), 0) as avg_time_to_cash
FROM maxsam_leads
WHERE lead_class IS NOT NULL
GROUP BY lead_class
ORDER BY
  CASE lead_class
    WHEN 'A' THEN 1
    WHEN 'B' THEN 2
    WHEN 'C' THEN 3
  END;

-- Today's priority queue (respects class order)
CREATE OR REPLACE VIEW v_today_priority_queue AS
SELECT
  id,
  lead_class,
  daily_rank,
  owner_name,
  phone,
  phone_1,
  phone_2,
  excess_funds_amount,
  expected_value,
  class_reason,
  days_until_expiration,
  last_attempt_at,
  status
FROM maxsam_leads
WHERE lead_class IS NOT NULL
  AND daily_rank IS NOT NULL
  AND status NOT IN ('closed', 'dead')
ORDER BY daily_rank
LIMIT 100;

-- Class A golden leads
CREATE OR REPLACE VIEW v_class_a_golden AS
SELECT
  id,
  owner_name,
  property_address,
  excess_funds_amount,
  expected_value,
  class_reason,
  days_until_expiration,
  is_cross_referenced,
  phone,
  email,
  status,
  daily_rank
FROM maxsam_leads
WHERE lead_class = 'A'
  AND status NOT IN ('closed', 'dead')
ORDER BY daily_rank NULLS LAST, expected_value DESC;

-- Class B big fish
CREATE OR REPLACE VIEW v_class_b_big_fish AS
SELECT
  id,
  owner_name,
  property_address,
  excess_funds_amount,
  expected_value,
  class_reason,
  days_until_expiration,
  phone,
  email,
  status,
  daily_rank
FROM maxsam_leads
WHERE lead_class = 'B'
  AND status NOT IN ('closed', 'dead')
ORDER BY daily_rank NULLS LAST, expected_value DESC;

-- ============================================================================
-- SECTION 10: CAMPAIGN STATE HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_today_campaign_state()
RETURNS campaign_state AS $$
DECLARE
  v_state campaign_state;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Try to get existing state
  SELECT * INTO v_state FROM campaign_state WHERE date = v_today;

  IF v_state IS NULL THEN
    -- Create new state for today
    INSERT INTO campaign_state (date, daily_capacity_target)
    VALUES (v_today, 50)
    RETURNING * INTO v_state;

    -- Count leads by class
    UPDATE campaign_state SET
      class_a_remaining = (SELECT COUNT(*) FROM maxsam_leads WHERE lead_class = 'A' AND status NOT IN ('closed', 'dead')),
      class_b_remaining = (SELECT COUNT(*) FROM maxsam_leads WHERE lead_class = 'B' AND status NOT IN ('closed', 'dead')),
      class_c_remaining = (SELECT COUNT(*) FROM maxsam_leads WHERE lead_class = 'C' AND status NOT IN ('closed', 'dead')),
      active_class = 'A'
    WHERE date = v_today
    RETURNING * INTO v_state;
  END IF;

  RETURN v_state;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_contact_attempt(
  p_lead_id UUID,
  p_class lead_class_type
)
RETURNS VOID AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Update lead
  UPDATE maxsam_leads SET
    last_attempt_at = NOW(),
    contact_attempts = COALESCE(contact_attempts, 0) + 1
  WHERE id = p_lead_id;

  -- Update campaign state
  UPDATE campaign_state SET
    used_capacity = used_capacity + 1,
    class_a_contacted = CASE WHEN p_class = 'A' THEN class_a_contacted + 1 ELSE class_a_contacted END,
    class_b_contacted = CASE WHEN p_class = 'B' THEN class_b_contacted + 1 ELSE class_b_contacted END,
    class_c_contacted = CASE WHEN p_class = 'C' THEN class_c_contacted + 1 ELSE class_c_contacted END,
    updated_at = NOW()
  WHERE date = v_today;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE campaign_state IS 'Daily capacity and class tracking for orchestration';
COMMENT ON TABLE class_metrics IS 'Per-class performance metrics - NEVER BLENDED';
COMMENT ON TABLE class_approval_log IS 'ORION class approval decisions - APPEND ONLY';
COMMENT ON COLUMN maxsam_leads.lead_class IS 'Economic classification: A (dual), B (big fish), C (standard)';
COMMENT ON COLUMN maxsam_leads.expected_value IS 'Total expected revenue from this lead';
COMMENT ON COLUMN maxsam_leads.daily_rank IS 'Priority rank for today (1 = highest)';
