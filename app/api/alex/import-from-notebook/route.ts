import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * ALEX Import From Notebook API
 *
 * POST /api/alex/import-from-notebook
 *
 * Imports parsed leads from a notebook extraction into the maxsam_leads table.
 * Handles deduplication based on property_address + owner_name.
 *
 * Request Body:
 * - extraction_id: string (optional) - UUID of extraction to import
 * - leads: array (optional) - Direct array of leads to import
 * - county: string (required if leads provided directly)
 *
 * Response:
 * - imported: number - Count of new leads imported
 * - updated: number - Count of existing leads updated
 * - skipped: number - Count of leads skipped (duplicates or invalid)
 * - errors: array - Any errors encountered
 */

interface Lead {
  property_address?: string;
  owner_name?: string;
  excess_funds_amount?: number;
  case_number?: string;
  sale_date?: string;
  county?: string;
  source_type?: string;
}

interface ImportRequest {
  extraction_id?: string;
  leads?: Lead[];
  county?: string;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Import a single lead to maxsam_leads with upsert logic
 */
async function importLead(
  supabase: ReturnType<typeof createClient>,
  lead: Lead,
  sourceId?: string
): Promise<{ action: 'imported' | 'updated' | 'skipped'; error?: string }> {
  // Validate required fields
  if (!lead.property_address && !lead.owner_name) {
    return { action: 'skipped', error: 'Lead missing both property_address and owner_name' };
  }

  try {
    // Check for existing lead
    let existingQuery = supabase
      .from('maxsam_leads')
      .select('id, property_address, owner_name')
      .limit(1);

    if (lead.property_address) {
      existingQuery = existingQuery.ilike('property_address', lead.property_address);
    }
    if (lead.owner_name) {
      existingQuery = existingQuery.ilike('owner_name', lead.owner_name);
    }

    const { data: existing } = await existingQuery.single();

    if (existing) {
      // Update existing lead with new data (if any new fields)
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (lead.excess_funds_amount && lead.excess_funds_amount > 0) {
        updateData.excess_funds_amount = lead.excess_funds_amount;
      }
      if (lead.case_number) {
        updateData.case_number = lead.case_number;
      }
      if (lead.sale_date) {
        updateData.sale_date = lead.sale_date;
      }
      if (sourceId) {
        updateData.source_id = sourceId;
      }

      const { error: updateError } = await supabase
        .from('maxsam_leads')
        .update(updateData)
        .eq('id', existing.id);

      if (updateError) {
        return { action: 'skipped', error: updateError.message };
      }

      return { action: 'updated' };
    }

    // Insert new lead
    const insertData: Record<string, unknown> = {
      property_address: lead.property_address || null,
      owner_name: lead.owner_name || null,
      excess_funds_amount: lead.excess_funds_amount || null,
      case_number: lead.case_number || null,
      sale_date: lead.sale_date ? new Date(lead.sale_date).toISOString() : null,
      county: lead.county || null,
      state: 'TX', // Default to Texas
      source_type: lead.source_type || 'notebook_extraction',
      source_id: sourceId || null,
      status: 'new',
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('maxsam_leads')
      .insert(insertData);

    if (insertError) {
      return { action: 'skipped', error: insertError.message };
    }

    return { action: 'imported' };
  } catch (error) {
    return {
      action: 'skipped',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportRequest = await request.json();

    const supabase = createClient();
    let leads: Lead[] = [];
    let extractionId: string | undefined;
    let county: string | undefined;

    // Get leads from extraction or direct input
    if (body.extraction_id) {
      extractionId = body.extraction_id;

      // Fetch extraction from database
      const { data: extraction, error } = await supabase
        .from('notebook_extractions')
        .select('*')
        .eq('id', extractionId)
        .single();

      if (error || !extraction) {
        return NextResponse.json(
          { error: 'Extraction not found' },
          { status: 404 }
        );
      }

      leads = extraction.parsed_leads || [];
      county = extraction.county;

      // Update extraction status to importing
      await supabase
        .from('notebook_extractions')
        .update({ import_status: 'importing' })
        .eq('id', extractionId);
    } else if (body.leads && Array.isArray(body.leads)) {
      leads = body.leads;
      county = body.county;
    } else {
      return NextResponse.json(
        { error: 'Either extraction_id or leads array is required' },
        { status: 400 }
      );
    }

    if (leads.length === 0) {
      return NextResponse.json({
        extraction_id: extractionId,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        message: 'No leads to import',
      });
    }

    console.log(`[ALEX Import] Importing ${leads.length} leads from ${county || 'unknown'} county`);

    // Import each lead
    const result: ImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (const lead of leads) {
      // Add county if not present
      if (!lead.county && county) {
        lead.county = county;
      }

      const { action, error } = await importLead(supabase, lead, extractionId);

      if (action === 'imported') {
        result.imported++;
      } else if (action === 'updated') {
        result.updated++;
      } else {
        result.skipped++;
        if (error) {
          result.errors.push(error);
        }
      }
    }

    // Update extraction record if we have one
    if (extractionId) {
      const updateData = {
        import_status: result.errors.length > 0 && result.imported === 0 ? 'failed' : 'completed',
        leads_imported: result.imported,
        leads_updated: result.updated,
        leads_skipped: result.skipped,
        import_error: result.errors.length > 0 ? result.errors.join('; ') : null,
        imported_at: new Date().toISOString(),
      };

      await supabase
        .from('notebook_extractions')
        .update(updateData)
        .eq('id', extractionId);
    }

    console.log(`[ALEX Import] Complete: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped`);

    return NextResponse.json({
      extraction_id: extractionId,
      county,
      ...result,
      message: `Successfully processed ${leads.length} leads`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alex/import-from-notebook
 *
 * Returns import statistics and recent imports
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const supabase = createClient();

    // Get recent extractions with import status
    const { data: recentImports, error } = await supabase
      .from('notebook_extractions')
      .select('id, county, notebook_name, leads_count, leads_imported, leads_updated, leads_skipped, import_status, imported_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch import history:', error);
    }

    // Get aggregate stats
    const { data: stats } = await supabase
      .from('notebook_extractions')
      .select('leads_imported, leads_updated, leads_skipped')
      .not('leads_imported', 'is', null);

    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    if (stats) {
      for (const row of stats) {
        totalImported += row.leads_imported || 0;
        totalUpdated += row.leads_updated || 0;
        totalSkipped += row.leads_skipped || 0;
      }
    }

    return NextResponse.json({
      recent_imports: recentImports || [],
      stats: {
        total_imported: totalImported,
        total_updated: totalUpdated,
        total_skipped: totalSkipped,
        total_processed: totalImported + totalUpdated + totalSkipped,
      },
      usage: {
        endpoint: 'POST /api/alex/import-from-notebook',
        body: {
          extraction_id: 'string (optional) - UUID of extraction to import',
          leads: 'array (optional) - Direct array of leads to import',
          county: 'string (required if leads provided directly)',
        },
      },
    });
  } catch (error) {
    console.error('Get import stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
