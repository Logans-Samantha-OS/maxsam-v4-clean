// MaxSam V4 - Golden Lead Cross-Reference API
// Matches excess_funds.defendant_name against property_intelligence.foreclosure_borrower
// GOLDEN LEAD = foreclosure borrower who also has unclaimed excess funds!

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize name for matching
function normalizeName(name: string): string {
  if (!name) return '';
  
  return name
    .toUpperCase()
    .replace(/\s+(JR|SR|II|III|IV|V|EST|ESTATE|AKA|FKA|DBA|ETAL|ET\s*AL|HEIRS|TRUSTEE|TRUST|LLC|INC|CORP|CO|LTD|LP|LLP)\.?/gi, '')
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract name parts
function extractNameParts(name: string): { firstName: string; lastName: string; allParts: string[] } {
  const normalized = normalizeName(name);
  const parts = normalized.split(' ').filter(p => p.length > 1);
  
  if (parts.length === 0) return { firstName: '', lastName: '', allParts: [] };
  if (parts.length === 1) return { firstName: '', lastName: parts[0], allParts: parts };
  
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
    allParts: parts
  };
}

// Check if two names match
function namesMatch(name1: string, name2: string): { match: boolean; confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' } {
  const parts1 = extractNameParts(name1);
  const parts2 = extractNameParts(name2);
  
  if (!parts1.lastName || !parts2.lastName) {
    return { match: false, confidence: 'NONE' };
  }
  
  const lastNameMatch = parts1.lastName === parts2.lastName;
  if (!lastNameMatch) {
    if (parts1.lastName.length > 4 && parts2.lastName.length > 4) {
      if (parts1.lastName.includes(parts2.lastName) || parts2.lastName.includes(parts1.lastName)) {
        const otherMatch = parts1.allParts.some(p1 => 
          parts2.allParts.some(p2 => p1 === p2 && p1 !== parts1.lastName)
        );
        if (otherMatch) return { match: true, confidence: 'LOW' };
      }
    }
    return { match: false, confidence: 'NONE' };
  }
  
  if (parts1.firstName && parts2.firstName) {
    if (parts1.firstName === parts2.firstName) return { match: true, confidence: 'HIGH' };
    if (parts1.firstName[0] === parts2.firstName[0]) return { match: true, confidence: 'MEDIUM' };
    
    const anyPartMatch = parts1.allParts.some(p1 => 
      parts2.allParts.some(p2 => p1 === p2 && p1.length > 2)
    );
    if (anyPartMatch) return { match: true, confidence: 'LOW' };
    
    return { match: false, confidence: 'NONE' };
  }
  
  if (lastNameMatch) return { match: true, confidence: 'LOW' };
  
  return { match: false, confidence: 'NONE' };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county');
  const runMatch = searchParams.get('match') === 'true';
  const minConfidence = searchParams.get('confidence') || 'LOW';

  try {
    // Get all excess funds
    let excessQuery = supabase.from('excess_funds').select('*');
    if (county) excessQuery = excessQuery.ilike('county', `%${county}%`);
    const { data: excessFunds, error: excessError } = await excessQuery;
    if (excessError) throw excessError;

    // Get property count (all)
    const { count: totalProperties } = await supabase
      .from('property_intelligence')
      .select('*', { count: 'exact', head: true });

    // Get properties WITH foreclosure_borrower
    let propertyQuery = supabase
      .from('property_intelligence')
      .select('*')
      .not('foreclosure_borrower', 'is', null);
    if (county) propertyQuery = propertyQuery.ilike('county', `%${county}%`);
    const { data: properties, error: propertyError } = await propertyQuery;
    if (propertyError) throw propertyError;

    const propertiesWithBorrower = properties?.length || 0;

    // If not running match, just return counts
    if (!runMatch) {
      return NextResponse.json({
        success: true,
        excessFundsCount: excessFunds?.length || 0,
        totalProperties: totalProperties || 0,
        propertiesWithBorrower,
        message: propertiesWithBorrower === 0 
          ? '⚠️ No properties have foreclosure_borrower data. Need Propwire API scrape with full details to get borrower names.'
          : 'Add ?match=true to run cross-reference'
      });
    }

    // If no properties have borrower names, return early with helpful message
    if (propertiesWithBorrower === 0) {
      return NextResponse.json({
        success: true,
        goldenLeadsFound: 0,
        message: '⚠️ Cannot match: No properties have foreclosure_borrower populated. Your current Propwire data is from a basic scrape without borrower names.',
        nextSteps: [
          '1. Run Apify memo23/propwire-leads-scraper with FULL detail mode',
          '2. Or manually add foreclosure_borrower to your JSON data',
          '3. Or get data from county foreclosure records directly'
        ],
        stats: {
          excessFundsAvailable: excessFunds?.length || 0,
          totalProperties: totalProperties || 0,
          propertiesWithBorrower: 0,
        }
      });
    }

    // === CROSS-REFERENCE: defendant_name <-> foreclosure_borrower ===
    const confidenceLevels = ['HIGH', 'MEDIUM', 'LOW'];
    const minConfidenceIndex = confidenceLevels.indexOf(minConfidence.toUpperCase());
    const allowedConfidences = confidenceLevels.slice(0, minConfidenceIndex + 1);

    const goldenLeads: any[] = [];
    const matchLog: string[] = [];

    for (const excess of (excessFunds || [])) {
      const defendantName = excess.defendant_name_normalized || excess.defendant_name;
      if (!defendantName) continue;
      
      for (const property of (properties || [])) {
        if (!property.foreclosure_borrower) continue;
        
        const matchResult = namesMatch(defendantName, property.foreclosure_borrower);
        
        if (matchResult.match && allowedConfidences.includes(matchResult.confidence)) {
          matchLog.push(`${matchResult.confidence}: "${defendantName}" <-> "${property.foreclosure_borrower}" @ ${property.address}`);
          
          const excessAmount = parseFloat(excess.excess_amount) || 0;
          const propertyEquity = parseFloat(property.estimated_equity) || 0;
          
          goldenLeads.push({
            property_id: property.property_id,
            address: property.address,
            city: property.city,
            zip: property.zip_code,
            county: property.county,
            estimated_value: property.estimated_value,
            estimated_equity: propertyEquity,
            equity_percent: property.equity_percent,
            opportunity_tier: property.opportunity_tier,
            distress_score: property.distress_score,
            foreclosure_borrower: property.foreclosure_borrower,
            
            excess_funds_id: excess.id,
            case_number: excess.case_number,
            excess_amount: excessAmount,
            defendant_name: excess.defendant_name,
            
            combined_value: propertyEquity + excessAmount,
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

    // Update excess_funds to mark golden leads
    for (const golden of uniqueGolden) {
      await supabase
        .from('excess_funds')
        .update({ is_golden_lead: true, matched_property_id: golden.property_id })
        .eq('id', golden.excess_funds_id);
    }

    uniqueGolden.sort((a, b) => b.total_potential_fee - a.total_potential_fee);
    
    const totalPotentialFees = uniqueGolden.reduce((sum, g) => sum + g.total_potential_fee, 0);

    return NextResponse.json({
      success: true,
      goldenLeadsFound: uniqueGolden.length,
      totalPotentialFees,
      byConfidence: {
        HIGH: uniqueGolden.filter(g => g.match_confidence === 'HIGH').length,
        MEDIUM: uniqueGolden.filter(g => g.match_confidence === 'MEDIUM').length,
        LOW: uniqueGolden.filter(g => g.match_confidence === 'LOW').length,
      },
      goldenLeads: uniqueGolden,
      matchLog: matchLog.slice(0, 50),
      stats: {
        excessFundsSearched: excessFunds?.length || 0,
        propertiesWithBorrower,
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

export async function POST(request: Request) {
  try {
    const { excessFundId, propertyId } = await request.json();

    const { error } = await supabase
      .from('excess_funds')
      .update({ is_golden_lead: true, matched_property_id: propertyId })
      .eq('id', excessFundId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Golden lead flagged' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
