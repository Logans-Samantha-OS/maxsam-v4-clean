// MaxSam V4 - Lead Export API for Partners
// Generates clean CSV exports for wholesale partners like Max

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json'; // json or csv
  const tier = searchParams.get('tier') || 'all'; // all, golden, hot, preforeclosure
  const minEquity = parseInt(searchParams.get('minEquity') || '0');
  const minDistress = parseInt(searchParams.get('minDistress') || '0');

  try {
    // Build query
    let query = supabase
      .from('property_intelligence')
      .select('*')
      .order('distress_score', { ascending: false });

    // Apply filters
    if (tier === 'golden') {
      query = query.gte('distress_score', 50).gte('equity_percent', 40);
    } else if (tier === 'hot') {
      query = query.or('distress_score.gte.40,equity_percent.gte.60');
    } else if (tier === 'preforeclosure') {
      query = query.contains('lead_types', ['PREFORECLOSURE']);
    }

    if (minEquity > 0) {
      query = query.gte('equity_percent', minEquity);
    }
    if (minDistress > 0) {
      query = query.gte('distress_score', minDistress);
    }

    const { data: properties, error } = await query;
    if (error) throw error;

    // Format for export
    const exportData = (properties || []).map((p, idx) => ({
      '#': idx + 1,
      'Address': p.address,
      'City': p.city,
      'State': p.state,
      'ZIP': p.zip_code,
      'County': p.county,
      'Property Type': p.property_type,
      'Estimated Value': p.estimated_value,
      'Estimated Equity': p.estimated_equity,
      'Equity %': p.equity_percent,
      'Distress Score': p.distress_score,
      'Opportunity Tier': p.opportunity_tier?.toUpperCase(),
      'Situation': p.situation_type,
      'Lead Types': (p.lead_types || []).join(', '),
      'SqFt': p.sqft,
      'Ownership': p.ownership_type,
      // Fields Max can help fill in
      'Owner Name': p.owner_name || '',
      'Foreclosure Borrower': p.foreclosure_borrower || '',
      'Auction Date': p.auction_date || '',
    }));

    // Return CSV if requested
    if (format === 'csv') {
      const headers = Object.keys(exportData[0] || {});
      const csvRows = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(h => {
            const val = row[h as keyof typeof row];
            // Escape commas and quotes
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val ?? '';
          }).join(',')
        )
      ];
      
      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="maxsam-leads-${tier}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Calculate summary stats
    const totalValue = properties?.reduce((sum, p) => sum + (p.estimated_value || 0), 0) || 0;
    const totalEquity = properties?.reduce((sum, p) => sum + (p.estimated_equity || 0), 0) || 0;
    const avgDistress = properties?.length 
      ? Math.round(properties.reduce((sum, p) => sum + (p.distress_score || 0), 0) / properties.length)
      : 0;

    const preforeclosures = properties?.filter(p => p.lead_types?.includes('PREFORECLOSURE')).length || 0;
    const highEquity = properties?.filter(p => (p.equity_percent || 0) >= 60).length || 0;

    return NextResponse.json({
      success: true,
      exportDate: new Date().toISOString(),
      filters: { tier, minEquity, minDistress },
      summary: {
        totalLeads: properties?.length || 0,
        preforeclosures,
        highEquity,
        totalValue,
        totalEquity,
        avgDistressScore: avgDistress,
        needsOwnerName: properties?.filter(p => !p.owner_name).length || 0,
        needsBorrowerName: properties?.filter(p => !p.foreclosure_borrower).length || 0,
      },
      leads: exportData,
      partnershipNote: {
        message: "These leads are missing owner/borrower names. If you can provide names from your title company access, we can split excess funds recovery deals 50/50.",
        missingFields: ['Owner Name', 'Foreclosure Borrower', 'Auction Date'],
        potentialValue: "118 excess funds cases worth $4.08M in Dallas/Denton - 25% recovery fee potential",
      }
    });

  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
