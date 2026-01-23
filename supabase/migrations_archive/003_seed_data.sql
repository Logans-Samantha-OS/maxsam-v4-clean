-- ============================================
-- MAXSAM V4 - SEED DATA FOR DEMO
-- ============================================
-- Run this in Supabase SQL Editor to add sample data
-- Logan Toups = Sole Owner, 100% Revenue

-- Clear existing demo data (optional - comment out if you want to keep existing data)
-- DELETE FROM maxsam_leads WHERE source = 'seed';
-- DELETE FROM buyers WHERE notes LIKE '%SEED%';

-- ===========================================
-- SEED BUYERS (Cash Buyers Network)
-- ===========================================

INSERT INTO buyers (
  name, full_name, company, company_name, email, phone,
  property_types, preferred_zips, max_purchase_price,
  deal_types, closing_speed, funding_type, proof_of_funds,
  deals_closed, average_deal_size, reliability_rating, is_active, status, notes
) VALUES
(
  'Logan Capital Partners', 'Logan Capital Partners', 'Logan Capital Partners', 'Logan Capital Partners',
  'logan@logancapital.com', '214-555-0001',
  ARRAY['SFR', 'Duplex', 'Triplex'],
  '75201, 75202, 75204, 75206, 75214, 75219',
  500000,
  ARRAY['excess_funds', 'wholesale', 'dual'],
  '18 days', 'cash', true,
  47, 185000, 5, true, 'vip',
  'SEED DATA - Top buyer, always closes fast'
),
(
  'DFW Cash Buyers', 'Marcus Johnson', 'DFW Cash Buyers LLC', 'DFW Cash Buyers LLC',
  'marcus@dfwcashbuyers.com', '214-555-0002',
  ARRAY['SFR', 'Multi-family'],
  '75080, 75081, 75082, 75243',
  750000,
  ARRAY['wholesale'],
  '21 days', 'cash', true,
  89, 220000, 5, true, 'active',
  'SEED DATA - High volume buyer'
),
(
  'Metroplex Wholesale', 'Sarah Williams', 'Metroplex Wholesale Group', 'Metroplex Wholesale Group',
  'sarah@metroplexwholesale.com', '972-555-0003',
  ARRAY['SFR', 'Duplex', 'Commercial'],
  '75024, 75025, 75034, 75035',
  600000,
  ARRAY['wholesale', 'dual'],
  '16 days', 'cash', true,
  65, 175000, 5, true, 'active',
  'SEED DATA - Plano/Frisco specialist'
),
(
  'Trinity Home Investors', 'David Chen', 'Trinity Home Investors', 'Trinity Home Investors',
  'david@trinityhome.com', '469-555-0004',
  ARRAY['SFR'],
  '75040, 75041, 75042, 75043',
  400000,
  ARRAY['excess_funds', 'wholesale'],
  '25 days', 'hard_money', true,
  32, 145000, 4, true, 'active',
  'SEED DATA - Garland area focus'
),
(
  'Richardson Property Group', 'Jennifer Lee', 'Richardson Property Group', 'Richardson Property Group',
  'jennifer@richardsonpg.com', '214-555-0005',
  ARRAY['SFR', 'Triplex', 'Quad'],
  '75080, 75081, 75082',
  550000,
  ARRAY['dual'],
  '14 days', 'cash', true,
  28, 165000, 5, true, 'active',
  'SEED DATA - Quick closer'
)
ON CONFLICT DO NOTHING;

-- ===========================================
-- SEED LEADS (Excess Funds Opportunities)
-- ===========================================

