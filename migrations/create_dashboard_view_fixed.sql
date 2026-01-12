-- Create a COMPLETE DASHBOARD VIEW for Vercel
-- Using correct table names and field names

CREATE OR REPLACE VIEW dashboard_summary AS
SELECT 
    -- Pipeline Overview
    (SELECT COUNT(*) FROM leads WHERE COALESCE(status, 'new') NOT IN ('closed', 'opted_out')) as total_active_leads,
    (SELECT COUNT(*) FROM leads WHERE phone IS NOT NULL AND COALESCE(status, 'new') NOT IN ('closed', 'opted_out')) as leads_with_phones,
    (SELECT COUNT(*) FROM leads WHERE status IN ('contacted', 'enriched', 'scored') AND phone IS NOT NULL) as ready_for_outreach,
    (SELECT COUNT(*) FROM leads WHERE status = 'contacted') as contacted,
    
    -- Money
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)), 2) FROM leads WHERE COALESCE(status, 'new') NOT IN ('closed', 'opted_out')) as total_excess_funds,
    (SELECT ROUND(SUM(COALESCE(excess_amount, 0)) * 0.25, 2) FROM leads WHERE COALESCE(status, 'new') NOT IN ('closed', 'opted_out')) as total_potential_fees,
    
    -- Priority Breakdown
    (SELECT COUNT(*) FROM leads WHERE eleanor_score >= 90 AND COALESCE(status, 'new') NOT IN ('closed', 'opted_out')) as critical_leads,
    (SELECT COUNT(*) FROM leads WHERE eleanor_score >= 80 AND eleanor_score < 90 AND COALESCE(status, 'new') NOT IN ('closed', 'opted_out')) as high_leads,
    (SELECT COUNT(*) FROM leads WHERE eleanor_score >= 70 AND eleanor_score < 80 AND COALESCE(status, 'new') NOT IN ('closed', 'opted_out')) as medium_leads,
    
    -- Action Items (using fields that exist)
    (SELECT COUNT(*) FROM leads WHERE skip_trace_status = 'pending' AND COALESCE(excess_amount, 0) > 25000) as needs_skip_trace,
    (SELECT COUNT(*) FROM leads WHERE 
        CASE 
            WHEN expiration_date IS NOT NULL 
            THEN expiration_date <= CURRENT_DATE + INTERVAL '30 days'
            ELSE FALSE 
        END
    ) as expiring_soon;

-- Grant access to the view
GRANT SELECT ON dashboard_summary TO anon, authenticated;

SELECT * FROM dashboard_summary;
