// MaxSam V4 - Golden Lead Cross-Reference API
// Matches excess_funds with property_intelligence by ADDRESS
// GOLDEN LEAD = same property in BOTH tables = dual opportunity!

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize address for matching
function normalizeAddress(address: string): string {
  if (!address) return '';
  
  return address
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s+(STREET|ST|DRIVE|DR|AVENUE|AVE|LANE|LN|COURT|CT|CIRCLE|CIR|BOULEVARD|BLVD|ROAD|RD|WAY|PLACE|PL|TRAIL|TRL|PARKWAY|PKWY)\.?$/i, '')
    .replace(/\s+(APT|UNIT|STE|SUITE|#)\s*\S+/i, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract just the street number and name for matching
function extractStreetCore(address: string): { number: string; street: string } | null {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;
  
  const parts = normalized.split(' ');
  if (parts.length < 2) return null;
  
  const number = parts[0];
  if (!/^\d+$/.test(number)) return null;
  
  // Get street name (skip direction prefixes like N, S, E, W)
  let streetParts = parts.slice(1);
  if (['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NORTH', 'SOUTH', 'EAST', 'WEST'].includes(streetParts[0])) {
    streetParts = streetParts.slice(1);
  }
  
  return {
    number,
    street: streetParts.join(' ')
  };
}

// Check if two addresses match
function addressesMatch(addr1: string, addr2: string): { match: boolean; confidence: string } {
  const core1 = extractStreetCore(addr1);
  const core2 = extractStreetCore(addr2);
  
  if (!core1 || !core2) return { match: false, confidence: 'NONE' };
  
  // Must have same street number
  if (core1.number !== core2.number) return { match: false, confidence: 'NONE' };
  
  // Exact street match
  if (core1.street === core2.street) return { match: true, confidence: 'HIGH' };
  
  // Check if one contains the other
  if (core1.street.includes(core2.street) || core2.street.includes(core1.street)) {
    return { match: true, confidence: 'MEDIUM' };
  }
  
  // Check first word of street name matches (handles abbreviation differences)
  const street1First = core1.street.split(' ')[0];
  const street2First = core2.street.split(' ')[0];
  if (street1First && street2First && street1First === street2First && street1First.length > 3) {
    return { match: true, confidence: 'MEDIUM' };
  }
  
  return { match: false, confidence: 'NONE' };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county');
  const runMatch = searchParams.get('match') === 'true';

  try {
    // Get all excess funds (with property_address)
    let excessQuery = supabase
      .from('excess_funds')
      .select('*')
      .not('property_address', 'is', null);
    if (county) excessQuery = excessQuery.ilike('county', `%${county}%`);
    const { data: excessFunds, error: excessError } = await excessQuery;
    if (excessError) throw excessError;

    // Get all properties
    let propertyQuery = supabase.from('property_intelligence').select('*');
    if (county) propertyQuery = propertyQuery.ilike('county', `%${county}%`);
    const { data: properties, error: propertyError } = await propertyQuery;
    if (propertyError) throw propertyError;

    // If not running match, just return counts
    if (!runMatch) {
      const withAddress = excessFunds?.filter(e => e.property_address).length || 0;
      return NextResponse.json({
        success: true,
        excessFundsCount: excessFunds?.length || 0,
        excessFundsWithAddress: withAddress,
        propertiesCount: properties?.length || 0,
        message: 'Add ?match=true to run cross-reference'
      });
    }

    // === CROSS-REFERENCE MATCHING BY ADDRESS ===
    const goldenLeads: any[] = [];
    const matchLog: string[] = [];
    const checkedPairs = new Set<string>();

    for (const excess of (excessFunds || [])) {
      if (!excess.property_address) continue;
      
      // Extract just the street address from excess_funds (before city)
      const excessAddr = excess.property_address.split(',')[0].trim();
      
      for (const property of (properties || [])) {
        if (!property.address) continue;
        
        const pairKey = `${excess.id}-${property.property_id}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);
        
        const matchResult = addressesMatch(excessAddr, property.address);
        
        if (matchResult.match) {
          // Also verify city matches (if available)
          const excessCity = excess.property_address.match(/,\s*([^,]+),?\s*TX/i)?.[1]?.trim().toUpperCase();
          const propCity = property.city?.toUpperCase();
          
          // Skip if cities don't match (when both are available)
          if (excessCity && propCity && !excessCity.includes(propCity.substring(0, 4)) && !propCity.includes(excessCity.substring(0, 4))) {
            continue;
          }
          
          matchLog.push(`✓ ${matchResult.confidence}: "${property.address}, ${property.city}" <-> "${excess.property_address}"`);
          
          const excessAmount = parseFloat(excess.excess_amount) || 0;
          const propertyEquity = parseFloat(property.estimated_equity) || 0;
          
          goldenLeads.push({
            // Property data
            property_id: property.property_id,
            property_address: property.address,
            property_city: property.city,
            property_zip: property.zip_code,
            property_county: property.county,
            property_type: property.property_type,
            estimated_value: property.estimated_value,
            estimated_equity: propertyEquity,
            equity_percent: property.equity_percent,
            opportunity_tier: property.opportunity_tier,
            distress_score: property.distress_score,
            situation_type: property.situation_type,
            lead_types: property.lead_types,
            
            // Excess funds data
            excess_funds_id: excess.id,
            excess_case_number: excess.case_number,
            excess_amount: excessAmount,
            excess_defendant: excess.defendant_name,
            excess_property_address: excess.property_address,
            excess_deadline: excess.redemption_deadline,
            excess_county: excess.county,
            
            // GOLDEN OPPORTUNITY CALCULATION
            combined_value: propertyEquity + excessAmount,
            
            // Fee calculations
            excess_fee_25pct: Math.round(excessAmount * 0.25),
            wholesale_fee_10pct: Math.round(propertyEquity * 0.10),
            total_potential_fee: Math.round(excessAmount * 0.25) + Math.round(propertyEquity * 0.10),
            
            match_confidence: matchResult.confidence,
          });
        }
      }
    }

    // Deduplicate
    const uniqueGolden = goldenLeads.filter((lead, index, self) =>
      index === self.findIndex(l => 
        l.property_id === lead.property_id && l.excess_funds_id === lead.excess_funds_id
      )
    );

    // Update excess_funds table to mark golden leads
    for (const golden of uniqueGolden) {
      await supabase
        .from('excess_funds')
        .update({ 
          is_golden_lead: true, 
          matched_property_id: golden.property_id 
        })
        .eq('id', golden.excess_funds_id);
    }

    // Sort by total potential fee (highest first)
    uniqueGolden.sort((a, b) => b.total_potential_fee - a.total_potential_fee);
    
    // Calculate totals
    const totalExcessAmount = uniqueGolden.reduce((sum, g) => sum + g.excess_amount, 0);
    const totalPropertyEquity = uniqueGolden.reduce((sum, g) => sum + g.estimated_equity, 0);
    const totalCombinedValue = uniqueGolden.reduce((sum, g) => sum + g.combined_value, 0);
    const totalPotentialFees = uniqueGolden.reduce((sum, g) => sum + g.total_potential_fee, 0);

    return NextResponse.json({
      success: true,
      
      // Summary
      goldenLeadsFound: uniqueGolden.length,
      totalExcessAmount,
      totalPropertyEquity,
      totalCombinedValue,
      totalPotentialFees,
      
      // Top leads
      goldenLeads: uniqueGolden,
      
      // Debug info
      matchLog: matchLog.slice(0, 100),
      stats: {
        excessFundsSearched: excessFunds?.length || 0,
        excessFundsWithAddress: excessFunds?.filter(e => e.property_address).length || 0,
        propertiesSearched: properties?.length || 0,
      }
    });

  } catch (error: any) {
    console.error('Golden Lead API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Manually flag a golden lead
export async function POST(request: Request) {
  try {
    const { excessFundId, propertyId } = await request.json();

    const { error } = await supabase
      .from('excess_funds')
      .update({ 
        is_golden_lead: true, 
        matched_property_id: propertyId 
      })
      .eq('id', excessFundId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Golden lead flagged' });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
