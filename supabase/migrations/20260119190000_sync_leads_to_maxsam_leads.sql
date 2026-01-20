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
-- ============================================================================

-- Step 1: Ensure maxsam_leads table exists
CREATE TABLE IF NOT EXISTS maxsam_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name TEXT,
  property_address TEXT,
  excess_funds_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add ALL missing columns to maxsam_leads
DO $$
BEGIN
  -- Core fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'case_number') THEN
    ALTER TABLE maxsam_leads ADD COLUMN case_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'city') THEN
    ALTER TABLE maxsam_leads ADD COLUMN city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'county') THEN
    ALTER TABLE maxsam_leads ADD COLUMN county TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'state') THEN
    ALTER TABLE maxsam_leads ADD COLUMN state TEXT DEFAULT 'TX';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'zip_code') THEN
    ALTER TABLE maxsam_leads ADD COLUMN zip_code TEXT;
  END IF;

  -- Contact fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'phone') THEN
    ALTER TABLE maxsam_leads ADD COLUMN phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'phone_1') THEN
    ALTER TABLE maxsam_leads ADD COLUMN phone_1 TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'phone_2') THEN
    ALTER TABLE maxsam_leads ADD COLUMN phone_2 TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'email') THEN
    ALTER TABLE maxsam_leads ADD COLUMN email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'primary_phone') THEN
    ALTER TABLE maxsam_leads ADD COLUMN primary_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'primary_email') THEN
    ALTER TABLE maxsam_leads ADD COLUMN primary_email TEXT;
  END IF;

  -- Scoring fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'eleanor_score') THEN
    ALTER TABLE maxsam_leads ADD COLUMN eleanor_score INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'deal_grade') THEN
    ALTER TABLE maxsam_leads ADD COLUMN deal_grade TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'contact_priority') THEN
    ALTER TABLE maxsam_leads ADD COLUMN contact_priority TEXT DEFAULT 'cold';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'deal_type') THEN
    ALTER TABLE maxsam_leads ADD COLUMN deal_type TEXT DEFAULT 'excess_only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'eleanor_reasoning') THEN
    ALTER TABLE maxsam_leads ADD COLUMN eleanor_reasoning TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'scored_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN scored_at TIMESTAMPTZ;
  END IF;

  -- Financial fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'potential_revenue') THEN
    ALTER TABLE maxsam_leads ADD COLUMN potential_revenue DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'excess_fee') THEN
    ALTER TABLE maxsam_leads ADD COLUMN excess_fee DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'wholesale_fee') THEN
    ALTER TABLE maxsam_leads ADD COLUMN wholesale_fee DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'estimated_equity') THEN
    ALTER TABLE maxsam_leads ADD COLUMN estimated_equity DECIMAL(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'estimated_arv') THEN
    ALTER TABLE maxsam_leads ADD COLUMN estimated_arv DECIMAL(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'estimated_repair_cost') THEN
    ALTER TABLE maxsam_leads ADD COLUMN estimated_repair_cost DECIMAL(12,2);
  END IF;

  -- Golden lead fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'golden_lead') THEN
    ALTER TABLE maxsam_leads ADD COLUMN golden_lead BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'is_golden_lead') THEN
    ALTER TABLE maxsam_leads ADD COLUMN is_golden_lead BOOLEAN DEFAULT false;
  END IF;

  -- Expiration fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'expiration_date') THEN
    ALTER TABLE maxsam_leads ADD COLUMN expiration_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'days_until_expiration') THEN
    ALTER TABLE maxsam_leads ADD COLUMN days_until_expiration INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'sale_date') THEN
    ALTER TABLE maxsam_leads ADD COLUMN sale_date TEXT;
  END IF;

  -- Source/tracking fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'source') THEN
    ALTER TABLE maxsam_leads ADD COLUMN source TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'notes') THEN
    ALTER TABLE maxsam_leads ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'lead_class') THEN
    ALTER TABLE maxsam_leads ADD COLUMN lead_class TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'skip_trace_status') THEN
    ALTER TABLE maxsam_leads ADD COLUMN skip_trace_status TEXT DEFAULT 'pending';
  END IF;

  -- Contact tracking fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'last_contact') THEN
    ALTER TABLE maxsam_leads ADD COLUMN last_contact TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'last_contact_date') THEN
    ALTER TABLE maxsam_leads ADD COLUMN last_contact_date TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'first_contacted_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN first_contacted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'contact_attempts') THEN
    ALTER TABLE maxsam_leads ADD COLUMN contact_attempts INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'contact_count') THEN
    ALTER TABLE maxsam_leads ADD COLUMN contact_count INTEGER DEFAULT 0;
  END IF;

  -- Opt-out fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'do_not_contact') THEN
    ALTER TABLE maxsam_leads ADD COLUMN do_not_contact BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'opted_out') THEN
    ALTER TABLE maxsam_leads ADD COLUMN opted_out BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Step 3: Enable RLS on maxsam_leads
ALTER TABLE maxsam_leads ENABLE ROW LEVEL SECURITY;

-- Create permissive policy
DROP POLICY IF EXISTS "Enable all for maxsam_leads" ON maxsam_leads;
CREATE POLICY "Enable all for maxsam_leads" ON maxsam_leads FOR ALL USING (true);

-- Step 4: Sync data from leads to maxsam_leads (only if leads table exists)
DO $$
BEGIN
  -- Check if leads table exists before trying to sync
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    INSERT INTO maxsam_leads (
      id,
      case_number,
      owner_name,
      property_address,
      city,
      county,
      state,
      excess_funds_amount,
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
      COALESCE(l.excess_amount, 0) as excess_funds_amount,
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

    RAISE NOTICE 'Synced leads from leads table to maxsam_leads';
  ELSE
    RAISE NOTICE 'leads table does not exist, skipping sync';
  END IF;
EXCEPTION
  WHEN undefined_column THEN
    RAISE NOTICE 'Column mismatch during sync, some columns may not exist in leads table';
  WHEN OTHERS THEN
    RAISE NOTICE 'Error during sync: %', SQLERRM;
END $$;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_case_number ON maxsam_leads(case_number);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_status ON maxsam_leads(status);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_eleanor_score ON maxsam_leads(eleanor_score DESC);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_excess_funds ON maxsam_leads(excess_funds_amount DESC);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_golden_lead ON maxsam_leads(is_golden_lead);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_deal_grade ON maxsam_leads(deal_grade);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_skip_trace ON maxsam_leads(skip_trace_status);

-- Step 6: Log the migration
DO $$
BEGIN
  INSERT INTO system_config (key, value)
  VALUES ('migration_009_completed', NOW()::text)
  ON CONFLICT (key) DO UPDATE SET value = NOW()::text;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'system_config table does not exist, skipping log';
END $$;

SELECT 'Migration 009 complete - maxsam_leads table ready' AS result;