INSERT INTO maxsam_leads (
  property_address, city, state, zip_code, owner_name,
  phone_1, phone_2, email,
  excess_funds_amount, estimated_arv, estimated_repair_cost, estimated_equity,
  eleanor_score, deal_grade, contact_priority, deal_type,
  potential_revenue, excess_fee, wholesale_fee,
  status, source, case_number, sale_date, notes, created_at
) VALUES
-- Diamond Grade (A+) Leads - Score 90+
(
  '1234 Golden Opportunity Lane', 'Dallas', 'TX', '75201',
  'Martinez, Sarah L.',
  '214-555-1001', '214-555-1002', 'sarah.martinez@email.com',
  45000, 350000, 35000, 210000,
  95, 'A+', 'hot', 'dual',
  32250, 11250, 21000,
  'new', 'seed', 'TX-2024-001001', '2024-10-15',
  'Premium location, highly motivated seller. Top priority!',
  NOW() - INTERVAL '2 days'
),
(
  '5678 Diamond Ave', 'Dallas', 'TX', '75202',
  'Johnson, Michael R.',
  '214-555-1003', NULL, 'mike.johnson@email.com',
  38000, 280000, 28000, 168000,
  92, 'A+', 'hot', 'dual',
  26300, 9500, 16800,
  'new', 'seed', 'TX-2024-001002', '2024-10-16',
  'Excellent equity position. Call immediately!',
  NOW() - INTERVAL '1 day'
),
-- Emerald Grade (A) Leads - Score 80-89
(
  '9012 Emerald Court', 'Richardson', 'TX', '75080',
  'Williams, Robert J.',
  '972-555-1004', '972-555-1005', 'rwilliams@email.com',
  32000, 220000, 33000, 121000,
  87, 'A', 'hot', 'dual',
  20100, 8000, 12100,
  'contacted', 'seed', 'TX-2024-001003', '2024-10-17',
  'Very interested, needs follow-up',
  NOW() - INTERVAL '3 days'
),
(
  '3456 Park Ave', 'Plano', 'TX', '75024',
  'Davis, Jennifer K.',
  '469-555-1006', NULL, 'jdavis@email.com',
  28000, 195000, 25000, 111500,
  84, 'A', 'hot', 'excess_only',
  7000, 7000, 0,
  'new', 'seed', 'TX-2024-001004', '2024-10-18',
  'Excess funds only - no wholesale opportunity',
  NOW() - INTERVAL '4 days'
),
(
  '2345 Maple Drive', 'Frisco', 'TX', '75034',
  'Anderson, Patricia M.',
  '972-555-1007', '972-555-1008', 'panderson@email.com',
  51000, 425000, 45000, 252500,
  88, 'A', 'hot', 'dual',
  38000, 12750, 25250,
  'negotiating', 'seed', 'TX-2024-001005', '2024-10-19',
  'High value dual deal. In negotiation!',
  NOW() - INTERVAL '5 days'
),
-- Sapphire Grade (B) Leads - Score 70-79
(
  '7890 Oak St', 'Dallas', 'TX', '75206',
  'Brown, David A.',
  '214-555-1009', NULL, NULL,
  22000, 165000, 20000, 95500,
  74, 'B', 'warm', 'dual',
  15050, 5500, 9550,
  'new', 'seed', 'TX-2024-001006', '2024-10-20',
  'Good opportunity, needs skip trace for email',
  NOW() - INTERVAL '6 days'
),
(
  '6789 Elm Street', 'Irving', 'TX', '75061',
  'Garcia, Carlos R.',
  '972-555-1010', '972-555-1011', 'cgarcia@email.com',
  18500, 145000, 18000, 83500,
  72, 'B', 'warm', 'excess_only',
  4625, 4625, 0,
  'contacted', 'seed', 'TX-2024-001007', '2024-10-21',
  'Responded to SMS, scheduling call',
  NOW() - INTERVAL '7 days'
),
(
  '4521 Prosperity Way', 'Dallas', 'TX', '75214',
  'Rodriguez, Maria E.',
  '214-555-1012', NULL, 'mrodriguez@email.com',
  55000, 380000, 50000, 216000,
  78, 'B', 'warm', 'dual',
  35350, 13750, 21600,
  'new', 'seed', 'TX-2024-001008', '2024-10-22',
  'High excess amount. Good wholesale potential.',
  NOW() - INTERVAL '1 day'
),
-- Amber Grade (C) Leads - Score 60-69
(
  '1357 Cedar Lane', 'Dallas', 'TX', '75219',
  'Thompson, Nancy L.',
  '214-555-1013', NULL, NULL,
  67000, 520000, 85000, 279000,
  65, 'C', 'warm', 'dual',
  44650, 16750, 27900,
  'new', 'seed', 'TX-2024-001009', '2024-10-23',
  'Very high value but needs repairs assessment',
  NOW() - INTERVAL '8 days'
),
(
  '2468 Pine Road', 'Garland', 'TX', '75041',
  'Lee, James W.',
  '972-555-1014', NULL, 'jlee@email.com',
  15000, 125000, 15000, 72500,
  62, 'C', 'cold', 'excess_only',
  3750, 3750, 0,
  'contacted', 'seed', 'TX-2024-001010', '2024-10-24',
  'Lower value lead, follow up when time permits',
  NOW() - INTERVAL '10 days'
),
-- Ruby Grade (D) Leads - Score <60
(
  '3579 Birch Blvd', 'Carrollton', 'TX', '75006',
  'Wilson, Emily S.',
  NULL, NULL, 'ewilson@email.com',
  42000, 290000, 45000, 158000,
  55, 'D', 'cold', 'excess_only',
  10500, 10500, 0,
  'new', 'seed', 'TX-2024-001011', '2024-10-25',
  'No phone - needs skip trace',
  NOW() - INTERVAL '12 days'
),
(
  '8765 Success Blvd', 'Dallas', 'TX', '75204',
  'Smith, Thomas J.',
  '214-555-1015', NULL, NULL,
  8500, 95000, 12000, 54500,
  48, 'D', 'cold', 'excess_only',
  2125, 2125, 0,
  'new', 'seed', 'TX-2024-001012', '2024-10-26',
  'Below minimum threshold - low priority',
  NOW() - INTERVAL '14 days'
)
ON CONFLICT DO NOTHING;

-- ===========================================
-- VERIFY SEED DATA
-- ===========================================
DO $$
DECLARE
  buyer_count INTEGER;
  lead_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO buyer_count FROM buyers WHERE notes LIKE '%SEED%';
  SELECT COUNT(*) INTO lead_count FROM maxsam_leads WHERE source = 'seed';

  RAISE NOTICE 'Seed data inserted: % buyers, % leads', buyer_count, lead_count;
END $$;
