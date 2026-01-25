import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCountyRoutingInfo,
  formatCountyQuestion,
  listSupportedCounties,
} from '@/lib/alex/notebook-routing';

/**
 * ALEX Extract County API
 *
 * POST /api/alex/extract-county
 *
 * Queries NotebookLM for excess funds leads from a specific county
 * and parses the response into structured lead data.
 *
 * Request Body:
 * - county: string (required) - County name to extract leads from
 * - query_type: 'excess_funds' | 'foreclosures' | 'tax_sales' (default: 'excess_funds')
 * - sync_type: 'manual' | 'scheduled' | 'webhook' (default: 'manual')
 * - triggered_by: string (optional) - Source of the trigger
 *
 * Response:
 * - extraction_id: string - UUID of the extraction record
 * - county: string - County name
 * - notebook: string - Notebook used
 * - leads: array - Parsed lead objects
 * - raw_response: string - Raw response from knowledge base
 */

interface ExtractCountyRequest {
  county: string;
  query_type?: 'excess_funds' | 'foreclosures' | 'tax_sales';
  sync_type?: 'manual' | 'scheduled' | 'webhook';
  triggered_by?: string;
}

interface ParsedLead {
  property_address?: string;
  owner_name?: string;
  excess_funds_amount?: number;
  case_number?: string;
  sale_date?: string;
  county?: string;
  source_type?: string;
}

// Query templates for different data types
const QUERY_TEMPLATES: Record<string, string> = {
  excess_funds: `List all excess funds records for {county} County.
For each record, provide:
- Property address
- Owner name
- Excess funds amount (in dollars)
- Case number
- Sale date

Format each record clearly.`,

  foreclosures: `List all foreclosure properties for {county} County.
For each property, provide:
- Property address
- Owner name
- Auction date
- Opening bid amount
- Case number`,

  tax_sales: `List all tax sale properties for {county} County.
For each property, provide:
- Property address
- Owner name
- Tax amount owed
- Sale date
- Parcel ID`,
};

/**
 * Parse leads from raw text response
 * Attempts to extract structured data from the knowledge base response
 */
function parseLeadsFromResponse(rawResponse: string, county: string): ParsedLead[] {
  const leads: ParsedLead[] = [];

  // Split by common delimiters
  const sections = rawResponse.split(/(?:\n\n|\n---\n|\n\*\*\*\n)/);

  for (const section of sections) {
    const lead = parseLeadSection(section.trim(), county);
    if (lead && (lead.property_address || lead.owner_name)) {
      leads.push(lead);
    }
  }

  // If no structured leads found, try line-by-line parsing
  if (leads.length === 0) {
    const lines = rawResponse.split('\n');
    let currentLead: ParsedLead = { county, source_type: 'notebook_extraction' };

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Try to extract fields from each line
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

      // If we have enough data for a lead, save it and start new one
      if (currentLead.property_address && currentLead.owner_name) {
        leads.push({ ...currentLead });
        currentLead = { county, source_type: 'notebook_extraction' };
      }
    }

    // Don't forget the last lead
    if (currentLead.property_address || currentLead.owner_name) {
      leads.push(currentLead);
    }
  }

  return leads;
}

/**
 * Parse a single lead section
 */
