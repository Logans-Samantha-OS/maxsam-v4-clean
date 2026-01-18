-- ============================================================================
-- STEP 4: CLASSIFICATION + BACKFILL
-- Phase 13.3 - Economic Lead Classification
-- ============================================================================
-- PURPOSE: Apply 008 migration, backfill all leads with A/B/C classification
-- USAGE: Run these in order. Each section is idempotent (safe to re-run).
--
-- BIG FISH THRESHOLD: $75,000 (Class B = $75K+ excess funds)
-- ============================================================================

-- ============================================================================
-- PART A: CREATE ENUM (if not exists)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_class_type') THEN
    CREATE TYPE lead_class_type AS ENUM ('A', 'B', 'C');
  END IF;
END $$;

-- ============================================================================
-- PART B: ADD CLASSIFICATION COLUMNS TO maxsam_leads
-- ============================================================================

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

-- ============================================================================
-- PART C: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_lead_class ON maxsam_leads(lead_class);
CREATE INDEX IF NOT EXISTS idx_leads_daily_rank ON maxsam_leads(daily_rank) WHERE daily_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_expected_value ON maxsam_leads(expected_value DESC);
CREATE INDEX IF NOT EXISTS idx_leads_last_attempt ON maxsam_leads(last_attempt_at);

-- ============================================================================
-- PART D: CLASSIFICATION FUNCTION ($75K BIG FISH THRESHOLD)
-- ============================================================================

CREATE OR REPLACE FUNCTION classify_lead_v2(p_lead_id UUID)
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

  -- Check minimum viability ($5K)
  IF v_excess_amount < 5000 THEN
    RETURN; -- Not viable, return empty
  END IF;

  -- Calculate expected values
  v_recovery_fee := v_excess_amount * 0.25;
  v_equity := GREATEST(0, v_arv - v_repair_cost - (v_arv * 0.70));
  v_wholesale_fee := CASE WHEN v_equity >= 10000 THEN v_equity * 0.10 ELSE 0 END;

  -- Determine class
  -- Class A: Dual deal potential (cross-referenced OR high equity + excess)
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

  -- Class B: Big fish recovery (>= $75K) -- UPDATED THRESHOLD
  ELSIF v_excess_amount >= 75000 THEN
    RETURN QUERY SELECT
      'B'::lead_class_type,
      format('Big fish recovery: $%s excess funds ($%s expected fee)', to_char(v_excess_amount, 'FM999,999,999'), to_char(v_recovery_fee, 'FM999,999,999')),
      v_recovery_fee,
      CASE WHEN v_has_phone THEN 30 ELSE 45 END,
      'HIGH'::TEXT;

  -- Class C: Standard recovery ($5K - $75K)
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
-- PART E: BACKFILL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_lead_classifications_v2()
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

    -- Get classification using v2 function ($75K threshold)
    SELECT * INTO v_classification FROM classify_lead_v2(v_lead.id);

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
-- PART F: RUN BACKFILL
-- ============================================================================

-- This will classify all unclassified leads
SELECT * FROM backfill_lead_classifications_v2();

-- ============================================================================
-- PART G: VERIFY RESULTS
-- ============================================================================

SELECT
  lead_class,
  COUNT(*) as count,
  ROUND(AVG(excess_funds_amount)::numeric, 2) as avg_excess_funds,
  ROUND(SUM(expected_value)::numeric, 2) as total_expected_value,
  ROUND(AVG(expected_time_to_cash)::numeric, 0) as avg_days_to_cash
FROM maxsam_leads
WHERE lead_class IS NOT NULL
GROUP BY lead_class
ORDER BY
  CASE lead_class
    WHEN 'A' THEN 1
    WHEN 'B' THEN 2
    WHEN 'C' THEN 3
  END;

-- ============================================================================
-- PART H: UPDATE SYSTEM CONFIG
-- ============================================================================

INSERT INTO system_config (key, value, updated_at)
VALUES ('last_classification_backfill', NOW()::text, NOW())
ON CONFLICT (key) DO UPDATE SET
  value = NOW()::text,
  updated_at = NOW();

INSERT INTO system_config (key, value, updated_at)
VALUES ('big_fish_threshold', '75000', NOW())
ON CONFLICT (key) DO UPDATE SET
  value = '75000',
  updated_at = NOW();

-- ============================================================================
-- END OF STEP 4 - CLASSIFICATION + BACKFILL
-- ============================================================================
-- SUMMARY:
-- - Class A: Dual deal (excess + wholesale potential), highest priority
-- - Class B: Big fish ($75K+ excess), recovery only, fast cash
-- - Class C: Standard ($5K-$75K), capacity filler, lower priority
-- - Not viable: <$5K excess, not pursued
-- ============================================================================
