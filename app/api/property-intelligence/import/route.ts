// MaxSam V4 - Property Intelligence Import API
// Imports Propwire JSON data into property_intelligence table
// Supports both Apify scraper format and CSV-converted format

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Calculate distress score based on lead types
function calculateDistressScore(leadTypes: string[], equityPercent: number): number {
  let score = 0;
  
  const types = leadTypes.map(t => t.toUpperCase().replace(/\s+/g, '_'));
  
  if (types.some(t => t.includes('PREFORECLOSURE'))) score += 30;
  if (types.some(t => t.includes('FORECLOSURE') && !t.includes('PRE'))) score += 35;
  if (types.some(t => t.includes('AUCTION'))) score += 25;
  if (types.some(t => t.includes('TAX_LIEN') || t.includes('TAX'))) score += 25;
  if (types.some(t => t.includes('PROBATE'))) score += 20;
  if (types.some(t => t.includes('DIVORCE'))) score += 20;
  if (types.some(t => t.includes('BANKRUPTCY'))) score += 20;
  if (types.some(t => t.includes('VACANT'))) score += 15;
  if (types.some(t => t.includes('TIRED_LANDLORD') || t.includes('TIRED'))) score += 10;
  if (types.some(t => t.includes('ABSENTEE'))) score += 10;
  if (types.some(t => t.includes('HIGH_EQUITY') || t.includes('HIGH'))) score += 10;
  if (types.some(t => t.includes('FREE_AND_CLEAR') || t.includes('FREE'))) score += 5;
  if (types.some(t => t.includes('CASH_BUYER'))) score += 5;
  if (types.some(t => t.includes('ASSUMABLE'))) score += 5;
  if (types.some(t => t.includes('BARGAIN'))) score += 15;
  
  // Equity bonus
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

// Determine situation type from lead types
function determineSituationType(leadTypes: string[]): string {
  const types = leadTypes.map(t => t.toUpperCase());
  
  if (types.some(t => t.includes('PREFORECLOSURE'))) return 'preforeclosure';
  if (types.some(t => t.includes('FORECLOSURE'))) return 'foreclosure';
  if (types.some(t => t.includes('AUCTION'))) return 'auction';
  if (types.some(t => t.includes('TAX'))) return 'tax_lien';
  if (types.some(t => t.includes('PROBATE'))) return 'probate';
  if (types.some(t => t.includes('DIVORCE'))) return 'divorce';
  if (types.some(t => t.includes('VACANT'))) return 'vacant';
  if (types.some(t => t.includes('ABSENTEE'))) return 'absentee';
  if (types.some(t => t.includes('HIGH_EQUITY') || t.includes('HIGH'))) return 'high_equity';
  return 'unknown';
}

// Normalize lead types
function normalizeLeadTypes(leadTypes: string[]): string[] {
  return leadTypes
    .filter(t => t && !t.match(/^\d+\+?$/)) // Remove "4+", "7+" etc
    .map(t => t.toUpperCase().replace(/\s+/g, '_')
      .replace('PREFORECLOSURES', 'PREFORECLOSURE')
      .replace('AUCTIONS', 'AUCTION')
      .replace('ABSENTEE_OWNERS', 'ABSENTEE_OWNER')
      .replace('CASH_BUYERS', 'CASH_BUYER')
      .replace('EMPTY_NESTERS', 'EMPTY_NESTER')
      .replace('TIRED_LANDLORDS', 'TIRED_LANDLORD')
      .replace('BARGAIN_PROPERTIES', 'BARGAIN')
    );
}

// Transform property data to database schema
function transformProperty(prop: any) {
  // Handle both formats (Apify detailed and CSV-converted)
  const leadTypes = normalizeLeadTypes(prop.lead_types || prop.leadTypes || []);
  const equityPercent = prop.equity_percent || prop.equityPercent || 0;
  const distressScore = calculateDistressScore(leadTypes, equityPercent);
  
  // Get estimated equity - calculate if not provided
  let estimatedEquity = prop.estimated_equity || prop.estimatedEquity || 0;
  const estimatedValue = prop.estimated_value || prop.estimatedValue || 0;
  if (!estimatedEquity && equityPercent > 0 && estimatedValue > 0) {
    estimatedEquity = Math.round(estimatedValue * (equityPercent / 100));
  }
  
  return {
    propwire_id: prop.property_id || prop.propwire_id || prop.id?.toString() || `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    
    // Address
    address: prop.address || null,
    city: prop.city || null,
    state: prop.state || 'TX',
    zip: prop.zip_code || prop.zip || null,
    county: prop.county || 'Dallas',
    
    // Property details
    property_type: prop.property_type || prop.propertyType || 'Single Family',
    sqft: prop.sqft || prop.living_area_sf || null,
    lot_sqft: prop.lot_sqft || prop.lot_size_sf || null,
    bedrooms: prop.bedrooms || null,
    bathrooms: prop.bathrooms || null,
    year_built: prop.year_built || null,
    
    // Owner info
    owner_name: prop.owner_name || prop.ownerName || null,
    borrower_name: prop.borrower_name || null,
    owner_occupied: prop.ownership_type !== 'Absentee' && !leadTypes.includes('ABSENTEE_OWNER'),
    
    // Values
    estimated_value: estimatedValue || null,
    estimated_equity: estimatedEquity || null,
    equity_percent: equityPercent || null,
    
    // Distress signals
    lead_types: leadTypes,
    is_preforeclosure: leadTypes.some(t => t.includes('PREFORECLOSURE')),
    is_foreclosure: leadTypes.some(t => t.includes('FORECLOSURE') && !t.includes('PRE')),
    is_auction: leadTypes.some(t => t.includes('AUCTION')),
    is_vacant: leadTypes.some(t => t.includes('VACANT')),
    is_absentee: leadTypes.some(t => t.includes('ABSENTEE')),
    is_high_equity: leadTypes.some(t => t.includes('HIGH_EQUITY')) || equityPercent >= 50,
    
    // Foreclosure details (if available)
    foreclosure_auction_date: prop.foreclosure_details?.auction_date || prop.auction_date || null,
    foreclosure_case_number: prop.foreclosure_details?.case_number || null,
    
    // Calculated fields
    distress_score: distressScore,
    situation_type: determineSituationType(leadTypes),
    opportunity_tier: determineOpportunityTier(distressScore, equityPercent),
    
    // Metadata
    data_source: prop.source || 'propwire',
    imported_at: new Date().toISOString(),
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
      updated: 0,
      errors: [] as { index: number; error: string }[],
    };
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      const transformedBatch = batch.map(transformProperty);
      
      const { data, error } = await supabase
        .from('property_intelligence')
        .upsert(transformedBatch, { 
          onConflict: 'propwire_id',
          ignoreDuplicates: false 
        })
        .select('id');
      
      if (error) {
        // Try inserting one by one to identify problematic records
        for (let j = 0; j < transformedBatch.length; j++) {
          const { error: singleError } = await supabase
            .from('property_intelligence')
            .upsert(transformedBatch[j], { onConflict: 'propwire_id' });
          
          if (singleError) {
            results.errors.push({ index: i + j, error: singleError.message });
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
      .select('opportunity_tier, distress_score, estimated_equity')
      .order('imported_at', { ascending: false })
      .limit(properties.length);
    
    const tierCounts = {
      golden: stats?.filter(s => s.opportunity_tier === 'golden').length || 0,
      hot: stats?.filter(s => s.opportunity_tier === 'hot').length || 0,
      warm: stats?.filter(s => s.opportunity_tier === 'warm').length || 0,
      cold: stats?.filter(s => s.opportunity_tier === 'cold').length || 0,
    };
    
    const totalEquity = stats?.reduce((sum, s) => sum + (s.estimated_equity || 0), 0) || 0;
    
    return NextResponse.json({
      success: true,
      message: `Imported ${results.imported} of ${results.total} properties`,
      ...results,
      summary: {
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
