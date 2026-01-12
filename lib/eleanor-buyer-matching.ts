/**
 * Eleanor AI - Buyer Matching Engine
 * Matches leads to buyers based on their criteria
 * 
 * Phase 2: Eleanor ingests buyer criteria and finds matches
 * Phase 3 (future): Learn from outcomes and optimize
 */

import { createClient } from '@supabase/supabase-js';

interface Buyer {
  id: string;
  name: string;
  company_name?: string;
  phone?: string;
  email?: string;
  counties_interested: string[];
  min_price?: number;
  max_price?: number;
  property_types?: string[];
  is_cash_buyer?: boolean;
  speed_to_close?: string;
  monthly_capacity?: number;
  reliability_score?: number;
  deals_won?: number;
  deals_lost?: number;
}

interface Lead {
  id: string;
  owner_name: string;
  property_address?: string;
  property_city?: string;
  county?: string;
  property_type?: string;
  excess_funds_amount?: number;
  zillow_value?: number;
  estimated_value?: number;
  is_golden?: boolean;
  eleanor_score?: number;
  phone?: string;
}

interface BuyerMatch {
  buyer_id: string;
  buyer_name: string;
  company_name?: string;
  match_score: number;
  match_reasons: string[];
  contact: {
    phone?: string;
    email?: string;
  };
}

/**
 * Find matching buyers for a lead
 * Returns buyers sorted by match score (best first)
 */
export async function findMatchingBuyers(
  lead: Lead,
  supabaseUrl: string,
  supabaseKey: string
): Promise<BuyerMatch[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get all active buyers
  const { data: buyers, error } = await supabase
    .from('maxsam_buyers')
    .select('*')
    .eq('is_active', true);
    
  if (error || !buyers) {
    console.error('Error fetching buyers:', error);
    return [];
  }
  
  const matches: BuyerMatch[] = [];
  const leadValue = lead.excess_funds_amount || lead.zillow_value || lead.estimated_value || 0;
  const leadCounty = (lead.county || 'Dallas').toLowerCase();
  
  for (const buyer of buyers as Buyer[]) {
    let matchScore = 0;
    const matchReasons: string[] = [];
    
    // 1. County match (required - 0 if no match)
    const buyerCounties = (buyer.counties_interested || []).map(c => c.toLowerCase());
    const countyMatch = buyerCounties.some(c => 
      c.includes(leadCounty) || leadCounty.includes(c)
    );
    
    if (!countyMatch && buyerCounties.length > 0) {
      continue; // Skip this buyer - county doesn't match
    }
    
    if (countyMatch) {
      matchScore += 30;
      matchReasons.push(`County match: ${lead.county}`);
    }
    
    // 2. Price range match
    const minPrice = buyer.min_price || 0;
    const maxPrice = buyer.max_price || 999999999;
    
    if (leadValue >= minPrice && leadValue <= maxPrice) {
      matchScore += 25;
      matchReasons.push(`Price in range: $${leadValue.toLocaleString()}`);
    } else if (leadValue > 0) {
      // Partial match - within 20% of range
      const buffer = (maxPrice - minPrice) * 0.2;
      if (leadValue >= minPrice - buffer && leadValue <= maxPrice + buffer) {
        matchScore += 10;
        matchReasons.push(`Price near range: $${leadValue.toLocaleString()}`);
      }
    }
    
    // 3. Property type match
    const buyerTypes = buyer.property_types || [];
    if (buyerTypes.length === 0 || buyerTypes.includes(lead.property_type || 'single_family')) {
      matchScore += 15;
      matchReasons.push(`Property type match`);
    }
    
    // 4. Buyer reliability bonus
    const reliability = buyer.reliability_score || 50;
    if (reliability >= 80) {
      matchScore += 15;
      matchReasons.push(`High reliability (${reliability}/100)`);
    } else if (reliability >= 60) {
      matchScore += 10;
      matchReasons.push(`Good reliability (${reliability}/100)`);
    } else {
      matchScore += 5;
    }
    
    // 5. Speed to close bonus (for urgent leads)
    const speed = buyer.speed_to_close || '30_days';
    if (speed === '7_days') {
      matchScore += 10;
      matchReasons.push(`Fast closer (7 days)`);
    } else if (speed === '14_days') {
      matchScore += 7;
      matchReasons.push(`Quick closer (14 days)`);
    }
    
    // 6. Cash buyer bonus
    if (buyer.is_cash_buyer) {
      matchScore += 5;
      matchReasons.push(`Cash buyer`);
    }
    
    // 7. Capacity check
    const capacity = buyer.monthly_capacity || 5;
    if (capacity >= 10) {
      matchScore += 5;
      matchReasons.push(`High capacity (${capacity}/mo)`);
    }
    
    // Only include if match score is meaningful
    if (matchScore >= 30) {
      matches.push({
        buyer_id: buyer.id,
        buyer_name: buyer.name,
        company_name: buyer.company_name,
        match_score: matchScore,
        match_reasons: matchReasons,
        contact: {
          phone: buyer.phone,
          email: buyer.email,
        },
      });
    }
  }
  
  // Sort by match score descending
  matches.sort((a, b) => b.match_score - a.match_score);
  
  return matches;
}

