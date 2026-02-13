// MaxSam V4 - Property Intelligence Import API
// Imports Propwire JSON data with foreclosure_borrower for golden lead matching

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Calculate distress score
function calculateDistressScore(leadTypes: string[], equityPercent: number): number {
  let score = 0;
  const types = leadTypes.map(t => t.toUpperCase().replace(/\s+/g, '_'));
  
  if (types.some(t => t.includes('PREFORECLOSURE'))) score += 30;
  if (types.some(t => t.includes('FORECLOSURE') && !t.includes('PRE'))) score += 35;
  if (types.some(t => t.includes('AUCTION'))) score += 25;
  if (types.some(t => t.includes('TAX'))) score += 25;
  if (types.some(t => t.includes('PROBATE'))) score += 20;
  if (types.some(t => t.includes('VACANT'))) score += 15;
  if (types.some(t => t.includes('ABSENTEE'))) score += 10;
  if (types.some(t => t.includes('HIGH_EQUITY') || t.includes('HIGH'))) score += 10;
  if (types.some(t => t.includes('BARGAIN'))) score += 15;
  
  if (equityPercent >= 80) score += 15;
  else if (equityPercent >= 60) score += 10;
  else if (equityPercent >= 40) score += 5;
  
  return Math.min(score, 100);
}

// Determine opportunity tier
function determineOpportunityTier(distressScore: number, equityPercent: number): string {
  if (distressScore >= 50 && equityPercent >= 40) return 'golden';
  if (distressScore >= 40 || equityPercent >= 60) return 'hot';
  if (distressScore >= 25 || equityPercent >= 40) return 'warm';
  return 'cold';
}

// Determine situation type
function determineSituationType(leadTypes: string[]): string {
  const types = leadTypes.map(t => t.toUpperCase());
  if (types.some(t => t.includes('PREFORECLOSURE'))) return 'preforeclosure';
  if (types.some(t => t.includes('FORECLOSURE'))) return 'foreclosure';
  if (types.some(t => t.includes('AUCTION'))) return 'auction';
  if (types.some(t => t.includes('VACANT'))) return 'vacant';
  if (types.some(t => t.includes('ABSENTEE'))) return 'absentee';
  if (types.some(t => t.includes('HIGH_EQUITY'))) return 'high_equity';
  return 'unknown';
}

// Normalize lead types
function normalizeLeadTypes(leadTypes: string[]): string[] {
  return leadTypes
    .filter(t => t && !t.match(/^\d+\+?$/) && !['Pending', 'For Sale', 'Failed Listing'].includes(t))
    .map(t => t.toUpperCase().replace(/\s+/g, '_')
      .replace('PREFORECLOSURES', 'PREFORECLOSURE')
      .replace('AUCTIONS', 'AUCTION')
      .replace('ABSENTEE_OWNERS', 'ABSENTEE_OWNER')
    );
}

