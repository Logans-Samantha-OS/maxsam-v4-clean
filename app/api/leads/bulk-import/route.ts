/**
 * Bulk Import Leads API
 * N8N webhook endpoint for importing leads from county PDF scrapes
 *
 * POST /api/leads/bulk-import
 * Body: { leads: Array<LeadData>, source?: string, county?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface LeadImportData {
  owner_name: string;
  property_address: string;
  city?: string;
  state?: string;
  zip_code?: string;
  excess_funds_amount?: number;
  phone?: string;
  phone_1?: string;
  phone_2?: string;
  email?: string;
  case_number?: string;
  sale_date?: string;
  // Allow additional fields
  [key: string]: unknown;
}

interface BulkImportRequest {
  leads: LeadImportData[];
  source?: string;
  county?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body: BulkImportRequest = await request.json();
    const { leads, source = 'n8n_import', county } = body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'leads array is required and must not be empty', success: false },
        { status: 400 }
      );
    }

    // Prepare leads for insert
    const leadsToInsert = leads.map((lead) => ({
      owner_name: lead.owner_name,
      property_address: lead.property_address,
      city: lead.city || null,
      state: lead.state || 'TX',
      zip_code: lead.zip_code || null,
      excess_funds_amount: lead.excess_funds_amount || 0,
      phone: lead.phone || null,
      phone_1: lead.phone_1 || null,
      phone_2: lead.phone_2 || null,
      email: lead.email || null,
      case_number: lead.case_number || null,
      sale_date: lead.sale_date || null,
      source_county: county || null,
      import_source: source,
      status: 'new',
      is_golden: false,
      is_super_golden: false,
    }));

    // Insert leads (upsert on property_address + owner_name to avoid duplicates)
    const { data: insertedLeads, error } = await supabase
      .from('maxsam_leads')
      .upsert(leadsToInsert, {
        onConflict: 'property_address,owner_name',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      console.error('[Bulk Import] Insert error:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    // Update county last scraped timestamp if county provided
    if (county) {
      await supabase
        .from('county_sources')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('county_name', county);
    }

    return NextResponse.json({
      success: true,
      imported: insertedLeads?.length || 0,
      total_submitted: leads.length,
      message: `Successfully imported ${insertedLeads?.length || 0} leads${county ? ` from ${county} County` : ''}`,
    });
  } catch (error) {
    console.error('[Bulk Import] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
