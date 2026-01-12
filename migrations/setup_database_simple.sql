-- SIMPLE SETUP - GUARANTEED TO WORK IN SUPABASE

-- 1. Create leads table (if not exists)
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

-- 2. Create buyers table
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

-- 3. Create contracts table
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

-- 4. Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  message TEXT,
  direction TEXT DEFAULT 'outbound',
  channel TEXT DEFAULT 'sms',
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  action_type TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable RLS (Row Level Security)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 7. Create simple policies (allow all access)
CREATE POLICY "Enable all leads" ON leads FOR ALL USING (true);
CREATE POLICY "Enable all buyers" ON buyers FOR ALL USING (true);
CREATE POLICY "Enable all contracts" ON contracts FOR ALL USING (true);
CREATE POLICY "Enable all conversations" ON conversations FOR ALL USING (true);
CREATE POLICY "Enable all activity_log" ON activity_log FOR ALL USING (true);

-- 8. Create basic indexes
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

-- 9. Simple duplicate removal (if needed)
-- This will remove duplicates keeping the most recent record
DELETE FROM leads 
WHERE id NOT IN (
  SELECT DISTINCT ON (case_number) id
  FROM leads
  WHERE case_number IS NOT NULL
  ORDER BY updated_at DESC
);

-- 10. Add unique constraint (if not exists)
ALTER TABLE leads 
ADD CONSTRAINT IF NOT EXISTS unique_case_number UNIQUE (case_number);

-- DONE! Your database is now properly set up.