// Transform property data
function transformProperty(prop: any) {
  const leadTypes = normalizeLeadTypes(prop.lead_types || []);
  const equityPercent = Math.max(0, prop.equity_percent || 0);
  const distressScore = calculateDistressScore(leadTypes, equityPercent);
  
  let estimatedEquity = prop.estimated_equity || 0;
  if (estimatedEquity < 0) estimatedEquity = 0;
  
  const estimatedValue = prop.estimated_value || 0;
  if (!estimatedEquity && equityPercent > 0 && estimatedValue > 0) {
    estimatedEquity = Math.round(estimatedValue * (equityPercent / 100));
  }
  
  // Extract foreclosure_borrower from various possible locations in Propwire data
  const foreclosureBorrower = 
    prop.foreclosure_borrower ||
    prop.foreclosure_details?.borrower_name ||
    prop.foreclosure_details?.borrower ||
    prop.borrower_name ||
    prop.borrower ||
    null;
  
  // Extract owner_name
  const ownerName = 
    prop.owner_name ||
    prop.basicInfo?.owner_name?.[0] ||
    prop.owner_details?.owner_names?.[0] ||
    prop.owner_details?.owner_name ||
    null;
  
  // Extract auction_date
  const auctionDateRaw = 
    prop.auction_date ||
    prop.foreclosure_details?.auction_date ||
    prop.foreclosure_details?.sale_date ||
    null;
  
  // Parse auction date
  let auctionDate = null;
  if (auctionDateRaw) {
    try {
      const parsed = new Date(auctionDateRaw);
      if (!isNaN(parsed.getTime())) {
        auctionDate = parsed.toISOString().split('T')[0];
      }
    } catch {}
  }
  
  return {
    property_id: prop.property_id,
    address: prop.address,
    city: prop.city,
    state: prop.state || 'TX',
    zip_code: prop.zip_code,
    county: prop.county || 'Dallas',
    property_type: prop.property_type || 'Single Family',
    ownership_type: prop.ownership_type || null,
    estimated_value: estimatedValue,
    estimated_equity: estimatedEquity,
    equity_percent: equityPercent,
    sqft: prop.sqft || null,
    lead_types: leadTypes,
    source: prop.source || 'propwire',
    scraped_at: prop.scraped_at || new Date().toISOString().split('T')[0],
    // NEW: Foreclosure/owner fields for golden lead matching
    foreclosure_borrower: foreclosureBorrower,
    owner_name: ownerName,
    auction_date: auctionDate,
    // Calculated fields
    distress_score: distressScore,
    situation_type: determineSituationType(leadTypes),
    opportunity_tier: determineOpportunityTier(distressScore, equityPercent),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const properties: any[] = Array.isArray(body) ? body : [body];
    
    if (properties.length === 0) {
      return NextResponse.json({ error: 'No properties provided' }, { status: 400 });
    }
    
    const results = {
      total: properties.length,
      imported: 0,
      withBorrower: 0,
      errors: [] as { index: number; address: string; error: string }[],
    };
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      const transformedBatch = batch.map(transformProperty);
      
      // Count how many have borrower names
      results.withBorrower += transformedBatch.filter(p => p.foreclosure_borrower).length;
      
      const { data, error } = await supabase
        .from('property_intelligence')
        .upsert(transformedBatch, { 
          onConflict: 'property_id',
          ignoreDuplicates: false 
        })
        .select('property_id');
      
      if (error) {
        // Try one by one to identify issues
        for (let j = 0; j < transformedBatch.length; j++) {
          const prop = transformedBatch[j];
          const { error: singleError } = await supabase
            .from('property_intelligence')
            .upsert(prop, { onConflict: 'property_id' });
          
          if (singleError) {
            results.errors.push({ 
              index: i + j, 
              address: prop.address || 'unknown',
              error: singleError.message 
            });
          } else {
            results.imported++;
          }
        }
      } else {
        results.imported += data?.length || batch.length;
      }
    }
    
    // Get summary stats
    const { data: stats } = await supabase
      .from('property_intelligence')
      .select('opportunity_tier, distress_score, estimated_equity, situation_type, foreclosure_borrower');
    
    const tierCounts = {
      golden: stats?.filter(s => s.opportunity_tier === 'golden').length || 0,
      hot: stats?.filter(s => s.opportunity_tier === 'hot').length || 0,
      warm: stats?.filter(s => s.opportunity_tier === 'warm').length || 0,
      cold: stats?.filter(s => s.opportunity_tier === 'cold').length || 0,
    };
    
    const withBorrowerTotal = stats?.filter(s => s.foreclosure_borrower).length || 0;
    const preforeclosures = stats?.filter(s => s.situation_type === 'preforeclosure').length || 0;
    const totalEquity = stats?.reduce((sum, s) => sum + (s.estimated_equity || 0), 0) || 0;
    
    return NextResponse.json({
      success: true,
      message: `Imported ${results.imported} of ${results.total} properties`,
      ...results,
      summary: {
        totalProperties: stats?.length || 0,
        withForeclosureBorrower: withBorrowerTotal,
        preforeclosures,
        tierCounts,
        totalEquity,
        avgDistressScore: stats?.length 
          ? Math.round(stats.reduce((sum, s) => sum + (s.distress_score || 0), 0) / stats.length)
          : 0,
      }
    });
    
  } catch (error: any) {
    console.error('Property import error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
