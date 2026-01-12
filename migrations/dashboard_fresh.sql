-- FRESH DASHBOARD VIEW - NEW NAME TO AVOID CONFLICTS

CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT 
    -- Basic counts
    (SELECT COUNT(*) FROM leads) as total_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'contacted') as contacted_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'contract') as contract_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'closed') as closed_leads,
    
    -- Phone availability
    (SELECT COUNT(*) FROM leads WHERE phone IS NOT NULL) as leads_with_phones,
    
    -- Money calculations
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)), 2) FROM leads) as total_excess_funds,
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)) * 0.25, 2) FROM leads) as total_potential_fees,
    
    -- Golden leads
    (SELECT COUNT(*) FROM leads WHERE golden_lead = true) as golden_leads,
    
    -- High value leads
    (SELECT COUNT(*) FROM leads WHERE COALESCE(excess_amount, 0) > 25000) as high_value_leads,
    
    -- Expiring soon
    (SELECT COUNT(*) FROM leads WHERE 
        expiration_date IS NOT NULL 
        AND expiration_date <= CURRENT_DATE + INTERVAL '30 days'
    ) as expiring_soon;

-- Grant access
GRANT SELECT ON dashboard_metrics TO anon, authenticated;

-- Test the view
SELECT * FROM dashboard_metrics;
