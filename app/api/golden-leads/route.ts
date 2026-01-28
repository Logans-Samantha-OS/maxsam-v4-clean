// MaxSam V4 - Golden Lead Cross-Reference API
// File: app/api/golden-leads/route.ts
// Cross-references excess_funds with property_intelligence to find GOLDEN LEADS

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize name for matching
function normalizeName(name: string): string[] {
  if (!name) return [];
  
  // Remove common suffixes and clean up
  const cleaned = name
    .toUpperCase()
    .replace(/\s+(JR|SR|II|III|IV|EST|ESTATE|AKA|FKA|ETAL|ET\s*AL|HEIRS|TRUSTEE|LLC|INC|CORP)\.?/g, '')
    .replace(/[^A-Z\s]/g, '')
    .trim();
  
  // Split into individual names for flexible matching
  const parts = cleaned.split(/\s+/).filter(p => p.length > 2);
  
  return parts;
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
      // Get all owner names from property
      const ownerNames = [
        property.owner_name,
        property.borrower_name,
        property.owner_1_name,
        property.owner_2_name,
      ].filter(Boolean);

      for (const ownerName of ownerNames) {
        const ownerParts = normalizeName(ownerName);
        
        for (const excess of (excessFunds || [])) {
          const defendantParts = normalizeName(excess.defendant_name);
          
          // Check for last name match (most important)
          const lastNameMatch = ownerParts.some(op => 
            defendantParts.some(dp => dp === op && op.length > 3)
          );
          
          // Check for first name match  
          const firstNameMatch = ownerParts.length > 1 && defendantParts.length > 1 &&
            ownerParts.some(op => defendantParts.includes(op));

          // GOLDEN LEAD: Last name match + at least one other name part OR exact multi-word match
          if (lastNameMatch && (firstNameMatch || ownerParts.length === 1)) {
            matchLog.push(`MATCH: "${ownerName}" <-> "${excess.defendant_name}"`);
            
            goldenLeads.push({
              // Property data
              property_id: property.id,
              property_address: property.address || property.property_address,
              property_city: property.city,
              property_county: property.county,
              property_value: property.estimated_value,
              property_equity: property.estimated_equity,
              auction_date: property.auction_date || property.foreclosure_auction_date,
              owner_name: ownerName,
              
              // Excess funds data
              excess_funds_id: excess.id,
              excess_case_number: excess.case_number,
              excess_amount: excess.excess_amount,
              excess_defendant: excess.defendant_name,
              excess_deadline: excess.redemption_deadline,
              
              // Combined opportunity
              combined_value: parseFloat(property.estimated_equity || 0) + parseFloat(excess.excess_amount || 0),
              match_confidence: firstNameMatch ? 'HIGH' : 'MEDIUM',
            });
          }
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

    return NextResponse.json({
      success: true,
      goldenLeadsFound: uniqueGolden.length,
      totalCombinedValue: uniqueGolden.reduce((sum, g) => sum + g.combined_value, 0),
      goldenLeads: uniqueGolden,
      matchLog: matchLog.slice(0, 50), // First 50 matches for debugging
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