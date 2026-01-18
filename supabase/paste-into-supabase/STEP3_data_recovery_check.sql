-- ============================================================================
-- STEP 3: DATA RECOVERY CHECK
-- Phase 13.3 - Find Missing ~100 Leads
-- ============================================================================
-- PURPOSE: Diagnose where leads may have gone, check for duplicates, find gaps
-- USAGE: Paste this entire script into Supabase SQL Editor and run
-- ============================================================================

-- SECTION A: Total count over time (when were leads ingested?)
SELECT
  DATE_TRUNC('day', created_at) as ingest_date,
  COUNT(*) as leads_ingested
FROM maxsam_leads
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY ingest_date DESC
LIMIT 30;

-- SECTION B: Check for soft-deleted or status = 'dead' leads
SELECT
  status,
  COUNT(*) as count
FROM maxsam_leads
GROUP BY status
ORDER BY count DESC;

-- SECTION C: Check for duplicates by property address
SELECT
  property_address,
  COUNT(*) as occurrences,
  ARRAY_AGG(id) as lead_ids
FROM maxsam_leads
WHERE property_address IS NOT NULL
GROUP BY property_address
HAVING COUNT(*) > 1
ORDER BY occurrences DESC
LIMIT 20;

-- SECTION D: Check for duplicates by owner name + excess funds
SELECT
  owner_name,
  excess_funds_amount,
  COUNT(*) as occurrences,
  ARRAY_AGG(id) as lead_ids
FROM maxsam_leads
WHERE owner_name IS NOT NULL
GROUP BY owner_name, excess_funds_amount
HAVING COUNT(*) > 1
ORDER BY occurrences DESC
LIMIT 20;

-- SECTION E: Check for leads without critical data
SELECT
  'Missing owner_name' as issue,
  COUNT(*) as count
FROM maxsam_leads
WHERE owner_name IS NULL OR owner_name = ''
UNION ALL
SELECT
  'Missing property_address' as issue,
  COUNT(*) as count
FROM maxsam_leads
WHERE property_address IS NULL OR property_address = ''
UNION ALL
SELECT
  'Missing excess_funds_amount' as issue,
  COUNT(*) as count
FROM maxsam_leads
WHERE excess_funds_amount IS NULL OR excess_funds_amount = 0
UNION ALL
SELECT
  'No phone data' as issue,
  COUNT(*) as count
FROM maxsam_leads
WHERE phone IS NULL AND phone_1 IS NULL AND phone_2 IS NULL;

-- SECTION F: Leads with excess_funds but no phone (skip trace needed)
SELECT
  id,
  owner_name,
  property_address,
  excess_funds_amount,
  status,
  created_at
FROM maxsam_leads
WHERE excess_funds_amount >= 5000
  AND phone IS NULL
  AND phone_1 IS NULL
  AND phone_2 IS NULL
ORDER BY excess_funds_amount DESC
LIMIT 25;

-- SECTION G: Check if leads exist in any other table
-- (Checking for potential table migration issues)
SELECT
  'maxsam_leads' as source_table,
  COUNT(*) as count
FROM maxsam_leads;

-- SECTION H: Recent 30-day activity - were leads lost recently?
SELECT
  DATE_TRUNC('day', updated_at) as update_date,
  COUNT(*) as leads_updated,
  COUNT(*) FILTER (WHERE status = 'dead') as marked_dead,
  COUNT(*) FILTER (WHERE status = 'closed') as marked_closed
FROM maxsam_leads
WHERE updated_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', updated_at)
ORDER BY update_date DESC;

-- SECTION I: Check for leads with NULL created_at (data integrity issue)
SELECT
  COUNT(*) as leads_with_null_created_at
FROM maxsam_leads
WHERE created_at IS NULL;

-- SECTION J: Oldest 10 leads (sanity check for historical data)
SELECT
  id,
  owner_name,
  excess_funds_amount,
  status,
  created_at
FROM maxsam_leads
ORDER BY created_at ASC NULLS LAST
LIMIT 10;

-- ============================================================================
-- END OF STEP 3 - DATA RECOVERY CHECK
-- ============================================================================
-- NEXT STEPS:
-- 1. If duplicates found, run deduplication (keep highest excess_funds)
-- 2. If leads marked 'dead' incorrectly, update status
-- 3. If leads missing phone, prioritize skip tracing
-- 4. If leads ingested but not in DB, check import logs or re-import
-- ============================================================================
