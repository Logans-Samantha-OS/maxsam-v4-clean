-- ============================================================================
-- FIX SHARON DENISE WRIGHT LEAD - Run in Supabase SQL Editor
-- https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs/sql
-- ============================================================================

-- Step 1: Find the problematic trigger/function
SELECT proname, LEFT(prosrc, 500) as function_source
FROM pg_proc
WHERE prosrc LIKE '%NEW.sam_enabled%'
OR proname LIKE '%sam_enabled%';

-- Step 2: List all triggers on maxsam_leads
SELECT
  tgname as trigger_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'maxsam_leads'::regclass;

-- Step 3: Drop any trigger that references sam_enabled
-- (Run each DROP statement individually after identifying from Step 2)
-- DROP TRIGGER IF EXISTS <trigger_name> ON maxsam_leads;

-- Step 4: Update Sharon's lead (this should work after removing bad trigger)
UPDATE maxsam_leads
SET
  eleanor_score = 80,
  eleanor_grade = 'A',
  is_golden_lead = true,
  lead_class = 'A',
  notes = 'Merged duplicate lead on 2026-01-25. Score upgraded from 16 to 80. Original excess funds amount: $105,629.61'
WHERE id = 'd95d0092-de66-41ef-a896-37df386955ec';

-- Step 5: Verify the update
SELECT
  id,
  owner_name,
  phone,
  eleanor_score,
  eleanor_grade,
  is_golden_lead,
  excess_funds_amount,
  property_address,
  property_city,
  property_zip,
  state
FROM maxsam_leads
WHERE id = 'd95d0092-de66-41ef-a896-37df386955ec';
