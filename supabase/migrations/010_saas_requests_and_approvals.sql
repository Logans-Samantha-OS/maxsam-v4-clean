-- ============================================
-- SAAS REQUESTS AND APPROVALS TABLES
-- Migration 010: OS/SaaS Boundary Support
-- ============================================

-- SaaS Requests Table
-- Stores requests from SaaS layer awaiting OS approval
CREATE TABLE IF NOT EXISTS saas_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('contact_request', 'contract_request', 'info_request', 'escalation_request')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_saas_requests_lead_id ON saas_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_saas_requests_status ON saas_requests(status);
CREATE INDEX IF NOT EXISTS idx_saas_requests_created_at ON saas_requests(created_at DESC);

-- Approvals Table
-- OS decisions on SaaS requests
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES saas_requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  decided_at TIMESTAMP WITH TIME ZONE,
  decided_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_request_id ON approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_approvals_lead_id ON approvals(lead_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);

-- Enable RLS on new tables
ALTER TABLE saas_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saas_requests
CREATE POLICY "Allow service role full access to saas_requests"
  ON saas_requests FOR ALL TO service_role USING (true);

CREATE POLICY "Allow authenticated read access to saas_requests"
  ON saas_requests FOR SELECT TO authenticated USING (true);

-- RLS Policies for approvals
CREATE POLICY "Allow service role full access to approvals"
  ON approvals FOR ALL TO service_role USING (true);

CREATE POLICY "Allow authenticated read access to approvals"
  ON approvals FOR SELECT TO authenticated USING (true);
