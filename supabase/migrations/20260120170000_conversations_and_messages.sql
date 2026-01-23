-- ============================================================================
-- Migration: Conversations and Messages for Unified Timeline
-- Purpose: Create tables to support event-driven communications timeline
--          that shows SMS, Email, and Agreement events in a single UI
-- ============================================================================

-- ============================================================================
-- Table: conversations
-- Purpose: Groups related messages for a lead/contact
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,

  -- Contact info (denormalized for quick display)
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,

  -- Conversation metadata
  subject TEXT,                           -- Optional subject line
  status TEXT DEFAULT 'open',             -- open, archived, spam
  priority TEXT DEFAULT 'normal',         -- low, normal, high, urgent

  -- Unread tracking
  unread_count INTEGER DEFAULT 0,

  -- Latest message preview
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,              -- First ~100 chars of last message
  last_message_direction TEXT,            -- inbound, outbound, system

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  archived_at TIMESTAMPTZ
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_phone ON conversations(contact_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(unread_count) WHERE unread_count > 0;

-- ============================================================================
-- Table: messages
-- Purpose: Unified message store for SMS, Email, and System events
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,

  -- Message content
  direction TEXT NOT NULL,                -- inbound, outbound, system
  channel TEXT NOT NULL,                  -- sms, email, agreement, system
  content TEXT NOT NULL,                  -- Message body or event description

  -- Contact info
  from_address TEXT,                      -- Phone number or email
  to_address TEXT,                        -- Phone number or email

  -- Status tracking
  status TEXT DEFAULT 'sent',             -- queued, sent, delivered, failed, read
  read_at TIMESTAMPTZ,

  -- External IDs for deduplication and tracking
  external_id TEXT,                       -- Twilio SID, Gmail message ID, etc.
  provider TEXT,                          -- twilio, gmail, system

  -- AI/Intent analysis
  intent TEXT,                            -- interested, question, opt_out, spam, etc.
  sentiment TEXT,                         -- positive, neutral, negative
  confidence FLOAT,                       -- AI confidence score

  -- Agreement-specific metadata
  agreement_packet_id UUID REFERENCES agreement_packets(id) ON DELETE SET NULL,
  agreement_event_type TEXT,              -- created, sent, viewed, signed, etc.

  -- Flexible metadata for provider-specific data
  metadata JSONB DEFAULT '{}',

  -- Error tracking
  error_code TEXT,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON messages(external_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_agreement_packet_id ON messages(agreement_packet_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_messages_lead_channel_created
  ON messages(lead_id, channel, created_at DESC);

-- ============================================================================
-- Trigger: Update conversation on new message
-- ============================================================================

CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the conversation with latest message info
  UPDATE conversations SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    last_message_direction = NEW.direction,
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON messages;
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.conversation_id IS NOT NULL)
  EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- Function: Get or create conversation for a lead
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_lead_id UUID,
  p_contact_name TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Try to find existing conversation for this lead
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE lead_id = p_lead_id
    AND status = 'open'
  ORDER BY last_message_at DESC NULLS LAST
  LIMIT 1;

  -- If no conversation exists, create one
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (
      lead_id,
      contact_name,
      contact_phone,
      contact_email
    ) VALUES (
      p_lead_id,
      p_contact_name,
      p_contact_phone,
      p_contact_email
    )
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: Add message to timeline
-- ============================================================================

CREATE OR REPLACE FUNCTION add_message_to_timeline(
  p_lead_id UUID,
  p_direction TEXT,
  p_channel TEXT,
  p_content TEXT,
  p_from_address TEXT DEFAULT NULL,
  p_to_address TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_agreement_packet_id UUID DEFAULT NULL,
  p_agreement_event_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_message_id UUID;
  v_contact_name TEXT;
  v_contact_phone TEXT;
  v_contact_email TEXT;
BEGIN
  -- Get lead contact info
  SELECT owner_name, phone, email
  INTO v_contact_name, v_contact_phone, v_contact_email
  FROM maxsam_leads
  WHERE id = p_lead_id;

  -- Get or create conversation
  v_conversation_id := get_or_create_conversation(
    p_lead_id,
    v_contact_name,
    v_contact_phone,
    v_contact_email
  );

  -- Insert message
  INSERT INTO messages (
    conversation_id,
    lead_id,
    direction,
    channel,
    content,
    from_address,
    to_address,
    external_id,
    provider,
    metadata,
    agreement_packet_id,
    agreement_event_type
  ) VALUES (
    v_conversation_id,
    p_lead_id,
    p_direction,
    p_channel,
    p_content,
    p_from_address,
    p_to_address,
    p_external_id,
    p_provider,
    p_metadata,
    p_agreement_packet_id,
    p_agreement_event_type
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: Mark messages as read
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_messages_read(
  p_conversation_id UUID
)
RETURNS void AS $$
BEGIN
  -- Mark all unread messages as read
  UPDATE messages
  SET read_at = now(), status = 'read', updated_at = now()
  WHERE conversation_id = p_conversation_id
    AND read_at IS NULL
    AND direction = 'inbound';

  -- Reset unread count on conversation
  UPDATE conversations
  SET unread_count = 0, updated_at = now()
  WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (internal app)
CREATE POLICY "Allow all for authenticated users" ON conversations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for authenticated users" ON messages
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Migration: Sync existing sms_messages to new messages table
-- ============================================================================

-- Note: Run this manually after migration to backfill existing SMS data
-- This is a one-time migration script

-- DO $$
-- DECLARE
--   r RECORD;
--   v_conversation_id UUID;
-- BEGIN
--   FOR r IN
--     SELECT * FROM sms_messages
--     WHERE NOT EXISTS (
--       SELECT 1 FROM messages
--       WHERE external_id = sms_messages.sid
--     )
--     ORDER BY created_at ASC
--   LOOP
--     -- Get or create conversation
--     v_conversation_id := get_or_create_conversation(r.lead_id);
--
--     -- Insert message
--     INSERT INTO messages (
--       conversation_id,
--       lead_id,
--       direction,
--       channel,
--       content,
--       from_address,
--       to_address,
--       external_id,
--       provider,
--       status,
--       intent,
--       metadata,
--       created_at
--     ) VALUES (
--       v_conversation_id,
--       r.lead_id,
--       r.direction,
--       'sms',
--       r.body,
--       r.from_number,
--       r.to_number,
--       r.sid,
--       'twilio',
--       CASE WHEN r.status IN ('delivered', 'sent', 'received') THEN 'delivered' ELSE r.status END,
--       r.intent,
--       jsonb_build_object(
--         'num_media', r.num_media,
--         'num_segments', r.num_segments,
--         'agent_id', r.agent_id,
--         'workflow_id', r.workflow_id,
--         'original_status', r.status
--       ),
--       r.created_at
--     );
--   END LOOP;
-- END;
-- $$;

-- ============================================================================
-- View: Unified timeline for a lead
-- ============================================================================

CREATE OR REPLACE VIEW lead_timeline AS
SELECT
  m.id,
  m.lead_id,
  m.conversation_id,
  m.direction,
  m.channel,
  m.content,
  m.from_address,
  m.to_address,
  m.status,
  m.intent,
  m.sentiment,
  m.agreement_packet_id,
  m.agreement_event_type,
  m.metadata,
  m.created_at,
  c.contact_name,
  c.contact_phone,
  l.owner_name,
  l.property_address,
  l.excess_funds_amount,
  l.status as lead_status
FROM messages m
LEFT JOIN conversations c ON c.id = m.conversation_id
LEFT JOIN maxsam_leads l ON l.id = m.lead_id
ORDER BY m.created_at DESC;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE conversations IS 'Groups related messages for a lead/contact - used for unified messaging UI';
COMMENT ON TABLE messages IS 'Unified message store for SMS, Email, and Agreement events';
COMMENT ON COLUMN messages.channel IS 'Message channel: sms, email, agreement, system';
COMMENT ON COLUMN messages.agreement_event_type IS 'For agreement events: created, sent, viewed, signed, etc.';
COMMENT ON FUNCTION add_message_to_timeline IS 'Helper to add any message/event to the unified timeline';
