import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listSupportedCounties, getCountyRoutingInfo } from '@/lib/alex/notebook-routing';

/**
 * ALEX Notebook Sync API
 *
 * POST /api/alex/notebook-sync
 *
 * Orchestrates full sync across multiple counties:
 * 1. Extracts leads from each county's NotebookLM
 * 2. Parses leads from raw responses
 * 3. Imports parsed leads to maxsam_leads
 * 4. Returns consolidated results
 *
 * Request Body:
 * - counties: string[] (optional) - List of counties to sync, defaults to all supported
 * - query_type: 'excess_funds' | 'foreclosures' | 'tax_sales' (default: 'excess_funds')
 * - sync_type: 'manual' | 'scheduled' | 'webhook' (default: 'manual')
 * - triggered_by: string (optional) - Source of the trigger
 * - auto_import: boolean (default: true) - Automatically import extracted leads
 *
 * Response:
 * - sync_id: string - Unique identifier for this sync run
 * - counties_processed: number
 * - total_extracted: number
 * - total_imported: number
 * - total_updated: number
 * - total_skipped: number
 * - results: array - Per-county results
 */

interface SyncRequest {
  counties?: string[];
  query_type?: 'excess_funds' | 'foreclosures' | 'tax_sales';
  sync_type?: 'manual' | 'scheduled' | 'webhook';
  triggered_by?: string;
  auto_import?: boolean;
}

interface CountySyncResult {
  county: string;
  notebook: string;
  region: string;
  extraction_id?: string;
  leads_extracted: number;
  leads_imported: number;
  leads_updated: number;
  leads_skipped: number;
  status: 'success' | 'error';
  error?: string;
}

// Query templates for different data types
const QUERY_TEMPLATES: Record<string, string> = {
  excess_funds: `List all excess funds records.
For each record, provide:
- Property address
- Owner name
- Excess funds amount (in dollars)
- Case number
- Sale date`,

  foreclosures: `List all foreclosure properties.
For each property, provide:
- Property address
- Owner name
- Auction date
- Opening bid amount
- Case number`,

  tax_sales: `List all tax sale properties.
For each property, provide:
- Property address
- Owner name
- Tax amount owed
- Sale date
- Parcel ID`,
};

/**
 * Query the ALEX Knowledge Base
 */
