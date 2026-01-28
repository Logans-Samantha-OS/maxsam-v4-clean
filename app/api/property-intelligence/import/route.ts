// MaxSam V4 - Property Intelligence Import API
// Imports Propwire JSON data into property_intelligence table
// Updated to match existing Supabase schema

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
// ONLY includes columns that exist in Supabase table
function transformProperty(prop: any) {
  const leadTypes = normalizeLeadTypes(prop.lead_types || prop.leadTypes || []);
  const equityPercent = prop.equity_percent || prop.equityPercent || 0;
  const distressScore = calculateDistressScore(leadTypes, equityPercent);
  
  // Get estimated equity - calculate if not provided
  let estimatedEquity = prop.estimated_equity || prop.estimatedEquity || 0;
  const estimatedValue = prop.estimated_value || prop.estimatedValue || 0;
  if (!estimatedEquity && equityPercent > 0 && estimatedValue > 0) {
    estimatedEquity = Math.round(estimatedValue * (equityPercent / 100));
  }
  
  // Use property_id as the unique identifier
  const propwireId = prop.property_id || prop.propwire_id || `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Return ONLY fields that exist in the Supabase table
  return {
    property_id: propwireId,
    address: prop.address || null,
    city: prop.city || null,
    state: prop.state || 'TX',
    zip_code: prop.zip_code || prop.zip || null,
    county: prop.county || 'Dallas',
    property_type: prop.property_type || prop.propertyType || 'Single Family',
    ownership_type: prop.ownership_type || null,
    estimated_value: estimatedValue || null,
    estimated_equity: estimatedEquity || null,
    equity_percent: equityPercent || null,
    sqft: prop.sqft || null,
    lead_types: leadTypes,
    source: prop.source || 'propwire',
    scraped_at: prop.scraped_at || new Date().toISOString().split('T')[0],
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
      errors: [] as { index: number; address: string; error: string }[],
    };
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < properties.length; i += batchSize) {
      const batch = properties.slice(i, i + batchSize);
      const transformedBatch = batch.map(transformProperty);
      
      const { data, error } = await supabase
        .from('property_intelligence')
        .upsert(transformedBatch, { 
          onConflict: 'property_id',
          ignoreDuplicates: false 
        })
        .select('property_id');
      
      if (error) {
        // Try inserting one by one to identify problematic records
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
      .select('opportunity_tier, distress_score, estimated_equity');
    
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
        totalProperties: stats?.length || 0,
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
