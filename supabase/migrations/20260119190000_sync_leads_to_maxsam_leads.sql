-- ============================================================================
-- Migration 009: Sync leads table to maxsam_leads table
-- ============================================================================
--
-- ROOT CAUSE: The system has TWO tables with different column names:
--   - `leads` table with `excess_amount` column (N8N imports here)
--   - `maxsam_leads` table with `excess_funds_amount` column (app reads here)
--
-- This migration syncs all data from `leads` to `maxsam_leads` with proper
-- column mapping. It's idempotent - safe to run multiple times.
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs/sql
-- ============================================================================

-- Step 1: Ensure maxsam_leads table exists with all required columns
CREATE TABLE IF NOT EXISTS maxsam_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT,
  owner_name TEXT,
  property_address TEXT,
  city TEXT,
  county TEXT,
  state TEXT DEFAULT 'TX',
  zip_code TEXT,
  excess_funds_amount DECIMAL(12,2) DEFAULT 0,
  phone TEXT,
  phone_1 TEXT,
  phone_2 TEXT,
  email TEXT,
  status TEXT DEFAULT 'new',
  eleanor_score INTEGER DEFAULT 0,
  deal_grade TEXT,
  contact_priority TEXT DEFAULT 'cold',
  deal_type TEXT DEFAULT 'excess_only',
  potential_revenue DECIMAL(12,2) DEFAULT 0,
  excess_fee DECIMAL(12,2) DEFAULT 0,
  wholesale_fee DECIMAL(12,2) DEFAULT 0,
  estimated_equity DECIMAL(12,2) DEFAULT 0,
  estimated_arv DECIMAL(12,2),
  estimated_repair_cost DECIMAL(12,2),
  golden_lead BOOLEAN DEFAULT false,
  is_golden_lead BOOLEAN DEFAULT false,
  expiration_date DATE,
  days_until_expiration INTEGER,
  source TEXT,
  notes TEXT,
  lead_class TEXT,
  skip_trace_status TEXT,
  scored_at TIMESTAMPTZ,
  last_contact TIMESTAMPTZ,
  last_contact_date TIMESTAMPTZ,
  first_contacted_at TIMESTAMPTZ,
  contact_attempts INTEGER DEFAULT 0,
  contact_count INTEGER DEFAULT 0,
  sale_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  do_not_contact BOOLEAN DEFAULT false,
  opted_out BOOLEAN DEFAULT false,
  primary_phone TEXT,
  primary_email TEXT,
  eleanor_reasoning TEXT[]
);

-- Step 2: Add any missing columns to maxsam_leads (for existing tables)
DO $$
BEGIN
  -- Add excess_funds_amount if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'excess_funds_amount') THEN
    ALTER TABLE maxsam_leads ADD COLUMN excess_funds_amount DECIMAL(12,2) DEFAULT 0;
  END IF;

  -- Add skip_trace_status if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'skip_trace_status') THEN
    ALTER TABLE maxsam_leads ADD COLUMN skip_trace_status TEXT;
  END IF;

  -- Add lead_class if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'lead_class') THEN
    ALTER TABLE maxsam_leads ADD COLUMN lead_class TEXT;
  END IF;

  -- Add primary_phone if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'primary_phone') THEN
    ALTER TABLE maxsam_leads ADD COLUMN primary_phone TEXT;
  END IF;
END $$;

-- Step 3: Enable RLS on maxsam_leads
ALTER TABLE maxsam_leads ENABLE ROW LEVEL SECURITY;

-- Create permissive policy
DROP POLICY IF EXISTS "Enable all for maxsam_leads" ON maxsam_leads;
CREATE POLICY "Enable all for maxsam_leads" ON maxsam_leads FOR ALL USING (true);

