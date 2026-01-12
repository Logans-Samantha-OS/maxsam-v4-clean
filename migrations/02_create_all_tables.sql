-- Phase 2: Ensure all database tables exist

-- LEADS (should exist but verify)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT UNIQUE,
  owner_name TEXT,
  property_address TEXT,
  city TEXT,
  county TEXT,
  state TEXT DEFAULT 'TX',
  excess_amount NUMERIC DEFAULT 0,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'new',
  eleanor_score INTEGER DEFAULT 0,
  golden_lead BOOLEAN DEFAULT false,
  expiration_date DATE,
  source TEXT,
  notes TEXT,
  last_contact TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  do_not_contact BOOLEAN DEFAULT false,
  opted_out BOOLEAN DEFAULT false,
  lead_type TEXT DEFAULT 'excess_funds',
  priority TEXT DEFAULT 'medium',
  phone_1 TEXT,
  phone_2 TEXT,
  property_city TEXT,
  source_county TEXT,
  first_contacted_at TIMESTAMPTZ,
  contact_count INTEGER DEFAULT 0
);

-- BUYERS
CREATE TABLE IF NOT EXISTS buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  preferred_counties TEXT[],
  property_types TEXT[],
  budget_min NUMERIC DEFAULT 0,
  budget_max NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONTRACTS
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  buyer_id UUID REFERENCES buyers(id),
  contract_type TEXT,
  status TEXT DEFAULT 'draft',
  amount NUMERIC,
  fee_amount NUMERIC,
  signed_date DATE,
  expiration_date DATE,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSATIONS (for SMS tracking)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  message TEXT,
  direction TEXT, -- 'inbound' or 'outbound'
  channel TEXT DEFAULT 'sms',
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ACTIVITY_LOG (for KPIs)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  action_type TEXT, -- 'call', 'sms', 'email', 'status_change'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (adjust for production)
DROP POLICY IF EXISTS "Enable all" ON leads;
CREATE POLICY "Enable all" ON leads FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all" ON buyers;
CREATE POLICY "Enable all" ON buyers FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all" ON contracts;
CREATE POLICY "Enable all" ON contracts FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all" ON conversations;
CREATE POLICY "Enable all" ON conversations FOR ALL USING (true);

DROP POLICY IF EXISTS "Enable all" ON activity_log;
CREATE POLICY "Enable all" ON activity_log FOR ALL USING (true);

-- Phase 4: Remove duplicates
WITH duplicates AS (
  SELECT case_number,
         array_agg(id ORDER BY 
           CASE WHEN excess_amount > 0 THEN 0 ELSE 1 END,
           CASE WHEN phone IS NOT NULL THEN 0 ELSE 1 END,
           updated_at DESC
         ) as ids
  FROM leads
  WHERE case_number IS NOT NULL
  GROUP BY case_number
  HAVING COUNT(*) > 1
)
-- Delete all but the best record
DELETE FROM leads 
WHERE id IN (
  SELECT unnest(ids[2:]) FROM duplicates
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE leads 
ADD CONSTRAINT IF NOT EXISTS unique_case_number UNIQUE (case_number);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_golden_lead ON leads(golden_lead);
CREATE INDEX IF NOT EXISTS idx_leads_expiration_date ON leads(expiration_date);
CREATE INDEX IF NOT EXISTS idx_leads_excess_amount ON leads(excess_amount);
CREATE INDEX IF NOT EXISTS idx_buyers_status ON buyers(status);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_lead_id ON activity_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
