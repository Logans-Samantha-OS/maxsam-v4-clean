-- Message Intelligence Phase 1 - READ-ONLY Intelligence
-- MaxSam V4 - Message Analysis Table
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs/sql
--
-- This table stores AI analysis of inbound/outbound messages
-- Phase 1 is READ-ONLY intelligence (no automation triggers)

-- Create the message_intelligence table
CREATE TABLE IF NOT EXISTS message_intelligence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  message_id uuid,
  direction text CHECK (direction IN ('inbound', 'outbound')),
  raw_content text,
  detected_intent text,
  sentiment_score numeric,
  key_entities jsonb DEFAULT '{}',
  suggested_response text,
  confidence_score numeric,
  processed_at timestamp with time zone DEFAULT now(),
  processing_model text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_message_intelligence_lead_id ON message_intelligence(lead_id);
CREATE INDEX IF NOT EXISTS idx_message_intelligence_intent ON message_intelligence(detected_intent);
CREATE INDEX IF NOT EXISTS idx_message_intelligence_processed ON message_intelligence(processed_at);
CREATE INDEX IF NOT EXISTS idx_message_intelligence_direction ON message_intelligence(direction);
CREATE INDEX IF NOT EXISTS idx_message_intelligence_sentiment ON message_intelligence(sentiment_score);

-- Add comments for documentation
COMMENT ON TABLE message_intelligence IS 'AI-analyzed message intelligence for lead communications';
COMMENT ON COLUMN message_intelligence.lead_id IS 'Reference to the lead this message belongs to';
COMMENT ON COLUMN message_intelligence.message_id IS 'Reference to the original message (from communication_logs)';
COMMENT ON COLUMN message_intelligence.direction IS 'Whether the message was inbound (from lead) or outbound (from system)';
COMMENT ON COLUMN message_intelligence.raw_content IS 'The original message text';
COMMENT ON COLUMN message_intelligence.detected_intent IS 'AI-detected intent (interested, not_interested, question, callback, etc.)';
COMMENT ON COLUMN message_intelligence.sentiment_score IS 'Sentiment score from -1 (negative) to 1 (positive)';
COMMENT ON COLUMN message_intelligence.key_entities IS 'Extracted entities (names, dates, amounts, etc.)';
COMMENT ON COLUMN message_intelligence.suggested_response IS 'AI-suggested response (Phase 1: display only)';
COMMENT ON COLUMN message_intelligence.confidence_score IS 'AI confidence in the analysis (0-1)';
COMMENT ON COLUMN message_intelligence.processing_model IS 'The AI model used for analysis';

-- Enable RLS (Row Level Security)
ALTER TABLE message_intelligence ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for authenticated users
CREATE POLICY "Allow authenticated access to message_intelligence"
  ON message_intelligence
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policy for anon users (read-only for dashboard)
CREATE POLICY "Allow anon read access to message_intelligence"
  ON message_intelligence
  FOR SELECT
  TO anon
  USING (true);