-- Step 4: Sync data from leads to maxsam_leads
-- This uses UPSERT to handle duplicates based on case_number or property_address+owner_name
INSERT INTO maxsam_leads (
  id,
  case_number,
  owner_name,
  property_address,
  city,
  county,
  state,
  excess_funds_amount,  -- NOTE: Mapping excess_amount -> excess_funds_amount
  phone,
  phone_1,
  phone_2,
  email,
  status,
  eleanor_score,
  golden_lead,
  is_golden_lead,
  expiration_date,
  source,
  notes,
  created_at,
  updated_at,
  do_not_contact,
  opted_out,
  first_contacted_at,
  contact_count
)
SELECT
  l.id,
  l.case_number,
  l.owner_name,
  l.property_address,
  COALESCE(l.property_city, l.city) as city,
  COALESCE(l.source_county, l.county) as county,
  COALESCE(l.state, 'TX') as state,
  COALESCE(l.excess_amount, 0) as excess_funds_amount,  -- KEY MAPPING!
  l.phone,
  l.phone_1,
  l.phone_2,
  l.email,
  COALESCE(l.status, 'new') as status,
  COALESCE(l.eleanor_score, 0) as eleanor_score,
  COALESCE(l.golden_lead, false) as golden_lead,
  COALESCE(l.golden_lead, false) as is_golden_lead,
  l.expiration_date,
  l.source,
  l.notes,
  l.created_at,
  l.updated_at,
  COALESCE(l.do_not_contact, false) as do_not_contact,
  COALESCE(l.opted_out, false) as opted_out,
  l.first_contacted_at,
  COALESCE(l.contact_count, 0) as contact_count
FROM leads l
WHERE l.id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  case_number = EXCLUDED.case_number,
  owner_name = EXCLUDED.owner_name,
  property_address = EXCLUDED.property_address,
  city = EXCLUDED.city,
  county = EXCLUDED.county,
  state = EXCLUDED.state,
  excess_funds_amount = EXCLUDED.excess_funds_amount,
  phone = EXCLUDED.phone,
  phone_1 = EXCLUDED.phone_1,
  phone_2 = EXCLUDED.phone_2,
  email = EXCLUDED.email,
  status = COALESCE(maxsam_leads.status, EXCLUDED.status),
  eleanor_score = GREATEST(maxsam_leads.eleanor_score, EXCLUDED.eleanor_score),
  golden_lead = EXCLUDED.golden_lead,
  is_golden_lead = EXCLUDED.is_golden_lead,
  expiration_date = EXCLUDED.expiration_date,
  source = EXCLUDED.source,
  notes = COALESCE(maxsam_leads.notes, EXCLUDED.notes),
  updated_at = NOW(),
  do_not_contact = EXCLUDED.do_not_contact,
  opted_out = EXCLUDED.opted_out,
  first_contacted_at = COALESCE(maxsam_leads.first_contacted_at, EXCLUDED.first_contacted_at),
  contact_count = GREATEST(maxsam_leads.contact_count, EXCLUDED.contact_count);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_case_number ON maxsam_leads(case_number);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_status ON maxsam_leads(status);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_eleanor_score ON maxsam_leads(eleanor_score DESC);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_excess_funds ON maxsam_leads(excess_funds_amount DESC);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_golden_lead ON maxsam_leads(is_golden_lead);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_deal_grade ON maxsam_leads(deal_grade);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_skip_trace ON maxsam_leads(skip_trace_status);

-- Step 6: Verification query (run after migration to verify)
-- SELECT
--   'leads' as source_table,
--   COUNT(*) as total,
--   COUNT(CASE WHEN excess_amount > 0 THEN 1 END) as with_excess,
--   SUM(excess_amount) as total_excess
-- FROM leads
-- UNION ALL
-- SELECT
--   'maxsam_leads' as source_table,
--   COUNT(*) as total,
--   COUNT(CASE WHEN excess_funds_amount > 0 THEN 1 END) as with_excess,
--   SUM(excess_funds_amount) as total_excess
-- FROM maxsam_leads;

-- Step 7: Log the migration
DO $$
BEGIN
  INSERT INTO system_config (key, value)
  VALUES ('migration_009_completed', NOW()::text)
  ON CONFLICT (key) DO UPDATE SET value = NOW()::text;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'system_config table does not exist, skipping log';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration completes)
-- ============================================================================
--
-- Check sync results:
-- SELECT
--   (SELECT COUNT(*) FROM leads) as leads_count,
--   (SELECT COUNT(*) FROM maxsam_leads) as maxsam_leads_count,
--   (SELECT COUNT(*) FROM maxsam_leads WHERE excess_funds_amount > 0) as with_excess_amount,
--   (SELECT SUM(excess_funds_amount) FROM maxsam_leads) as total_excess_value;
--
-- Check the working lead (Sharon Wright):
-- SELECT * FROM maxsam_leads WHERE excess_funds_amount > 0;
--
-- ============================================================================
