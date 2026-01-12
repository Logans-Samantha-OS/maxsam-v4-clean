-- OPTIMIZED DASHBOARD VIEW - Enhanced Metrics & Performance

CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT 
    -- Pipeline Overview
    (SELECT COUNT(*) FROM leads WHERE status NOT IN ('closed', 'opted_out')) as total_active_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'contacted') as contacted_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'contract') as contract_leads,
    (SELECT COUNT(*) FROM leads WHERE status = 'closed') as closed_leads,
    
    -- Contact Metrics
    (SELECT COUNT(*) FROM leads WHERE phone IS NOT NULL) as leads_with_phones,
    (SELECT COUNT(*) FROM leads WHERE phone IS NULL) as leads_without_phones,
    (SELECT ROUND(COUNT(*) FILTER (WHERE phone IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0), 2) FROM leads) as phone_contact_rate,
    
    -- Financial Metrics
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)), 2) FROM leads WHERE status NOT IN ('closed', 'opted_out')) as total_excess_funds,
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)) * 0.25, 2) FROM leads WHERE status NOT IN ('closed', 'opted_out')) as total_potential_fees,
    (SELECT ROUND(AVG(COALESCE(excess_amount, 0)), 2) FROM leads WHERE status NOT IN ('closed', 'opted_out')) as avg_excess_amount,
    (SELECT ROUND(MAX(COALESCE(excess_amount, 0)), 2) FROM leads WHERE status NOT IN ('closed', 'opted_out')) as max_excess_amount,
    
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
    (SELECT COUNT(*) FROM leads WHERE last_contact IS NOT NULL AND last_contact >= CURRENT_DATE - INTERVAL '7 days') as contacted_this_week,
    
    -- Conversion Metrics
    (SELECT ROUND(COUNT(*) FILTER (WHERE status = 'closed') * 100.0 / NULLIF(COUNT(*), 0), 2) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as conversion_rate_30d,
    (SELECT ROUND(AVG(COALESCE(excess_amount, 0)), 2) FROM leads WHERE status = 'closed' AND created_at >= CURRENT_DATE - INTERVAL '30 days') as avg_closed_deal_size;

-- Grant access
GRANT SELECT ON dashboard_metrics TO anon, authenticated;

-- Performance optimization: Create materialized view for faster queries
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_metrics_materialized AS
SELECT * FROM dashboard_metrics;

-- Create index for materialized view
CREATE INDEX IF NOT EXISTS idx_dashboard_metrics_materialized ON dashboard_metrics_materialized (total_active_leads);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_dashboard_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_metrics_materialized;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on refresh function
GRANT EXECUTE ON FUNCTION refresh_dashboard_metrics() TO authenticated;

-- Test the view
SELECT * FROM dashboard_metrics;
