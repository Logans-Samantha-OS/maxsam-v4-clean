-- SUPER SAFE DASHBOARD VIEW - Only 100% Confirmed Fields

CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT 
    -- Basic counts (confirmed fields)
    (SELECT COUNT(*) FROM leads) as total_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'contacted') as contacted_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'contract') as contract_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'closed') as closed_leads,
    
    -- Phone availability
    (SELECT COUNT(*) FROM leads WHERE phone IS NOT NULL) as leads_with_phones,
    
    -- Money calculations (confirmed fields)
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)), 2) FROM leads) as total_excess_funds,
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)) * 0.25, 2) FROM leads) as total_potential_fees,
    (SELECT ROUND(AVG(COALESCE(excess_amount, 0)), 2) FROM leads) as avg_excess_amount,
    (SELECT ROUND(MAX(COALESCE(excess_amount, 0)), 2) FROM leads) as max_excess_amount,
    
    -- Lead quality (confirmed fields)
    (SELECT COUNT(*) FROM leads WHERE golden_lead = true) as golden_leads,
    (SELECT COUNT(*) FROM leads WHERE COALESCE(excess_amount, 0) > 25000) as high_value_leads,
    (SELECT COUNT(*) FROM leads WHERE COALESCE(excess_amount, 0) > 100000) as ultra_high_value_leads,
    
    -- Time-based metrics (confirmed fields)
    (SELECT COUNT(*) FROM leads WHERE 
        expiration_date IS NOT NULL 
        AND expiration_date <= CURRENT_DATE + INTERVAL '7 days'
    ) as expiring_this_week,
    (SELECT COUNT(*) FROM leads WHERE 
        expiration_date IS NOT NULL 
        AND expiration_date <= CURRENT_DATE + INTERVAL '30 days'
    ) as expiring_this_month,
    
    -- Recent activity (confirmed fields)
    (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as leads_this_week,
    (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as leads_this_month;

-- Grant access
GRANT SELECT ON dashboard_metrics TO anon, authenticated;

-- Test query
SELECT * FROM dashboard_metrics;
