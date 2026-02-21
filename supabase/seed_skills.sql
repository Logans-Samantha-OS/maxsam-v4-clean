-- Seed skills_registry with initial agent skills
-- Run in Supabase SQL Editor or via migration

INSERT INTO skills_registry (slug, name, description, version, status, agent_owner)
VALUES
  ('skip-trace', 'ALEX Skip Trace', 'Enriches leads with phone numbers, emails, relatives, and addresses via Apify skip trace API', '1.0.0', 'active', 'ALEX'),
  ('eleanor-score', 'Eleanor Lead Scoring', 'Scores leads A-F based on excess funds amount, property data, heir status, and recovery probability', '1.0.0', 'active', 'ELEANOR'),
  ('sam-outreach', 'SAM SMS Outreach', 'Sends initial compliant SMS to leads with opt-in request, manages two-phase messaging', '1.0.0', 'active', 'SAM'),
  ('contract-generate', 'Agreement Generator', 'Generates PDF contracts from lead data using excess funds or wholesale templates', '1.0.0', 'active', 'SYSTEM'),
  ('contract-send', 'Agreement Sender', 'Sends generated agreement PDF link via SMS to lead', '1.0.0', 'active', 'SAM'),
  ('batch-import', 'Batch Lead Import', 'Imports leads from Dallas County excess funds PDF extractions', '1.0.0', 'active', 'ALEX'),
  ('lead-classify', 'Lead Classification', 'Classifies leads as excess_funds, wholesale, or golden_lead based on data overlap', '1.0.0', 'active', 'ELEANOR')
ON CONFLICT (slug) DO NOTHING;
