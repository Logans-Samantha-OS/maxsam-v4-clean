-- ============================================================================
-- MIGRATION 009: Consolidate leads → maxsam_leads
-- ============================================================================
-- Purpose: Merge remaining data from legacy 'leads' table into 'maxsam_leads'
--          and add phone_1/phone_2 columns for multi-phone skip trace support
--
-- This migration:
--   1. Adds phone_1/phone_2 columns if missing
--   2. Upserts all leads data into maxsam_leads
--   3. Creates performance indexes
--   4. Does NOT drop the leads table (that's migration 010)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add multi-phone columns if they don't exist
-- ============================================================================

DO $$
BEGIN
  -- Add phone_1 column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'phone_1') THEN
    ALTER TABLE maxsam_leads ADD COLUMN phone_1 TEXT;
  END IF;

  -- Add phone_2 column  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'phone_2') THEN
    ALTER TABLE maxsam_leads ADD COLUMN phone_2 TEXT;
  END IF;

  -- Add first_contacted_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'first_contacted_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN first_contacted_at TIMESTAMPTZ;
  END IF;

  -- Add do_not_contact flag if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'do_not_contact') THEN
    ALTER TABLE maxsam_leads ADD COLUMN do_not_contact BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add expiration_date if missing (maps from expiry_date)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'expiration_date') THEN
    ALTER TABLE maxsam_leads ADD COLUMN expiration_date DATE;
  END IF;

  -- Add class_confidence if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'class_confidence') THEN
    ALTER TABLE maxsam_leads ADD COLUMN class_confidence TEXT 
      CHECK (class_confidence IN ('HIGH', 'MEDIUM', 'LOW'));
  END IF;

  -- Add classified_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'classified_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN classified_at TIMESTAMPTZ;
  END IF;

  -- Add expected_time_to_cash if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'expected_time_to_cash') THEN
    ALTER TABLE maxsam_leads ADD COLUMN expected_time_to_cash INTEGER;
  END IF;

  -- Add last_attempt_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'last_attempt_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN last_attempt_at TIMESTAMPTZ;
  END IF;

  -- Add daily_rank if missing  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'daily_rank') THEN
    ALTER TABLE maxsam_leads ADD COLUMN daily_rank INTEGER;
  END IF;

  -- Add lead_class if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'lead_class') THEN
    ALTER TABLE maxsam_leads ADD COLUMN lead_class TEXT 
      CHECK (lead_class IN ('A', 'B', 'C'));
  END IF;

  -- Add class_reason if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'class_reason') THEN
    ALTER TABLE maxsam_leads ADD COLUMN class_reason TEXT;
  END IF;

  -- Add expected_value if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'expected_value') THEN
    ALTER TABLE maxsam_leads ADD COLUMN expected_value DECIMAL(12,2) DEFAULT 0;
  END IF;

  -- Add is_cross_referenced if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'maxsam_leads' AND column_name = 'is_cross_referenced') THEN
    ALTER TABLE maxsam_leads ADD COLUMN is_cross_referenced BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create lead_class_type if needed (for backward compat with 008)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_class_type') THEN
    CREATE TYPE lead_class_type AS ENUM ('A', 'B', 'C');
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Upsert from leads → maxsam_leads
-- ============================================================================

INSERT INTO maxsam_leads (
  id,
  owner_name,
  property_address,
  property_city,
  property_zip,
  county,
  source,
  source_type,
  status,
  excess_funds_amount,
  phone,
  email,
  is_golden_lead,
  expiration_date,
  lead_class,
  class_reason,
  expected_value,
  daily_rank,
  notes,
  created_at,
  updated_at
)
SELECT 
  l.id,
  l.owner_name,
  l.property_address,
  l.property_city,
  l.property_zip,
  COALESCE(l.county, l.county_name),
  l.source,
  l.source_type,
  l.status,
  COALESCE(l.excess_amount, 0),
  COALESCE(l.phone_number, l.primary_phone),
  COALESCE(l.email, l.primary_email),
  COALESCE(l.is_golden_lead, false),
  l.expiry_date,
  l.lead_class,
  l.class_reason,
  l.expected_value,
  l.daily_rank,
  l.notes,
  l.created_at,
  NOW()
