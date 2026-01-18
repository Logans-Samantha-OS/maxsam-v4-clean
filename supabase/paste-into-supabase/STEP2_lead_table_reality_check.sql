-- ============================================================================
-- STEP 2: LEAD TABLE REALITY CHECK
-- Phase 13.3 - Economic Classification Diagnosis
-- ============================================================================
-- PURPOSE: Confirm table exists, check row counts, sample data, verify RLS
-- USAGE: Paste this entire script into Supabase SQL Editor and run
-- ============================================================================

-- SECTION A: Confirm table names exist
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('maxsam_leads', 'leads', 'system_config', 'campaign_state', 'class_approval_log')
ORDER BY table_name;

-- SECTION B: Count rows in maxsam_leads
SELECT
  'maxsam_leads' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE phone IS NOT NULL OR phone_1 IS NOT NULL OR phone_2 IS NOT NULL) as with_phone,
  COUNT(*) FILTER (WHERE excess_funds_amount IS NOT NULL AND excess_funds_amount > 0) as with_excess_funds,
  COUNT(*) FILTER (WHERE excess_funds_amount >= 5000) as viable_leads,
  COUNT(*) FILTER (WHERE excess_funds_amount >= 75000) as big_fish_75k_plus,
  COUNT(*) FILTER (WHERE lead_class IS NOT NULL) as classified,
  COUNT(*) FILTER (WHERE lead_class IS NULL) as unclassified
FROM maxsam_leads;

-- SECTION C: Sample newest 10 rows
SELECT
  id,
  owner_name,
  property_address,
  excess_funds_amount,
  phone,
  phone_1,
  phone_2,
  lead_class,
  expected_value,
  status,
  created_at
FROM maxsam_leads
ORDER BY created_at DESC NULLS LAST
LIMIT 10;

-- SECTION D: Check class distribution (if any classified)
SELECT
  lead_class,
  COUNT(*) as count,
  ROUND(AVG(excess_funds_amount)::numeric, 2) as avg_excess_funds,
  ROUND(SUM(expected_value)::numeric, 2) as total_expected_value
FROM maxsam_leads
WHERE lead_class IS NOT NULL
GROUP BY lead_class
ORDER BY
  CASE lead_class
    WHEN 'A' THEN 1
    WHEN 'B' THEN 2
    WHEN 'C' THEN 3
  END;

-- SECTION E: Confirm RLS policies don't block reads
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'maxsam_leads';

-- SECTION F: Check if classification columns exist
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'maxsam_leads'
  AND column_name IN (
    'lead_class',
    'class_reason',
    'expected_value',
    'expected_time_to_cash',
    'daily_rank',
    'last_attempt_at',
    'classified_at',
    'class_confidence'
  )
ORDER BY ordinal_position;

-- SECTION G: Check for the lead_class_type enum
SELECT
  typname,
  enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'lead_class_type';

-- SECTION H: Excess funds distribution for classification planning
SELECT
  CASE
    WHEN excess_funds_amount < 5000 THEN 'Under $5K (not viable)'
    WHEN excess_funds_amount < 15000 THEN '$5K - $15K (Class C range)'
    WHEN excess_funds_amount < 75000 THEN '$15K - $75K (Class C or A-dual)'
    WHEN excess_funds_amount >= 75000 THEN '$75K+ (Class B big fish)'
    ELSE 'NULL'
  END as range,
  COUNT(*) as lead_count,
  ROUND(SUM(excess_funds_amount)::numeric, 2) as total_excess
FROM maxsam_leads
GROUP BY
  CASE
    WHEN excess_funds_amount < 5000 THEN 'Under $5K (not viable)'
    WHEN excess_funds_amount < 15000 THEN '$5K - $15K (Class C range)'
    WHEN excess_funds_amount < 75000 THEN '$15K - $75K (Class C or A-dual)'
    WHEN excess_funds_amount >= 75000 THEN '$75K+ (Class B big fish)'
    ELSE 'NULL'
  END
ORDER BY
  CASE
    WHEN excess_funds_amount < 5000 THEN 1
    WHEN excess_funds_amount < 15000 THEN 2
    WHEN excess_funds_amount < 75000 THEN 3
    WHEN excess_funds_amount >= 75000 THEN 4
    ELSE 5
  END;

-- ============================================================================
-- END OF STEP 2 - LEAD TABLE REALITY CHECK
-- ============================================================================
