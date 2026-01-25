-- ============================================
-- ALEX Knowledge Chunks Table
-- Migration: 20260125000000_knowledge_chunks.sql
-- Purpose: Store knowledge chunks in Supabase for direct querying
-- This replaces the need for an external MCP server
-- ============================================

-- Create knowledge_sources table
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'document',
  description TEXT,
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create knowledge_chunks table
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  -- Text search vector for full-text search
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source
ON knowledge_chunks(source_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search
ON knowledge_chunks USING GIN(search_vector);

-- Create index on sources
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type
ON knowledge_sources(type);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_name
ON knowledge_sources(name);

-- Add RLS policies
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to knowledge_sources"
ON knowledge_sources FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access to knowledge_chunks"
ON knowledge_chunks FOR ALL
USING (true)
WITH CHECK (true);

-- Function to search knowledge by keyword
CREATE OR REPLACE FUNCTION search_knowledge(
  search_query TEXT,
  max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  chunk_id UUID,
  content TEXT,
  source_id UUID,
  source_name TEXT,
  source_type TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id AS chunk_id,
    kc.content,
    ks.id AS source_id,
    ks.name AS source_name,
    ks.type AS source_type,
    ts_rank(kc.search_vector, plainto_tsquery('english', search_query)) AS rank
  FROM knowledge_chunks kc
  JOIN knowledge_sources ks ON kc.source_id = ks.id
  WHERE kc.search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to add a knowledge document
CREATE OR REPLACE FUNCTION add_knowledge_document(
  p_name TEXT,
  p_type TEXT,
  p_description TEXT,
  p_content TEXT
)
RETURNS UUID AS $$
DECLARE
  v_source_id UUID;
  v_chunk_count INTEGER;
BEGIN
  -- Create the source
  INSERT INTO knowledge_sources (name, type, description)
  VALUES (p_name, p_type, p_description)
  RETURNING id INTO v_source_id;

  -- For now, store as single chunk (could be enhanced to split into multiple)
  INSERT INTO knowledge_chunks (source_id, content, chunk_index)
  VALUES (v_source_id, p_content, 0);

  -- Update chunk count
  UPDATE knowledge_sources SET chunk_count = 1 WHERE id = v_source_id;

  RETURN v_source_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE knowledge_sources IS 'Sources of knowledge (documents, templates, patterns) for ALEX';
COMMENT ON TABLE knowledge_chunks IS 'Searchable chunks of knowledge content';
COMMENT ON FUNCTION search_knowledge IS 'Full-text search across knowledge chunks';
COMMENT ON FUNCTION add_knowledge_document IS 'Add a new document to the knowledge base';

-- Seed some initial knowledge for Dallas County
INSERT INTO knowledge_sources (id, name, type, description, chunk_count) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Dallas County Excess Funds Filing', 'document', 'How to file excess funds claims with Dallas County', 1),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Sam Outreach Templates', 'template', 'SMS templates for excess funds recovery outreach', 1),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Eleanor Scoring System', 'document', 'Lead scoring methodology for prioritization', 1)
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_chunks (source_id, content, chunk_index) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001',
   'DALLAS COUNTY EXCESS FUNDS FILING PROCESS:

1. Obtain the official excess funds list from Dallas County District Clerk website
2. Identify claimants with amounts above $10,000 for best ROI
3. Skip trace owners using TruePeopleSearch or similar tools
4. Send introduction SMS explaining the excess funds opportunity
5. If owner responds positively, send 25% fee recovery agreement
6. Once signed, gather required documentation:
   - Original deed or chain of title
   - Government-issued ID
   - Notarized affidavit of identity
7. File claim with Dallas County District Clerk
8. Dallas County reviews claim (typically 30-90 days)
9. Upon approval, county issues check to claimant
10. Collect 25% fee per agreement

Dallas County Excess Funds URL: https://www.dallascounty.org/government/district-clerk/excess-funds/
Contact: Dallas County District Clerk - Civil Division
Phone: (214) 653-7620', 0),

  ('a1b2c3d4-0002-0000-0000-000000000002',
   'SAM OUTREACH TEMPLATES:

INITIAL CONTACT:
"Hi {owner_name}! I found ${amount} in unclaimed funds from {street_address} that may belong to you. These are from a past tax sale and can expire if not claimed. No upfront cost to you - interested in learning more?"

RESPONSE TO "WHO IS THIS?":
"I apologize for the abrupt message! My name is Sam, and I work with a team that specializes in helping people recover funds from tax foreclosure sales. We dont charge anything upfront - we only get paid if we successfully recover your money."

RESPONSE TO "HOW DID YOU GET MY NUMBER?":
"We use publicly available records to find property owners who may be owed money from past foreclosure sales. This is all public information - we just do the research to connect people with funds they may not know exist."

RESPONSE TO "HOW MUCH DO YOU CHARGE?":
"Our fee is 25% of what we recover - and only if we succeed. If we dont recover anything, you owe nothing. For your ${amount} potential claim, our fee would be around ${fee_amount}, meaning youd receive about ${net_amount}."

URGENCY FOLLOW-UP:
"Just checking in about those excess funds. The county deadline can make these funds harder to claim over time. Want me to send you more details?"', 0),

  ('a1b2c3d4-0003-0000-0000-000000000003',
   'ELEANOR LEAD SCORING SYSTEM:

Eleanor scores leads 0-100 based on:

EXCESS FUNDS AMOUNT (40 points max):
- $50K+: 40 points
- $30K+: 35 points
- $20K+: 30 points
- $15K+: 25 points
- $10K+: 20 points
- $5K+: 10 points

DEAL POTENTIAL (25 points max):
- High equity property: +25 points
- Medium equity: +15 points
- Low equity: +5 points

CONTACT QUALITY (20 points max):
- Valid phone: +10 points
- Valid email: +5 points
- Full name match: +5 points

LOCATION (10 points max):
- Hot zip codes (affluent Dallas areas): +10 points
- Warm zip codes: +7 points
- Standard: +3 points

RISK FACTORS (negative points):
- Prior claims filed: -10 points
- Bad phone data: -5 points
- Multiple owners: -5 points

GRADES:
- A+ (85-100): Hot lead, immediate outreach
- A (75-84): High priority
- B (60-74): Standard priority
- C (45-59): Lower priority
- D (<45): Low potential', 0)
ON CONFLICT DO NOTHING;
