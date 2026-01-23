-- ============================================================================
-- MIGRATION 010: Deprecate Legacy Leads Table
-- ============================================================================
-- Purpose: Create view for backward compatibility, then rename leads → leads_legacy
--          This preserves data while routing all queries to maxsam_leads
--
-- IMPORTANT: Run 009 first to ensure all data is migrated!
--
-- This migration:
--   1. Creates leads_legacy backup table (rename, not drop)
--   2. Creates leads view pointing to maxsam_leads
--   3. Creates insert/update triggers for the view
--   4. Adds foreign key constraints where safe
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify 009 migration ran (safety check)
-- ============================================================================

DO $$
DECLARE
  v_leads_count INTEGER;
  v_maxsam_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_leads_count FROM leads;
  SELECT COUNT(*) INTO v_maxsam_count FROM maxsam_leads;
  
  IF v_maxsam_count < v_leads_count THEN
    RAISE EXCEPTION 'Migration 009 may not have run - maxsam_leads (%) has fewer records than leads (%)', 
      v_maxsam_count, v_leads_count;
  END IF;
  
  RAISE NOTICE 'Pre-flight check passed: leads=%, maxsam_leads=%', v_leads_count, v_maxsam_count;
END $$;

-- ============================================================================
-- STEP 2: Rename leads → leads_legacy (preserve, don't drop)
-- ============================================================================

ALTER TABLE IF EXISTS leads RENAME TO leads_legacy;

-- ============================================================================
-- STEP 3: Create leads view pointing to maxsam_leads
-- ============================================================================

CREATE OR REPLACE VIEW leads AS
SELECT 
  id,
  owner_name,
  property_address,
  property_city,
  property_zip,
  county,
  source,
  source_type,
  status,
  excess_funds_amount AS excess_amount,
  phone AS phone_number,
  phone AS primary_phone,
  email,
  email AS primary_email,
  is_golden_lead,
  expiration_date AS expiry_date,
  lead_class,
  class_reason,
  expected_value,
  daily_rank,
  notes,
  skip_trace_status,
  skip_traced_at,
  created_at,
  updated_at,
  -- Computed fields
  CASE 
    WHEN lead_class = 'A' THEN 'critical'
    WHEN lead_class = 'B' THEN 'high'
    WHEN lead_class = 'C' THEN 'medium'
    ELSE 'low'
  END AS priority,
  eleanor_score AS priority_score,
  priority_tier,
  case_number AS cause_number,
  lead_type,
  scored_at,
  paid_at
FROM maxsam_leads;

COMMENT ON VIEW leads IS 'Backward-compatible view - routes to maxsam_leads. Use maxsam_leads directly for new code.';

-- ============================================================================
-- STEP 4: Create insert function for the view
-- ============================================================================

CREATE OR REPLACE FUNCTION leads_view_insert()
RETURNS TRIGGER AS $$
BEGIN
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
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    NEW.owner_name,
    NEW.property_address,
    NEW.property_city,
    NEW.property_zip,
    NEW.county,
    NEW.source,
    NEW.source_type,
    NEW.status,
    COALESCE(NEW.excess_amount, 0),
    COALESCE(NEW.phone_number, NEW.primary_phone),
    COALESCE(NEW.email, NEW.primary_email),
    COALESCE(NEW.is_golden_lead, FALSE),
    NEW.expiry_date,
    NEW.lead_class,
    NEW.class_reason,
    NEW.expected_value,
    NEW.daily_rank,
    NEW.notes,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER leads_view_insert_trigger
  INSTEAD OF INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_view_insert();

-- ============================================================================
-- STEP 5: Create update function for the view
-- ============================================================================

CREATE OR REPLACE FUNCTION leads_view_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE maxsam_leads SET
    owner_name = COALESCE(NEW.owner_name, owner_name),
    property_address = COALESCE(NEW.property_address, property_address),
    property_city = COALESCE(NEW.property_city, property_city),
    property_zip = COALESCE(NEW.property_zip, property_zip),
    county = COALESCE(NEW.county, county),
    source = COALESCE(NEW.source, source),
    source_type = COALESCE(NEW.source_type, source_type),
    status = COALESCE(NEW.status, status),
    excess_funds_amount = COALESCE(NEW.excess_amount, excess_funds_amount),
    phone = COALESCE(NEW.phone_number, NEW.primary_phone, phone),
    email = COALESCE(NEW.email, NEW.primary_email, email),
    is_golden_lead = COALESCE(NEW.is_golden_lead, is_golden_lead),
    expiration_date = COALESCE(NEW.expiry_date, expiration_date),
    lead_class = COALESCE(NEW.lead_class, lead_class),
    class_reason = COALESCE(NEW.class_reason, class_reason),
    expected_value = COALESCE(NEW.expected_value, expected_value),
    daily_rank = COALESCE(NEW.daily_rank, daily_rank),
    notes = COALESCE(NEW.notes, notes),
    updated_at = NOW()
  WHERE id = OLD.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER leads_view_update_trigger
  INSTEAD OF UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_view_update();

-- ============================================================================
-- STEP 6: Create delete function for the view
-- ============================================================================

CREATE OR REPLACE FUNCTION leads_view_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Soft delete by setting status to 'archived'
  UPDATE maxsam_leads SET
    status = 'archived',
    updated_at = NOW()
  WHERE id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER leads_view_delete_trigger
  INSTEAD OF DELETE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_view_delete();

-- ============================================================================
-- STEP 7: Update dependent views/functions to use maxsam_leads
-- ============================================================================

-- Drop old golden_leads view if it references leads table
DROP VIEW IF EXISTS golden_leads CASCADE;

-- Create new golden_leads view from maxsam_leads
CREATE OR REPLACE VIEW golden_leads AS
SELECT 
  id,
  owner_name,
  property_address,
  excess_funds_amount,
  expected_value,
  phone,
  phone_1,
  phone_2,
  email,
  lead_class,
  class_reason,
  is_golden_lead,
  is_cross_referenced,
  days_until_expiration,
  expiration_date,
  status,
  created_at
FROM maxsam_leads
WHERE is_golden_lead = TRUE
  OR is_cross_referenced = TRUE
  OR lead_class = 'A'
ORDER BY expected_value DESC NULLS LAST;

COMMENT ON VIEW golden_leads IS 'Cross-referenced and Class A leads with dual revenue potential';

-- ============================================================================
-- STEP 8: Create migration log entry
-- ============================================================================

INSERT INTO maxsam_activity_log (
  action,
  entity_type,
  details,
  created_at
) VALUES (
  'MIGRATION_010_COMPLETE',
  'system',
  jsonb_build_object(
    'migration', '010_deprecate_leads',
    'leads_renamed_to', 'leads_legacy',
    'view_created', 'leads',
    'timestamp', NOW()
  ),
  NOW()
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- After running, verify with:
-- SELECT 
--   'leads_legacy' as table_name,
--   (SELECT COUNT(*) FROM leads_legacy) as count
-- UNION ALL
-- SELECT 
--   'maxsam_leads' as table_name,
--   (SELECT COUNT(*) FROM maxsam_leads) as count
-- UNION ALL
-- SELECT 
--   'leads (view)' as table_name,
--   (SELECT COUNT(*) FROM leads) as count;

-- ============================================================================
-- MIGRATION 010 COMPLETE
-- ============================================================================

COMMENT ON TABLE leads_legacy IS 'DEPRECATED - Original leads table, preserved for rollback. Use maxsam_leads.';
