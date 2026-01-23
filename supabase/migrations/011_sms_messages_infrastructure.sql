-- ============================================================
-- MAXSAM V4 - SMS MESSAGING INFRASTRUCTURE
-- Migration: Fix Messages UI data sync
-- ============================================================
-- Problem: N8N campaigns log to outreach_log but UI reads from sms_messages
-- Solution: Create sms_messages table and sync data from multiple sources
-- ============================================================

-- ============================================================
-- TABLE: sms_messages (if not exists)
-- Unified SMS message storage for the Messages UI
-- ============================================================
CREATE TABLE IF NOT EXISTS sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID,  -- Can be null for unknown senders
    message TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    to_number TEXT,
    from_number TEXT,
    status TEXT DEFAULT 'sent' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'received')),
    workflow TEXT,  -- Which workflow sent this (for tracking)
    intent TEXT,  -- For inbound: detected intent
    twilio_sid TEXT,  -- Twilio message SID for tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sms_messages_lead_id ON sms_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_from_number ON sms_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to_number ON sms_messages(to_number);

-- ============================================================
-- FUNCTION: get_message_threads
-- Returns conversation threads for the Messages UI
-- Groups messages by lead_id and returns last message info
-- ============================================================
CREATE OR REPLACE FUNCTION get_message_threads()
RETURNS TABLE(
    lead_id UUID,
    owner_name TEXT,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    message_count BIGINT,
    excess_funds_amount NUMERIC,
    eleanor_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH message_stats AS (
        SELECT 
            sm.lead_id,
            MAX(sm.created_at) as last_msg_at,
            COUNT(*) as msg_count
        FROM sms_messages sm
        WHERE sm.lead_id IS NOT NULL
        GROUP BY sm.lead_id
    ),
    last_messages AS (
        SELECT DISTINCT ON (sm.lead_id)
            sm.lead_id,
            sm.message as last_msg,
            sm.created_at
        FROM sms_messages sm
        WHERE sm.lead_id IS NOT NULL
        ORDER BY sm.lead_id, sm.created_at DESC
    )
    SELECT 
        ms.lead_id,
        COALESCE(ml.owner_name, gl.owner_name, 'Unknown') as owner_name,
        lm.last_msg as last_message,
        ms.last_msg_at as last_message_at,
        ms.msg_count as message_count,
        COALESCE(ml.excess_funds_amount, gl.excess_funds_amount) as excess_funds_amount,
        COALESCE(ml.eleanor_score, gl.priority_score) as eleanor_score
    FROM message_stats ms
    LEFT JOIN last_messages lm ON lm.lead_id = ms.lead_id
    LEFT JOIN maxsam_leads ml ON ml.id = ms.lead_id
    LEFT JOIN golden_leads gl ON gl.id = ms.lead_id
    ORDER BY ms.last_msg_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: sync_outreach_to_sms_messages
-- Backfill sms_messages from outreach_log
-- ============================================================
CREATE OR REPLACE FUNCTION sync_outreach_to_sms_messages()
RETURNS INTEGER AS $$
DECLARE
    v_synced INTEGER := 0;
BEGIN
    -- Insert from outreach_log where not already in sms_messages
    INSERT INTO sms_messages (
        lead_id,
        message,
        direction,
        to_number,
        from_number,
        status,
        workflow,
        created_at
    )
    SELECT 
        ol.lead_id::uuid,
        ol.message_content,
        'outbound',
        ml.phone,
        '+18449632549',
        COALESCE(ol.status, 'sent'),
        'SAM Campaign',
        ol.sent_at
    FROM outreach_log ol
    LEFT JOIN maxsam_leads ml ON ml.id = ol.lead_id::uuid
    WHERE ol.channel = 'sms'
    AND NOT EXISTS (
        SELECT 1 FROM sms_messages sm 
        WHERE sm.lead_id = ol.lead_id::uuid 
        AND sm.message = ol.message_content
        AND sm.created_at = ol.sent_at
    )
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS v_synced = ROW_COUNT;
    
    RETURN v_synced;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: sync_communication_logs_to_sms_messages
-- Backfill sms_messages from communication_logs (if exists)
-- ============================================================
CREATE OR REPLACE FUNCTION sync_communication_logs_to_sms_messages()
RETURNS INTEGER AS $$
DECLARE
    v_synced INTEGER := 0;
BEGIN
    -- Check if communication_logs exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'communication_logs') THEN
        RETURN 0;
    END IF;
    
    -- Insert from communication_logs where not already in sms_messages
    INSERT INTO sms_messages (
        lead_id,
        message,
        direction,
        to_number,
        from_number,
        status,
        workflow,
        created_at
    )
    SELECT 
        cl.lead_id,
        cl.content,
        cl.direction,
        cl.to_number,
        cl.from_number,
        COALESCE(cl.status, 'sent'),
        'Communication Log',
        cl.created_at
    FROM communication_logs cl
    WHERE cl.type = 'sms'
    AND NOT EXISTS (
        SELECT 1 FROM sms_messages sm 
        WHERE sm.lead_id = cl.lead_id 
        AND sm.message = cl.content
        AND sm.direction = cl.direction
    )
    ON CONFLICT DO NOTHING;
    
    GET DIAGNOSTICS v_synced = ROW_COUNT;
    
    RETURN v_synced;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RUN INITIAL SYNC
-- ============================================================
DO $$
DECLARE
    v_outreach_synced INTEGER;
    v_comm_synced INTEGER;
BEGIN
    -- Sync from outreach_log
    SELECT sync_outreach_to_sms_messages() INTO v_outreach_synced;
    RAISE NOTICE 'Synced % messages from outreach_log', v_outreach_synced;
    
    -- Sync from communication_logs (if exists)
    SELECT sync_communication_logs_to_sms_messages() INTO v_comm_synced;
    RAISE NOTICE 'Synced % messages from communication_logs', v_comm_synced;
    
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'SMS Messages table ready! Total synced: %', v_outreach_synced + v_comm_synced;
    RAISE NOTICE '========================================================';
END $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access to sms_messages" ON sms_messages;
CREATE POLICY "Allow authenticated access to sms_messages" ON sms_messages
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon access to sms_messages" ON sms_messages;
CREATE POLICY "Allow anon access to sms_messages" ON sms_messages
    FOR ALL TO anon USING (true);

-- Grant necessary permissions
GRANT ALL ON sms_messages TO service_role;
GRANT ALL ON sms_messages TO authenticated;
GRANT SELECT, INSERT ON sms_messages TO anon;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_message_threads() TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_threads() TO anon;
GRANT EXECUTE ON FUNCTION sync_outreach_to_sms_messages() TO service_role;
GRANT EXECUTE ON FUNCTION sync_communication_logs_to_sms_messages() TO service_role;

-- ============================================================
-- COMPLETION NOTICE
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'SMS Messaging Infrastructure - Migration Complete';
    RAISE NOTICE '========================================================';
    RAISE NOTICE 'Table: sms_messages';
    RAISE NOTICE 'Functions: get_message_threads(), sync_outreach_to_sms_messages()';
    RAISE NOTICE '';
    RAISE NOTICE 'The Messages UI should now display all SMS conversations!';
    RAISE NOTICE '========================================================';
END $$;
