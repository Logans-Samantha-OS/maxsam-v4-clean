-- ============================================================
-- MAXSAM V4 - SMS SYNC FIX
-- Run this to sync messages from outreach_log to sms_messages
-- ============================================================

-- First, check what's in outreach_log
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM outreach_log WHERE channel = 'sms';
    RAISE NOTICE 'Found % SMS records in outreach_log', v_count;
END $$;

-- Sync from outreach_log with flexible schema handling
INSERT INTO sms_messages (lead_id, message, direction, to_number, from_number, status, workflow, created_at)
SELECT 
    CASE 
        WHEN ol.lead_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
        THEN ol.lead_id::uuid
        ELSE NULL
    END as lead_id,
    COALESCE(ol.message_content, ol.content, ol.message, 'No content') as message,
    'outbound' as direction,
    COALESCE(ol.to_phone, ol.to_number, ol.phone) as to_number,
    '+18449632549' as from_number,
    COALESCE(ol.status, 'sent') as status,
    'SAM Campaign (synced)' as workflow,
    COALESCE(ol.sent_at, ol.created_at, NOW()) as created_at
FROM outreach_log ol
WHERE ol.channel = 'sms'
AND NOT EXISTS (
    SELECT 1 FROM sms_messages sm 
    WHERE (
        (sm.lead_id IS NOT NULL AND ol.lead_id IS NOT NULL AND sm.lead_id::text = ol.lead_id::text)
        OR (sm.to_number = COALESCE(ol.to_phone, ol.to_number, ol.phone))
    )
    AND sm.message = COALESCE(ol.message_content, ol.content, ol.message, '')
)
ON CONFLICT DO NOTHING;

-- Also try to sync from golden_leads response handler table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'golden_lead_events') THEN
        INSERT INTO sms_messages (lead_id, message, direction, from_number, status, workflow, created_at)
        SELECT 
            gle.golden_lead_id as lead_id,
            (gle.event_data->>'message')::text as message,
            'outbound' as direction,
            '+18449632549' as from_number,
            'sent' as status,
            'Golden Lead Event' as workflow,
            gle.created_at
        FROM golden_lead_events gle
        WHERE gle.event_type IN ('call_queued', 'telegram_sent')
        AND gle.event_data->>'message' IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM sms_messages sm 
            WHERE sm.lead_id = gle.golden_lead_id
            AND sm.message = (gle.event_data->>'message')::text
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Show results
SELECT 
    'sms_messages' as table_name,
    COUNT(*) as total_count,
    COUNT(DISTINCT lead_id) as unique_leads
FROM sms_messages

UNION ALL

SELECT 
    'outreach_log (sms)' as table_name,
    COUNT(*) as total_count,
    COUNT(DISTINCT lead_id) as unique_leads
FROM outreach_log
WHERE channel = 'sms';

-- Show the threads that should now appear
SELECT * FROM get_message_threads();
