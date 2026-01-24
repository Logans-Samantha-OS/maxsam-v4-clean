-- ============================================
-- ALEX Notebook Routing Table
-- Migration: 20260124110000_notebook_routing.sql
-- Purpose: Track which notebook handles each county and query statistics
-- ============================================

-- Create notebook_routing table
CREATE TABLE IF NOT EXISTS notebook_routing (
  county TEXT PRIMARY KEY,
  notebook_name TEXT NOT NULL,
  region TEXT,
  last_queried_at TIMESTAMPTZ,
  query_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for notebook lookups
CREATE INDEX IF NOT EXISTS idx_notebook_routing_notebook
ON notebook_routing(notebook_name);

-- Add RLS policies
ALTER TABLE notebook_routing ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to notebook_routing"
ON notebook_routing FOR ALL
USING (true)
WITH CHECK (true);

-- Function to increment query count
CREATE OR REPLACE FUNCTION increment_notebook_routing_count(p_county TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE notebook_routing
  SET
    query_count = query_count + 1,
    last_queried_at = NOW(),
    updated_at = NOW()
  WHERE county = p_county;
END;
$$ LANGUAGE plpgsql;

-- Insert initial county-to-notebook mappings
-- DFW Metro
INSERT INTO notebook_routing (county, notebook_name, region) VALUES
  ('Dallas', 'TX_Dallas_County_Playbook', 'DFW Metro'),
  ('Tarrant', 'TX_Dallas_County_Playbook', 'DFW Metro'),
  ('Collin', 'TX_Dallas_County_Playbook', 'DFW Metro'),
  ('Denton', 'TX_Dallas_County_Playbook', 'DFW Metro'),
  ('Rockwall', 'TX_Dallas_County_Playbook', 'DFW Metro'),
  ('Ellis', 'TX_Dallas_County_Playbook', 'DFW Metro'),
  ('Johnson', 'TX_Dallas_County_Playbook', 'DFW Metro'),
  ('Kaufman', 'TX_Dallas_County_Playbook', 'DFW Metro'),
  ('Parker', 'TX_Dallas_County_Playbook', 'DFW Metro'),
  ('Wise', 'TX_Dallas_County_Playbook', 'DFW Metro')
ON CONFLICT (county) DO NOTHING;

-- Houston Metro (future: TX_Houston_Metro)
INSERT INTO notebook_routing (county, notebook_name, region) VALUES
  ('Harris', 'TX_Dallas_County_Playbook', 'Houston Metro'),
  ('Fort Bend', 'TX_Dallas_County_Playbook', 'Houston Metro'),
  ('Montgomery', 'TX_Dallas_County_Playbook', 'Houston Metro'),
  ('Brazoria', 'TX_Dallas_County_Playbook', 'Houston Metro'),
  ('Galveston', 'TX_Dallas_County_Playbook', 'Houston Metro')
ON CONFLICT (county) DO NOTHING;

-- Austin / San Antonio (future: TX_Austin_SanAntonio)
INSERT INTO notebook_routing (county, notebook_name, region) VALUES
  ('Travis', 'TX_Dallas_County_Playbook', 'Austin / San Antonio'),
  ('Williamson', 'TX_Dallas_County_Playbook', 'Austin / San Antonio'),
  ('Hays', 'TX_Dallas_County_Playbook', 'Austin / San Antonio'),
  ('Bexar', 'TX_Dallas_County_Playbook', 'Austin / San Antonio'),
  ('Comal', 'TX_Dallas_County_Playbook', 'Austin / San Antonio')
ON CONFLICT (county) DO NOTHING;

-- Other Major Texas Counties
INSERT INTO notebook_routing (county, notebook_name, region) VALUES
  ('El Paso', 'TX_Dallas_County_Playbook', 'Other'),
  ('Hidalgo', 'TX_Dallas_County_Playbook', 'Other'),
  ('Cameron', 'TX_Dallas_County_Playbook', 'Other'),
  ('Nueces', 'TX_Dallas_County_Playbook', 'Other'),
  ('Lubbock', 'TX_Dallas_County_Playbook', 'Other'),
  ('McLennan', 'TX_Dallas_County_Playbook', 'Other'),
  ('Bell', 'TX_Dallas_County_Playbook', 'Other')
ON CONFLICT (county) DO NOTHING;

-- Comments
COMMENT ON TABLE notebook_routing IS 'Maps Texas counties to NotebookLM notebooks for ALEX queries';
COMMENT ON COLUMN notebook_routing.county IS 'County name (e.g., Dallas, Tarrant, Harris)';
COMMENT ON COLUMN notebook_routing.notebook_name IS 'NotebookLM notebook name to query for this county';
COMMENT ON COLUMN notebook_routing.region IS 'Geographic region (DFW Metro, Houston Metro, etc.)';
COMMENT ON COLUMN notebook_routing.query_count IS 'Number of times this county has been queried';
COMMENT ON COLUMN notebook_routing.last_queried_at IS 'Timestamp of last query for this county';

-- Create view for routing statistics
CREATE OR REPLACE VIEW notebook_routing_stats AS
SELECT
  notebook_name,
  region,
  COUNT(*) as county_count,
  SUM(query_count) as total_queries,
  MAX(last_queried_at) as last_activity
FROM notebook_routing
GROUP BY notebook_name, region
ORDER BY total_queries DESC;