FROM leads l
WHERE l.id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  excess_funds_amount = COALESCE(EXCLUDED.excess_funds_amount, maxsam_leads.excess_funds_amount),
  phone = COALESCE(EXCLUDED.phone, maxsam_leads.phone),
  email = COALESCE(EXCLUDED.email, maxsam_leads.email),
  is_golden_lead = COALESCE(EXCLUDED.is_golden_lead, maxsam_leads.is_golden_lead),
  expiration_date = COALESCE(EXCLUDED.expiration_date, maxsam_leads.expiration_date),
  lead_class = COALESCE(EXCLUDED.lead_class, maxsam_leads.lead_class),
  class_reason = COALESCE(EXCLUDED.class_reason, maxsam_leads.class_reason),
  expected_value = COALESCE(EXCLUDED.expected_value, maxsam_leads.expected_value),
  daily_rank = COALESCE(EXCLUDED.daily_rank, maxsam_leads.daily_rank),
  updated_at = NOW();

-- ============================================================================
-- STEP 4: Migrate phone arrays from leads.phones JSON to phone_1/phone_2
-- ============================================================================

UPDATE maxsam_leads ml SET
  phone_1 = (
    SELECT COALESCE(
      (l.phones->>0),
      (l.phones->0->>'number')
    )
    FROM leads l WHERE l.id = ml.id AND l.phones IS NOT NULL
  ),
  phone_2 = (
    SELECT COALESCE(
      (l.phones->>1),
      (l.phones->1->>'number')
    )
    FROM leads l WHERE l.id = ml.id AND l.phones IS NOT NULL
  )
WHERE ml.phone_1 IS NULL 
  AND EXISTS (SELECT 1 FROM leads l WHERE l.id = ml.id AND l.phones IS NOT NULL);

-- ============================================================================
-- STEP 5: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_maxsam_leads_case_number ON maxsam_leads(case_number);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_status ON maxsam_leads(status);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_eleanor_score ON maxsam_leads(eleanor_score DESC);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_excess_funds ON maxsam_leads(excess_funds_amount DESC);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_golden_lead ON maxsam_leads(is_golden_lead);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_lead_class ON maxsam_leads(lead_class);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_daily_rank ON maxsam_leads(daily_rank) WHERE daily_rank IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_expiration ON maxsam_leads(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_phone ON maxsam_leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_phone_1 ON maxsam_leads(phone_1) WHERE phone_1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_skip_trace_status ON maxsam_leads(skip_trace_status);

-- ============================================================================
-- VERIFICATION QUERY (run after migration)
-- ============================================================================

-- After running, verify with:
-- SELECT 
--   (SELECT COUNT(*) FROM leads) as leads_count,
--   (SELECT COUNT(*) FROM maxsam_leads) as maxsam_leads_count,
--   (SELECT COUNT(*) FROM maxsam_leads WHERE excess_funds_amount > 0) as with_excess_amount,
--   (SELECT SUM(excess_funds_amount) FROM maxsam_leads) as total_excess_value;

-- ============================================================================
-- MIGRATION 009 COMPLETE
-- ============================================================================

COMMENT ON COLUMN maxsam_leads.phone_1 IS 'Secondary phone from skip trace';
COMMENT ON COLUMN maxsam_leads.phone_2 IS 'Tertiary phone from skip trace';
COMMENT ON COLUMN maxsam_leads.expiration_date IS 'Excess funds claim deadline';
COMMENT ON COLUMN maxsam_leads.is_cross_referenced IS 'Appears on both excess funds AND distressed lists';