function parseLeadSection(section: string, county: string): ParsedLead | null {
  if (!section || section.length < 10) return null;

  const lead: ParsedLead = {
    county,
    source_type: 'notebook_extraction',
  };

  // Property address patterns
  const addressPatterns = [
    /(?:property\s+)?address[:\s]+(.+?)(?:\n|$)/i,
    /(\d+\s+[A-Za-z\s]+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Blvd|Boulevard|Ln|Lane|Way|Ct|Court)[^,\n]*)/i,
  ];

  for (const pattern of addressPatterns) {
    const match = section.match(pattern);
    if (match) {
      lead.property_address = match[1].trim();
      break;
    }
  }

  // Owner name patterns
  const ownerPatterns = [
    /(?:owner|defendant|seller)[:\s]+(.+?)(?:\n|$)/i,
    /(?:name)[:\s]+(.+?)(?:\n|$)/i,
  ];

  for (const pattern of ownerPatterns) {
    const match = section.match(pattern);
    if (match) {
      lead.owner_name = match[1].trim();
      break;
    }
  }

  // Amount patterns
  const amountMatch = section.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  if (amountMatch) {
    lead.excess_funds_amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Case number patterns
  const casePatterns = [
    /(?:case|cause)[:\s#]*(\d{2,4}-\d+-\w+)/i,
    /(?:case|cause)[:\s#]*([A-Z]{2,}\d+)/i,
    /(?:case|cause)[:\s#]*(\d{4,})/i,
  ];

  for (const pattern of casePatterns) {
    const match = section.match(pattern);
    if (match) {
      lead.case_number = match[1].trim();
      break;
    }
  }

  // Sale date patterns
  const dateMatch = section.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  if (dateMatch) {
    lead.sale_date = dateMatch[1];
  }

  return lead;
}

/**
 * Query the ALEX Knowledge Base for leads
 */
async function queryKnowledgeBase(
  supabase: ReturnType<typeof createClient>,
  question: string,
  maxResults: number = 10
): Promise<{ answer: string; sources: unknown[] }> {
  try {
    const { data, error } = await supabase.rpc('search_knowledge_text', {
      search_query: question,
      max_results: maxResults,
    });

    if (error) {
      console.error('Knowledge search error:', error);
      throw new Error(`Knowledge search failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        answer: 'No records found in the knowledge base for this county.',
        sources: [],
      };
    }

    const answer = data
      .map((row: { content: string }) => row.content)
      .join('\n\n---\n\n');

    return { answer, sources: data };
  } catch (error) {
    console.error('ALEX Knowledge query error:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ExtractCountyRequest = await request.json();

    // Validate required fields
    if (!body.county || typeof body.county !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: county' },
        { status: 400 }
      );
    }

    const county = body.county.trim();
    const queryType = body.query_type || 'excess_funds';
    const syncType = body.sync_type || 'manual';
    const triggeredBy = body.triggered_by || 'api';

    // Get routing info
    const routingInfo = getCountyRoutingInfo(county);

    // Build the query
    const queryTemplate = QUERY_TEMPLATES[queryType] || QUERY_TEMPLATES.excess_funds;
    const question = formatCountyQuestion(county, queryTemplate.replace('{county}', county));

    console.log(`[ALEX Extract] Extracting ${queryType} for ${county} County`);
    console.log(`[ALEX Extract] Notebook: ${routingInfo.notebook}`);

    const supabase = createClient();

    // Query the knowledge base
    const { answer: rawResponse, sources } = await queryKnowledgeBase(
      supabase,
      question,
      10
    );

    // Parse leads from response
    const parsedLeads = parseLeadsFromResponse(rawResponse, county);

    console.log(`[ALEX Extract] Parsed ${parsedLeads.length} leads from response`);

    // Log the extraction to database
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
        import_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to log extraction:', insertError);
      // Continue anyway, just return the data
    }

    return NextResponse.json({
      extraction_id: extraction?.id || null,
      county,
      notebook: routingInfo.notebook,
      region: routingInfo.region,
      query_type: queryType,
      leads: parsedLeads,
      leads_count: parsedLeads.length,
      raw_response: rawResponse,
      sources: sources.length,
      sync_type: syncType,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Extract county error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alex/extract-county
 *
 * Returns extraction history and supported counties
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const county = searchParams.get('county');
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabase = createClient();

    // Build query
    let query = supabase
      .from('notebook_extractions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (county) {
      query = query.eq('county', county);
    }

    const { data: extractions, error } = await query;

    if (error) {
      console.error('Failed to fetch extractions:', error);
    }

    return NextResponse.json({
      extractions: extractions || [],
      supported_counties: listSupportedCounties(),
      query_types: ['excess_funds', 'foreclosures', 'tax_sales'],
      usage: {
        endpoint: 'POST /api/alex/extract-county',
        body: {
          county: 'string (required) - County name',
          query_type: 'string (optional) - excess_funds, foreclosures, tax_sales',
          sync_type: 'string (optional) - manual, scheduled, webhook',
          triggered_by: 'string (optional) - Source identifier',
        },
      },
    });
  } catch (error) {
    console.error('Get extractions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