async function queryKnowledgeBase(
  supabase: ReturnType<typeof createClient>,
  question: string,
  maxResults: number = 10
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('search_knowledge_text', {
      search_query: question,
      max_results: maxResults,
    });

    if (error) {
      throw new Error(`Knowledge search failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return 'No records found in the knowledge base.';
    }

    return data
      .map((row: { content: string }) => row.content)
      .join('\n\n---\n\n');
  } catch (error) {
    throw error;
  }
}

/**
 * Parse leads from raw text response
 */
function parseLeadsFromResponse(rawResponse: string, county: string): Record<string, unknown>[] {
  const leads: Record<string, unknown>[] = [];
  const lines = rawResponse.split('\n');
  let currentLead: Record<string, unknown> = { county, source_type: 'notebook_extraction' };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const addressMatch = trimmedLine.match(/(?:address|property)[:\s]+(.+)/i);
    const ownerMatch = trimmedLine.match(/(?:owner|name)[:\s]+(.+)/i);
    const amountMatch = trimmedLine.match(/(?:amount|funds|excess)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
    const caseMatch = trimmedLine.match(/(?:case|cause)[:\s#]*(\w+-?\d+[-\w]*)/i);
    const dateMatch = trimmedLine.match(/(?:date|sale)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);

    if (addressMatch) currentLead.property_address = addressMatch[1].trim();
    if (ownerMatch) currentLead.owner_name = ownerMatch[1].trim();
    if (amountMatch) currentLead.excess_funds_amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (caseMatch) currentLead.case_number = caseMatch[1].trim();
    if (dateMatch) currentLead.sale_date = dateMatch[1].trim();

    if (currentLead.property_address && currentLead.owner_name) {
      leads.push({ ...currentLead });
      currentLead = { county, source_type: 'notebook_extraction' };
    }
  }

  if (currentLead.property_address || currentLead.owner_name) {
    leads.push(currentLead);
  }

  return leads;
}

/**
 * Import leads to maxsam_leads
 */
async function importLeads(
  supabase: ReturnType<typeof createClient>,
  leads: Record<string, unknown>[],
  extractionId: string
): Promise<{ imported: number; updated: number; skipped: number }> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (!lead.property_address && !lead.owner_name) {
      skipped++;
      continue;
    }

    try {
      // Check for existing
      let existingQuery = supabase
        .from('maxsam_leads')
        .select('id')
        .limit(1);

      if (lead.property_address) {
        existingQuery = existingQuery.ilike('property_address', lead.property_address as string);
      }
      if (lead.owner_name) {
        existingQuery = existingQuery.ilike('owner_name', lead.owner_name as string);
      }

      const { data: existing } = await existingQuery.single();

      if (existing) {
        // Update existing
        await supabase
          .from('maxsam_leads')
          .update({
            excess_funds_amount: lead.excess_funds_amount || undefined,
            case_number: lead.case_number || undefined,
            source_id: extractionId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        updated++;
      } else {
        // Insert new
        await supabase
          .from('maxsam_leads')
          .insert({
            property_address: lead.property_address || null,
            owner_name: lead.owner_name || null,
            excess_funds_amount: lead.excess_funds_amount || null,
            case_number: lead.case_number || null,
            sale_date: lead.sale_date ? new Date(lead.sale_date as string).toISOString() : null,
            county: lead.county || null,
            state: 'TX',
            source_type: 'notebook_extraction',
            source_id: extractionId,
            status: 'new',
            created_at: new Date().toISOString(),
          });
        imported++;
      }
    } catch {
      skipped++;
    }
  }

  return { imported, updated, skipped };
}

/**
 * Sync a single county
 */
async function syncCounty(
  supabase: ReturnType<typeof createClient>,
  county: string,
  queryType: string,
  syncType: string,
  triggeredBy: string,
  autoImport: boolean
): Promise<CountySyncResult> {
  const routingInfo = getCountyRoutingInfo(county);

  try {
    // Build the query
    const queryTemplate = QUERY_TEMPLATES[queryType] || QUERY_TEMPLATES.excess_funds;
    const question = `${county} County: ${queryTemplate}`;

    // Query knowledge base
    const rawResponse = await queryKnowledgeBase(supabase, question, 10);

    // Parse leads
    const parsedLeads = parseLeadsFromResponse(rawResponse, county);

    // Log extraction
    const { data: extraction, error: insertError } = await supabase
      .from('notebook_extractions')
      .insert({
        notebook_name: routingInfo.notebook,
        county: county,
        query: question,
        raw_response: rawResponse,
        parsed_leads: parsedLeads,
        leads_count: parsedLeads.length,
        sync_type: syncType,
        triggered_by: triggeredBy,
        import_status: autoImport ? 'importing' : 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error(`Failed to log extraction for ${county}:`, insertError);
    }

    const result: CountySyncResult = {
      county,
      notebook: routingInfo.notebook,
      region: routingInfo.region,
      extraction_id: extraction?.id,
      leads_extracted: parsedLeads.length,
      leads_imported: 0,
      leads_updated: 0,
      leads_skipped: 0,
      status: 'success',
    };

    // Import if auto_import is enabled
    if (autoImport && parsedLeads.length > 0 && extraction?.id) {
      const importResult = await importLeads(supabase, parsedLeads, extraction.id);
      result.leads_imported = importResult.imported;
      result.leads_updated = importResult.updated;
      result.leads_skipped = importResult.skipped;

      // Update extraction record
      await supabase
        .from('notebook_extractions')
        .update({
          import_status: 'completed',
          leads_imported: importResult.imported,
          leads_updated: importResult.updated,
          leads_skipped: importResult.skipped,
          imported_at: new Date().toISOString(),
        })
        .eq('id', extraction.id);
    }

    return result;
  } catch (error) {
    return {
      county,
      notebook: routingInfo.notebook,
      region: routingInfo.region,
      leads_extracted: 0,
      leads_imported: 0,
      leads_updated: 0,
      leads_skipped: 0,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SyncRequest = await request.json();

    const counties = body.counties || listSupportedCounties();
    const queryType = body.query_type || 'excess_funds';
    const syncType = body.sync_type || 'manual';
    const triggeredBy = body.triggered_by || 'api';
    const autoImport = body.auto_import !== false; // Default true

    console.log(`[ALEX Sync] Starting sync for ${counties.length} counties`);
    console.log(`[ALEX Sync] Query type: ${queryType}, Auto-import: ${autoImport}`);

    const supabase = createClient();
    const syncId = crypto.randomUUID();
    const results: CountySyncResult[] = [];

    // Process each county
    for (const county of counties) {
      console.log(`[ALEX Sync] Processing ${county} County...`);
      const result = await syncCounty(
        supabase,
        county,
        queryType,
        syncType,
        triggeredBy,
        autoImport
      );
      results.push(result);

      // Small delay between counties to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Calculate totals
    const totals = results.reduce(
      (acc, r) => ({
        extracted: acc.extracted + r.leads_extracted,
        imported: acc.imported + r.leads_imported,
        updated: acc.updated + r.leads_updated,
        skipped: acc.skipped + r.leads_skipped,
        success: acc.success + (r.status === 'success' ? 1 : 0),
        errors: acc.errors + (r.status === 'error' ? 1 : 0),
      }),
      { extracted: 0, imported: 0, updated: 0, skipped: 0, success: 0, errors: 0 }
    );

    console.log(`[ALEX Sync] Complete: ${totals.success}/${counties.length} counties, ${totals.extracted} leads extracted, ${totals.imported} imported`);

    return NextResponse.json({
      sync_id: syncId,
      query_type: queryType,
      sync_type: syncType,
      auto_import: autoImport,
      counties_processed: counties.length,
      counties_successful: totals.success,
      counties_failed: totals.errors,
      total_extracted: totals.extracted,
      total_imported: totals.imported,
      total_updated: totals.updated,
      total_skipped: totals.skipped,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Notebook sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alex/notebook-sync
 *
 * Returns sync history and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const supabase = createClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get extraction stats grouped by county
    const { data: countyStats } = await supabase
      .from('notebook_extraction_stats')
      .select('*');

    // Get recent extractions
    const { data: recentExtractions } = await supabase
      .from('notebook_extractions')
      .select('*')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Get sync summary for the period
    const { data: syncSummary } = await supabase
      .from('notebook_extractions')
      .select('leads_count, leads_imported, leads_updated, leads_skipped, import_status')
      .gte('created_at', cutoffDate.toISOString());

    let periodTotals = {
      extractions: 0,
      leads_extracted: 0,
      leads_imported: 0,
      leads_updated: 0,
      leads_skipped: 0,
      successful: 0,
      failed: 0,
    };

    if (syncSummary) {
      periodTotals = syncSummary.reduce(
        (acc, row) => ({
          extractions: acc.extractions + 1,
          leads_extracted: acc.leads_extracted + (row.leads_count || 0),
          leads_imported: acc.leads_imported + (row.leads_imported || 0),
          leads_updated: acc.leads_updated + (row.leads_updated || 0),
          leads_skipped: acc.leads_skipped + (row.leads_skipped || 0),
          successful: acc.successful + (row.import_status === 'completed' ? 1 : 0),
          failed: acc.failed + (row.import_status === 'failed' ? 1 : 0),
        }),
        periodTotals
      );
    }

    return NextResponse.json({
      period_days: days,
      period_stats: periodTotals,
      county_stats: countyStats || [],
      recent_extractions: recentExtractions || [],
      supported_counties: listSupportedCounties(),
      usage: {
        endpoint: 'POST /api/alex/notebook-sync',
        body: {
          counties: 'string[] (optional) - List of counties to sync',
          query_type: 'string (optional) - excess_funds, foreclosures, tax_sales',
          sync_type: 'string (optional) - manual, scheduled, webhook',
          triggered_by: 'string (optional) - Source identifier',
          auto_import: 'boolean (default: true) - Auto-import extracted leads',
        },
      },
    });
  } catch (error) {
    console.error('Get sync stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
