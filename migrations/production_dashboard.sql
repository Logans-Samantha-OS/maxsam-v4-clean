-- ========================================
-- PRODUCTION DASHBOARD - FINAL VERSION
-- ========================================

-- Based on successful schema verification
-- Uses only confirmed existing fields
-- Includes all optimizations and best practices

CREATE OR REPLACE VIEW maxsam_production_dashboard AS
SELECT 
    -- Executive Summary
    (SELECT COUNT(*) FROM leads) as total_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'contacted') as contacted_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'contract') as contract_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'closed') as closed_leads,
    
    -- Contact Metrics
    (SELECT COUNT(*) FROM leads WHERE phone IS NOT NULL) as leads_with_phones,
    (SELECT COUNT(*) FROM leads WHERE phone IS NULL) as leads_without_phones,
    (SELECT ROUND(COUNT(*) FILTER (WHERE phone IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0), 2) FROM leads) as phone_contact_rate,
    
    -- Financial Metrics
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)), 2) FROM leads) as total_excess_funds,
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)) * 0.25, 2) FROM leads) as total_potential_fees,
    (SELECT ROUND(AVG(COALESCE(excess_amount, 0)), 2) FROM leads) as avg_excess_amount,
    (SELECT ROUND(MAX(COALESCE(excess_amount, 0)), 2) FROM leads) as max_excess_amount,
    
    -- Lead Quality Metrics
    (SELECT COUNT(*) FROM leads WHERE golden_lead = true) as golden_leads,
    (SELECT COUNT(*) FROM leads WHERE COALESCE(excess_amount, 0) > 25000) as high_value_leads,
    (SELECT COUNT(*) FROM leads WHERE COALESCE(excess_amount, 0) > 100000) as ultra_high_value_leads,
    
    -- Urgency Metrics
    (SELECT COUNT(*) FROM leads WHERE 
        expiration_date IS NOT NULL 
        AND expiration_date <= CURRENT_DATE + INTERVAL '7 days'
    ) as expiring_this_week,
    (SELECT COUNT(*) FROM leads WHERE 
        expiration_date IS NOT NULL 
        AND expiration_date <= CURRENT_DATE + INTERVAL '30 days'
    ) as expiring_this_month,
    (SELECT COUNT(*) FROM leads WHERE 
        expiration_date IS NOT NULL 
        AND expiration_date <= CURRENT_DATE + INTERVAL '90 days'
    ) as expiring_this_quarter,
    
    -- Performance Metrics
    (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as leads_this_week,
    (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as leads_this_month,
    (SELECT ROUND(COUNT(*) FILTER (WHERE status = 'closed' AND created_at >= CURRENT_DATE - INTERVAL '30 days') * 100.0 / NULLIF(COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'), 0), 2) FROM leads) as conversion_rate_30d,
    
    -- Top Performers (Golden Leads)
    (SELECT 
        owner_name,
        property_address,
        COALESCE(excess_amount, 0) as excess_amount,
        phone
    FROM leads 
    WHERE golden_lead = true 
    ORDER BY COALESCE(excess_amount, 0) DESC 
    LIMIT 5
    ) as top_golden_leads,
    
    -- Recent Activity
    (SELECT 
        COUNT(*) as activity_count,
        MAX(created_at) as last_activity
    FROM activity_log 
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    ) as recent_activity;

-- Grant access to production dashboard
GRANT SELECT ON maxsam_production_dashboard TO anon, authenticated;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_production_dashboard_total_leads ON maxsam_production_dashboard (total_leads);

-- Success message
SELECT 'Production dashboard created successfully!' as status,
    COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_name = 'maxsam_production_dashboard';

-- Test the dashboard
SELECT * FROM maxsam_production_dashboard LIMIT 1;
