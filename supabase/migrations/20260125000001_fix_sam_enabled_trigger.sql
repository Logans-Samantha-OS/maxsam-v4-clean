-- ============================================================================
-- Migration: Fix broken trigger referencing non-existent sam_enabled column
-- ============================================================================
-- This fixes the error: record "new" has no field "sam_enabled"
-- The trigger was created referencing a column that doesn't exist in maxsam_leads
-- ============================================================================

-- First, let's find and drop any triggers that might be referencing sam_enabled
-- We'll drop all triggers on maxsam_leads and recreate only the valid ones

-- Drop all BEFORE UPDATE triggers on maxsam_leads that might be problematic
DROP TRIGGER IF EXISTS trigger_update_expiration ON maxsam_leads;
DROP TRIGGER IF EXISTS trigger_update_lead ON maxsam_leads;
DROP TRIGGER IF EXISTS trigger_check_sam_enabled ON maxsam_leads;
DROP TRIGGER IF EXISTS maxsam_leads_sam_enabled_trigger ON maxsam_leads;
DROP TRIGGER IF EXISTS sam_enabled_check_trigger ON maxsam_leads;

-- Drop the update_updated_at trigger (we'll recreate it properly)
DROP TRIGGER IF EXISTS update_maxsam_leads_updated_at ON maxsam_leads;

-- Now recreate a simple updated_at trigger that doesn't reference sam_enabled
CREATE OR REPLACE FUNCTION update_maxsam_leads_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_maxsam_leads_updated_at
  BEFORE UPDATE ON maxsam_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_maxsam_leads_timestamp();

-- Recreate the expiration tracking trigger if the column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'maxsam_leads'
             AND column_name = 'expiration_date') THEN

    CREATE OR REPLACE FUNCTION update_days_until_expiration_safe()
    RETURNS TRIGGER AS $func$
    BEGIN
      IF NEW.expiration_date IS NOT NULL THEN
        NEW.days_until_expiration := NEW.expiration_date - CURRENT_DATE;
      END IF;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_update_expiration_safe ON maxsam_leads;
    CREATE TRIGGER trigger_update_expiration_safe
      BEFORE INSERT OR UPDATE OF expiration_date ON maxsam_leads
      FOR EACH ROW
      EXECUTE FUNCTION update_days_until_expiration_safe();
  END IF;
END $$;

-- Also check for any functions that might reference sam_enabled
DO $$
DECLARE
  func_rec RECORD;
BEGIN
  FOR func_rec IN
    SELECT proname, prosrc
    FROM pg_proc
    WHERE prosrc LIKE '%NEW.sam_enabled%'
    OR prosrc LIKE '%sam_enabled%'
  LOOP
    RAISE NOTICE 'Function % references sam_enabled: %', func_rec.proname, LEFT(func_rec.prosrc, 100);
  END LOOP;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Trigger fix migration complete';
  RAISE NOTICE 'Dropped potentially problematic triggers on maxsam_leads';
  RAISE NOTICE 'Created clean update_maxsam_leads_updated_at trigger';
END $$;
