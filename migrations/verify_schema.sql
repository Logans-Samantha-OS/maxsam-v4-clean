-- ========================================
-- SCHEMA VERIFICATION SCRIPT
-- ========================================

-- Check what tables actually exist
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name IN ('leads', 'buyers', 'contracts', 'conversations', 'activity_log')
ORDER BY table_name, ordinal_position;

-- Check existing indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN ('leads', 'buyers', 'contracts', 'conversations', 'activity_log')
ORDER BY tablename, indexname;

-- Check existing views
SELECT 
    table_schema,
    table_name,
    view_definition
FROM information_schema.views 
WHERE table_schema = 'public' 
    AND table_name LIKE '%dashboard%'
ORDER BY table_name;

-- Check foreign key constraints
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('leads', 'buyers', 'contracts', 'conversations', 'activity_log');

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('leads', 'buyers', 'contracts', 'conversations', 'activity_log')
ORDER BY tablename, policyname;

-- Sample data check
SELECT 'leads' as table_name, COUNT(*) as record_count FROM leads
UNION ALL
SELECT 'buyers' as table_name, COUNT(*) as record_count FROM buyers
UNION ALL  
SELECT 'contracts' as table_name, COUNT(*) as record_count FROM contracts
UNION ALL
SELECT 'conversations' as table_name, COUNT(*) as record_count FROM conversations
UNION ALL
SELECT 'activity_log' as table_name, COUNT(*) as record_count FROM activity_log;

-- ========================================
-- This will show you exactly what exists in your database
-- Run this to understand the actual schema before creating more objects
-- ========================================
