-- ============================================
-- ALEX NotebookLM Cache Table
-- Migration: 20260124100000_notebook_cache.sql
-- Purpose: Cache notebook queries to reduce API calls and improve response time
-- ============================================

-- Create notebook_cache table
CREATE TABLE IF NOT EXISTS notebook_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_name TEXT NOT NULL,
  question_hash TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE(notebook_name, question_hash)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_notebook_cache_lookup
ON notebook_cache(notebook_name, question_hash);

-- Create index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_notebook_cache_expires
ON notebook_cache(expires_at);

-- Add RLS policies
ALTER TABLE notebook_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to notebook_cache"
ON notebook_cache FOR ALL
USING (true)
WITH CHECK (true);

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_notebook_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notebook_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE notebook_cache IS 'Cache for ALEX NotebookLM queries to reduce API calls and improve response time';
COMMENT ON COLUMN notebook_cache.notebook_name IS 'Name of the NotebookLM notebook (e.g., TX_Dallas_County_Playbook)';
COMMENT ON COLUMN notebook_cache.question_hash IS 'MD5 hash of the normalized question for fast lookup';
COMMENT ON COLUMN notebook_cache.question IS 'Original question text';
COMMENT ON COLUMN notebook_cache.answer IS 'Cached answer from NotebookLM';
COMMENT ON COLUMN notebook_cache.sources IS 'JSON array of source documents used in the answer';
COMMENT ON COLUMN notebook_cache.hit_count IS 'Number of times this cache entry has been used';
COMMENT ON COLUMN notebook_cache.expires_at IS 'When this cache entry expires (default 24 hours)';
