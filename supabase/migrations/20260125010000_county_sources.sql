-- ============================================
-- County Sources Enhancement
-- Migration: 20260125010000_county_sources.sql
-- Purpose: Add automation fields to existing county_sources table for N8N fetching
-- Note: county_sources table was created in 20260124000000_multi_county_golden_hunter.sql
-- ============================================

-- Add new columns to existing county_sources table
ALTER TABLE county_sources ADD COLUMN IF NOT EXISTS auto_fetch BOOLEAN DEFAULT true;
ALTER TABLE county_sources ADD COLUMN IF NOT EXISTS last_lead_count INTEGER DEFAULT 0;
ALTER TABLE county_sources ADD COLUMN IF NOT EXISTS last_fetch_success BOOLEAN;
ALTER TABLE county_sources ADD COLUMN IF NOT EXISTS total_fetches INTEGER DEFAULT 0;
ALTER TABLE county_sources ADD COLUMN IF NOT EXISTS notebook_name TEXT;
ALTER TABLE county_sources ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE county_sources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for active auto-fetch sources
CREATE INDEX IF NOT EXISTS idx_county_sources_active_fetch
ON county_sources(is_active, auto_fetch) WHERE is_active = true AND auto_fetch = true;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_county_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS county_sources_updated_at ON county_sources;
CREATE TRIGGER county_sources_updated_at
  BEFORE UPDATE ON county_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_county_sources_updated_at();

-- Update DFW Metro counties with notebook routing info
UPDATE county_sources SET
  notebook_name = 'TX_Dallas_County_Playbook',
  region = 'DFW Metro',
  auto_fetch = true
WHERE county_name IN ('Dallas', 'Tarrant', 'Collin', 'Denton');

-- Comments
COMMENT ON COLUMN county_sources.auto_fetch IS 'If true, N8N will automatically fetch documents from this source';
COMMENT ON COLUMN county_sources.notebook_name IS 'NotebookLM notebook for this county region';
COMMENT ON COLUMN county_sources.region IS 'Geographic region grouping for notebook routing';


-- ============================================
-- Document Ingestion Table
-- Purpose: Track document ingestion history and status
-- ============================================

CREATE TABLE IF NOT EXISTS document_ingestion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source info
  source_id UUID REFERENCES county_sources(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL, -- 'county_fetch', 'manual_upload', 'google_drive'
  source_url TEXT,
  file_name TEXT,
  file_type TEXT, -- 'pdf', 'html', 'csv'

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Results
  raw_content TEXT,
  parsed_content JSONB,
  leads_extracted INTEGER DEFAULT 0,
  leads_inserted INTEGER DEFAULT 0,
  leads_updated INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,

  -- Metadata
  processed_by TEXT, -- 'n8n', 'api', 'manual'
  workflow_id TEXT,
  execution_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_ingestion_status
ON document_ingestion(status);

CREATE INDEX IF NOT EXISTS idx_document_ingestion_source
ON document_ingestion(source_id);

CREATE INDEX IF NOT EXISTS idx_document_ingestion_created
ON document_ingestion(created_at DESC);

-- Enable RLS
ALTER TABLE document_ingestion ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to document_ingestion"
ON document_ingestion FOR ALL
USING (true)
WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_document_ingestion_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_ingestion_updated_at
  BEFORE UPDATE ON document_ingestion
  FOR EACH ROW
  EXECUTE FUNCTION update_document_ingestion_updated_at();

-- Function to log document ingestion
CREATE OR REPLACE FUNCTION log_document_ingestion(
  p_source_type TEXT,
  p_source_url TEXT,
  p_file_name TEXT DEFAULT NULL,
  p_file_type TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO document_ingestion (source_id, source_type, source_url, file_name, file_type, status)
  VALUES (p_source_id, p_source_type, p_source_url, p_file_name, p_file_type, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update ingestion status
CREATE OR REPLACE FUNCTION update_ingestion_status(
  p_id UUID,
  p_status TEXT,
  p_leads_extracted INTEGER DEFAULT 0,
  p_leads_inserted INTEGER DEFAULT 0,
  p_leads_updated INTEGER DEFAULT 0,
  p_leads_skipped INTEGER DEFAULT 0,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE document_ingestion SET
    status = p_status,
    leads_extracted = p_leads_extracted,
    leads_inserted = p_leads_inserted,
    leads_updated = p_leads_updated,
    leads_skipped = p_leads_skipped,
    error_message = p_error_message,
    completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
    started_at = CASE WHEN p_status = 'processing' AND started_at IS NULL THEN NOW() ELSE started_at END
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE document_ingestion IS 'Tracks document ingestion history and processing status';
COMMENT ON FUNCTION log_document_ingestion IS 'Creates a new document ingestion record';
COMMENT ON FUNCTION update_ingestion_status IS 'Updates the status and results of a document ingestion';
