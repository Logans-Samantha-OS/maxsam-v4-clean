CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'sms', 'email', 'note', 'status-change')),
  outcome TEXT,
  disposition TEXT,
  notes TEXT,
  follow_up_date DATE,
  next_action TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_lead_id ON activity_log(lead_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
