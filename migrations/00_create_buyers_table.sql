-- Create buyers table if it doesn't exist
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

-- Enable RLS
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated access
CREATE POLICY "Enable all" ON buyers FOR ALL USING (true);
