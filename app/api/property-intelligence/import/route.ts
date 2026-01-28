// MaxSam V4 - Property Intelligence Import API
// Imports Propwire JSON data into property_intelligence table

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PropwireProperty {
  id: number;
  property_details?: {
    address_details?: {
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      county?: string;
      label?: string;
    };
    building_details?: {
      bedrooms?: number;
      bathrooms?: number;
      building_area_sf?: number;
      living_area_sf?: number;
      year_built?: number;
      stories?: number;
    };
    building_interior_details?: {
      bedrooms?: number;
      bathrooms?: number;
    };
  };
  parcel_details?: {
    property_type?: string;
    lot_size_sf?: number;
    lot_size_acres?: string;
  };
  owner_details?: {
    owner_names?: string[];
    owner_occupied?: boolean;
    owner_mailing_address_details?: {
      label?: string;
    };
  };
  equity_details?: {
    estimated_equity?: number;
    estimated_equity_percentage?: number;
    estimated_value?: number;
  };
  lead_type?: string[];
  foreclosure_details?: {
    active?: boolean;
    auction_date?: string;
    auction_time?: string;
    borrower_name?: string;
    lender_name?: string;
    case_number?: string;
    opening_bid?: number;
    default_amount?: number;
  };
  current_mortgages?: Array<{
    loan_balance?: string;
    lender_name?: string;
    interest_rate?: string;
    loan_type?: string;
  }>;
}

// Calculate distress score based on lead types
function calculateDistressScore(leadTypes: string[]): number {
  let score = 0;
  
  if (leadTypes.includes('PREFORECLOSURE')) score += 30;
  if (leadTypes.includes('FORECLOSURE')) score += 35;
  if (leadTypes.includes('AUCTION')) score += 25;
  if (leadTypes.includes('TAX_LIEN')) score += 25;
  if (leadTypes.includes('PROBATE')) score += 20;
  if (leadTypes.includes('DIVORCE')) score += 20;
  if (leadTypes.includes('BANKRUPTCY')) score += 20;
  if (leadTypes.includes('VACANT')) score += 15;
  if (leadTypes.includes('TIRED_LANDLORD')) score += 10;
  if (leadTypes.includes('ABSENTEE_OWNER')) score += 10;
  if (leadTypes.includes('HIGH_EQUITY')) score += 10;
  if (leadTypes.includes('FREE_AND_CLEAR')) score += 5;
  if (leadTypes.includes('CASH_BUYER')) score += 5;
  if (leadTypes.includes('ASSUMABLE_LOAN')) score += 5;
  
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
  if (leadTypes.includes('PREFORECLOSURE')) return 'preforeclosure';
  if (leadTypes.includes('FORECLOSURE')) return 'foreclosure';
  if (leadTypes.includes('AUCTION')) return 'auction';
  if (leadTypes.includes('TAX_LIEN')) return 'tax_lien';
  if (leadTypes.includes('PROBATE')) return 'probate';
  if (leadTypes.includes('DIVORCE')) return 'divorce';
  if (leadTypes.includes('VACANT')) return 'vacant';
  if (leadTypes.includes('ABSENTEE_OWNER')) return 'absentee';
  if (leadTypes.includes('HIGH_EQUITY')) return 'high_equity';
  return 'unknown';
}

// Transform Propwire data to property_intelligence schema
function transformPropwireData(prop: PropwireProperty) {
  const address = prop.property_details?.address_details;
  const building = prop.property_details?.building_details;
  const interior = prop.property_details?.building_interior_details;
  const owner = prop.owner_details;
  const equity = prop.equity_details;
  const foreclosure = prop.foreclosure_details;
  const leadTypes = prop.lead_type || [];
  
  const distressScore = calculateDistressScore(leadTypes);
  const equityPercent = equity?.estimated_equity_percentage || 0;
  
  return {
    propwire_id: String(prop.id),
    
    // Address
    address: address?.address || address?.label?.split(',')[0] || null,
    city: address?.city || null,
    state: address?.state || 'TX',
    zip: address?.zip || null,
    county: address?.county || 'Dallas',
    
    // Owner
    owner_name: owner?.owner_names?.[0] || null,
    borrower_name: foreclosure?.borrower_name || null,
    mailing_address: owner?.owner_mailing_address_details?.label || null,
    owner_occupied: owner?.owner_occupied || false,
    
    // Property details
    property_type: prop.parcel_details?.property_type || 'SFR',
    bedrooms: interior?.bedrooms || building?.bedrooms || null,
    bathrooms: interior?.bathrooms || building?.bathrooms || null,
    sqft: building?.living_area_sf || building?.building_area_sf || null,
    lot_sqft: prop.parcel_details?.lot_size_sf || null,
    year_built: building?.year_built || null,
    stories: building?.stories || null,
    
    // Values
    estimated_value: equity?.estimated_value || null,
    estimated_equity: equity?.estimated_equity || null,
    equity_percent: equityPercent,
    
    // Mortgage info
    mortgage_balance: prop.current_mortgages?.[0]?.loan_balance 
      ? parseFloat(prop.current_mortgages[0].loan_balance) 
      : null,
    lender_name: prop.current_mortgages?.[0]?.lender_name || foreclosure?.lender_name || null,
    interest_rate: prop.current_mortgages?.[0]?.interest_rate 
      ? parseFloat(prop.current_mortgages[0].interest_rate) 
      : null,
    loan_type: prop.current_mortgages?.[0]?.loan_type || null,
    
    // Distress signals
    lead_types: leadTypes,
    is_preforeclosure: leadTypes.includes('PREFORECLOSURE'),
    is_foreclosure: leadTypes.includes('FORECLOSURE'),
    is_auction: foreclosure?.active || false,
    is_vacant: leadTypes.includes('VACANT'),
    is_absentee: leadTypes.includes('ABSENTEE_OWNER'),
    is_high_equity: leadTypes.includes('HIGH_EQUITY'),
    
    // Foreclosure details
    foreclosure_auction_date: foreclosure?.auction_date || null,
    foreclosure_auction_time: foreclosure?.auction_time || null,
    foreclosure_case_number: foreclosure?.case_number || null,
    opening_bid: foreclosure?.opening_bid || null,
    default_amount: foreclosure?.default_amount || null,
    
    // Calculated fields
    distress_score: distressScore,
    situation_type: determineSituationType(leadTypes),
    opportunity_tier: determineOpportunityTier(distressScore, equityPercent),
    
    // Metadata
    data_source: 'propwire',
    imported_at: new Date().toISOString(),
    raw_data: prop,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const properties: PropwireProperty[] = Array.isArray(body) ? body : [body];
    
    if (properties.length === 0) {
      return NextResponse.json({ error: 'No properties provided' }, { status: 400 });
    }
    
    const results = {
      total: properties.length,
      imported: 0,
      errors: [] as { id: number; error: string }[],
      imported_ids: [] as string[],
    };
    
    for (const prop of properties) {
      try {
        const transformed = transformPropwireData(prop);
        
        const { data, error } = await supabase
          .from('property_intelligence')
          .upsert(transformed, { 
            onConflict: 'propwire_id',
            ignoreDuplicates: false 
          })
          .select('id, propwire_id')
          .single();
        
        if (error) {
          results.errors.push({ id: prop.id, error: error.message });
        } else {
          results.imported++;
          results.imported_ids.push(data.id);
        }
      } catch (err: any) {
        results.errors.push({ id: prop.id, error: err.message });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Imported ${results.imported} of ${results.total} properties`,
      ...results,
    });
    
  } catch (error: any) {
    console.error('Property import error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