/**
 * Create lead-buyer matches in database
 */
export async function createBuyerMatches(
  lead: Lead,
  matches: BuyerMatch[],
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  for (const match of matches.slice(0, 5)) { // Top 5 matches
    await supabase
      .from('lead_buyer_matches')
      .upsert({
        lead_id: lead.id,
        buyer_id: match.buyer_id,
        match_score: match.match_score,
        match_reasons: match.match_reasons,
        status: 'pending',
      }, {
        onConflict: 'lead_id,buyer_id',
      });
  }
}

/**
 * Get buyer leaderboard - who closes the most deals
 */
export async function getBuyerLeaderboard(
  supabaseUrl: string,
  supabaseKey: string,
  limit: number = 10
): Promise<Buyer[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('maxsam_buyers')
    .select('*')
    .eq('is_active', true)
    .order('deals_won', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
  
  return data as Buyer[];
}

/**
 * Update buyer reliability score based on outcome
 * Called when a deal closes or falls through
 */
export async function updateBuyerReliability(
  buyerId: string,
  won: boolean,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Get current stats
  const { data: buyer } = await supabase
    .from('maxsam_buyers')
    .select('deals_won, deals_lost, reliability_score')
    .eq('id', buyerId)
    .single();
    
  if (!buyer) return;
  
  const dealsWon = (buyer.deals_won || 0) + (won ? 1 : 0);
  const dealsLost = (buyer.deals_lost || 0) + (won ? 0 : 1);
  const totalDeals = dealsWon + dealsLost;
  
  // Calculate new reliability score (percentage based with minimum)
  let newScore = 50; // Default
  if (totalDeals > 0) {
    newScore = Math.round((dealsWon / totalDeals) * 100);
    // Boost for volume
    if (totalDeals >= 10) newScore += 10;
    if (totalDeals >= 25) newScore += 10;
    newScore = Math.min(100, newScore);
  }
  
  await supabase
    .from('maxsam_buyers')
    .update({
      deals_won: dealsWon,
      deals_lost: dealsLost,
      reliability_score: newScore,
      last_deal_date: new Date().toISOString(),
    })
    .eq('id', buyerId);
}

/**
 * Get optimal buyers for bulk notification
 * Used when you have multiple properties to move
 */
export async function getOptimalBuyersForBulk(
  leads: Lead[],
  supabaseUrl: string,
  supabaseKey: string
): Promise<Map<string, Lead[]>> {
  // Returns Map of buyer_id -> leads they should receive
  const buyerLeadMap = new Map<string, Lead[]>();
  
  for (const lead of leads) {
    const matches = await findMatchingBuyers(lead, supabaseUrl, supabaseKey);
    
    // Assign to top 3 matching buyers
    for (const match of matches.slice(0, 3)) {
      const existing = buyerLeadMap.get(match.buyer_id) || [];
      existing.push(lead);
      buyerLeadMap.set(match.buyer_id, existing);
    }
  }
  
  return buyerLeadMap;
}
