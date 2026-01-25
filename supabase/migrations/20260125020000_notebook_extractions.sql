-- ============================================
-- NotebookLM Extractions Table
-- Migration: 20260125020000_notebook_extractions.sql
-- Purpose: Track NotebookLM extractions and lead imports
-- ============================================

-- Create notebook_extractions table
CREATE TABLE IF NOT EXISTS notebook_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source info
  notebook_name TEXT NOT NULL,
  county TEXT NOT NULL,
  query TEXT NOT NULL,

  -- Response data
  raw_response TEXT,
  parsed_leads JSONB DEFAULT '[]'::jsonb,
  leads_count INTEGER DEFAULT 0,

  -- Import tracking
  leads_imported INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,
  leads_updated INTEGER DEFAULT 0,
  import_status TEXT DEFAULT 'pending', -- 'pending', 'importing', 'completed', 'failed'
  import_error TEXT,

  -- Sync metadata
  sync_type TEXT DEFAULT 'manual', -- 'manual', 'scheduled', 'webhook'
  triggered_by TEXT, -- 'dashboard', 'n8n', 'api'
  execution_id TEXT, -- For N8N workflow tracking

  -- Timestamps
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notebook_extractions_county
ON notebook_extractions(county);

CREATE INDEX IF NOT EXISTS idx_notebook_extractions_notebook
ON notebook_extractions(notebook_name);

CREATE INDEX IF NOT EXISTS idx_notebook_extractions_status
ON notebook_extractions(import_status);

CREATE INDEX IF NOT EXISTS idx_notebook_extractions_created
ON notebook_extractions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notebook_extractions_sync_type
ON notebook_extractions(sync_type);

-- Enable RLS
ALTER TABLE notebook_extractions ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to notebook_extractions"
ON notebook_extractions FOR ALL
USING (true)
WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_notebook_extractions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notebook_extractions_updated_at
  BEFORE UPDATE ON notebook_extractions
  FOR EACH ROW
  EXECUTE FUNCTION update_notebook_extractions_updated_at();

-- Helper function to log an extraction
CREATE OR REPLACE FUNCTION log_notebook_extraction(
  p_notebook_name TEXT,
  p_county TEXT,
  p_query TEXT,
  p_raw_response TEXT,
  p_parsed_leads JSONB DEFAULT '[]'::jsonb,
  p_sync_type TEXT DEFAULT 'manual',
  p_triggered_by TEXT DEFAULT 'api'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_leads_count INTEGER;
BEGIN
  -- Count leads in the parsed array
  v_leads_count := jsonb_array_length(COALESCE(p_parsed_leads, '[]'::jsonb));

  INSERT INTO notebook_extractions (
    notebook_name, county, query, raw_response,
    parsed_leads, leads_count, sync_type, triggered_by
  )
  VALUES (
    p_notebook_name, p_county, p_query, p_raw_response,
    p_parsed_leads, v_leads_count, p_sync_type, p_triggered_by
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to update extraction import status
CREATE OR REPLACE FUNCTION update_extraction_import(
  p_id UUID,
  p_status TEXT,
  p_leads_imported INTEGER DEFAULT 0,
  p_leads_skipped INTEGER DEFAULT 0,
  p_leads_updated INTEGER DEFAULT 0,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE notebook_extractions SET
    import_status = p_status,
    leads_imported = p_leads_imported,
    leads_skipped = p_leads_skipped,
    leads_updated = p_leads_updated,
    import_error = p_error,
    imported_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE imported_at END
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- View for extraction statistics
CREATE OR REPLACE VIEW notebook_extraction_stats AS
SELECT
  county,
  notebook_name,
  COUNT(*) as total_extractions,
  SUM(leads_count) as total_leads_extracted,
  SUM(leads_imported) as total_leads_imported,
  SUM(leads_skipped) as total_leads_skipped,
  SUM(leads_updated) as total_leads_updated,
  MAX(created_at) as last_extraction,
  COUNT(CASE WHEN import_status = 'completed' THEN 1 END) as successful_imports,
  COUNT(CASE WHEN import_status = 'failed' THEN 1 END) as failed_imports
FROM notebook_extractions
GROUP BY county, notebook_name
ORDER BY last_extraction DESC;

-- Grant permissions
GRANT EXECUTE ON FUNCTION log_notebook_extraction TO authenticated;
GRANT EXECUTE ON FUNCTION update_extraction_import TO authenticated;

-- Comments
COMMENT ON TABLE notebook_extractions IS 'Tracks NotebookLM extractions and lead imports for MaxSam V4';
COMMENT ON FUNCTION log_notebook_extraction IS 'Creates a new notebook extraction record';
COMMENT ON FUNCTION update_extraction_import IS 'Updates the import status and counts for an extraction';
