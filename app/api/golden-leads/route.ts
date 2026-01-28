// MaxSam V4 - Golden Lead Cross-Reference API
// Cross-references excess_funds with property_intelligence to find GOLDEN LEADS
// Matches by: address similarity AND/OR defendant name to property address

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
    .replace(/\s+(ST|STREET|DR|DRIVE|AVE|AVENUE|LN|LANE|CT|COURT|CIR|CIRCLE|BLVD|BOULEVARD|RD|ROAD|WAY|PL|PLACE|TRL|TRAIL)\.?$/i, '')
    .replace(/\s+(APT|UNIT|STE|SUITE|#)\s*\S+/i, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalize name for matching
function normalizeName(name: string): string[] {
  if (!name) return [];
  
  const cleaned = name
    .toUpperCase()
    .replace(/\s+(JR|SR|II|III|IV|EST|ESTATE|AKA|FKA|ETAL|ET\s*AL|HEIRS|TRUSTEE|LLC|INC|CORP)\.?/g, '')
    .replace(/[^A-Z\s]/g, '')
    .trim();
  
  return cleaned.split(/\s+/).filter(p => p.length > 2);
}

// Check if two addresses match
function addressesMatch(addr1: string, addr2: string): boolean {
  const norm1 = normalizeAddress(addr1);
  const norm2 = normalizeAddress(addr2);
  
  if (!norm1 || !norm2) return false;
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // Check if one contains the other (for partial matches)
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  // Extract street number and name
  const parts1 = norm1.split(' ');
  const parts2 = norm2.split(' ');
  
  // Must have same street number
  if (parts1[0] !== parts2[0]) return false;
  
  // Check if street names overlap significantly
  const streetParts1 = parts1.slice(1);
  const streetParts2 = parts2.slice(1);
  
  const matchingParts = streetParts1.filter(p => streetParts2.includes(p));
  return matchingParts.length >= Math.min(streetParts1.length, streetParts2.length) * 0.5;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county');
  const runMatch = searchParams.get('match') === 'true';

  try {
    // Get all excess funds
    let excessQuery = supabase.from('excess_funds').select('*');
    if (county) excessQuery = excessQuery.eq('county', county);
    const { data: excessFunds, error: excessError } = await excessQuery;
    if (excessError) throw excessError;

    // Get all properties
    let propertyQuery = supabase.from('property_intelligence').select('*');
    if (county) propertyQuery = propertyQuery.ilike('county', `%${county}%`);
    const { data: properties, error: propertyError } = await propertyQuery;
    if (propertyError) throw propertyError;

    // If not running match, just return counts
    if (!runMatch) {
      return NextResponse.json({
        success: true,
        excessFundsCount: excessFunds?.length || 0,
        propertiesCount: properties?.length || 0,
        message: 'Add ?match=true to run cross-reference'
      });
    }

    // === CROSS-REFERENCE MATCHING ===
    const goldenLeads: any[] = [];
    const matchLog: string[] = [];

    for (const property of (properties || [])) {
      const propertyAddress = property.address || '';
      const propertyCity = property.city || '';
      
      for (const excess of (excessFunds || [])) {
        let isMatch = false;
        let matchType = '';
        
        // Method 1: Match by property_address in excess_funds
        if (excess.property_address && addressesMatch(propertyAddress, excess.property_address)) {
          isMatch = true;
          matchType = 'ADDRESS_DIRECT';
        }
        
        // Method 2: Check if defendant name contains property address number
        if (!isMatch && excess.defendant_name) {
          const streetNumber = propertyAddress.split(' ')[0];
          if (streetNumber && streetNumber.match(/^\d+$/) && excess.defendant_name.includes(streetNumber)) {
            // Additional check - city should somewhat match
            if (propertyCity && excess.defendant_name.toUpperCase().includes(propertyCity.toUpperCase().substring(0, 4))) {
              isMatch = true;
              matchType = 'ADDRESS_IN_DEFENDANT';
            }
          }
        }
        
        // Method 3: If excess_funds has property_address, try fuzzy match with city
        if (!isMatch && excess.property_address) {
          const excessCity = excess.property_address.match(/,\s*([A-Za-z\s]+),?\s*TX/i)?.[1]?.trim();
          if (excessCity && propertyCity.toUpperCase().includes(excessCity.toUpperCase().substring(0, 4))) {
            if (addressesMatch(propertyAddress, excess.property_address.split(',')[0])) {
              isMatch = true;
              matchType = 'ADDRESS_FUZZY';
            }
          }
        }
        
        if (isMatch) {
          matchLog.push(`${matchType}: "${propertyAddress}, ${propertyCity}" <-> "${excess.property_address || excess.defendant_name}"`);
          
          goldenLeads.push({
            // Property data
            property_id: property.property_id || property.id,
            property_address: propertyAddress,
            property_city: propertyCity,
            property_county: property.county,
            property_value: property.estimated_value,
            property_equity: property.estimated_equity,
            opportunity_tier: property.opportunity_tier,
            distress_score: property.distress_score,
            lead_types: property.lead_types,
            
            // Excess funds data
            excess_funds_id: excess.id,
            excess_case_number: excess.case_number,
            excess_amount: excess.excess_amount,
            excess_defendant: excess.defendant_name,
            excess_property_address: excess.property_address,
            excess_deadline: excess.redemption_deadline,
            excess_county: excess.county,
            
            // Combined opportunity
            combined_value: parseFloat(property.estimated_equity || 0) + parseFloat(excess.excess_amount || 0),
            potential_fee_25pct: parseFloat(excess.excess_amount || 0) * 0.25,
            potential_fee_10pct_wholesale: parseFloat(property.estimated_equity || 0) * 0.10,
            match_type: matchType,
          });
        }
      }
    }

    // Deduplicate by property + excess fund combination
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

    // Sort by combined value
    uniqueGolden.sort((a, b) => b.combined_value - a.combined_value);
    
    // Calculate totals
    const totalCombinedValue = uniqueGolden.reduce((sum, g) => sum + g.combined_value, 0);
    const totalPotentialFees = uniqueGolden.reduce((sum, g) => sum + g.potential_fee_25pct + g.potential_fee_10pct_wholesale, 0);

    return NextResponse.json({
      success: true,
      goldenLeadsFound: uniqueGolden.length,
      totalCombinedValue,
      totalPotentialFees,
      goldenLeads: uniqueGolden,
      matchLog: matchLog.slice(0, 100),
      stats: {
        excessFundsSearched: excessFunds?.length || 0,
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
