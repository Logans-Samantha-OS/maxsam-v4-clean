/**
 * Golden Lead Hunter API
 * Cross-references leads with Zillow using Browserless.io
 * Identifies golden leads based on listing status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const BROWSERLESS_URL = process.env.BROWSERLESS_URL || 'https://production-sfo.browserless.io';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

interface Lead {
  id: string;
  owner_name: string;
  property_address: string;
  city: string;
  state: string;
  zip_code: string;
  excess_funds_amount: number;
}

interface ZillowMatch {
  lead_id: string;
  zillow_url: string | null;
  listing_status: 'active' | 'pending' | 'sold' | 'off_market' | 'unknown';
  list_price: number | null;
  days_on_market: number | null;
  match_confidence: number;
  match_type: 'exact_address' | 'name_match' | 'partial' | 'fuzzy';
  property_type?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  search_query: string;
  search_type: 'address' | 'owner_name' | 'both';
}

/**
 * Scrape Zillow search results using Browserless
 */
async function scrapeZillow(searchQuery: string): Promise<string> {
  if (!BROWSERLESS_API_KEY) {
    throw new Error('BROWSERLESS_API_KEY not configured');
  }

  const encodedQuery = encodeURIComponent(searchQuery);
  const zillowUrl = `https://www.zillow.com/homes/${encodedQuery}_rb/`;

  const response = await fetch(`${BROWSERLESS_URL}/content?token=${BROWSERLESS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: zillowUrl,
      waitFor: 3000,
      gotoOptions: {
        waitUntil: 'networkidle2',
        timeout: 30000,
      },
      // Block images and other resources to speed up
      rejectResourceTypes: ['image', 'stylesheet', 'font'],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Browserless error:', response.status, errorText);
    throw new Error(`Browserless error: ${response.status}`);
  }

  return response.text();
}

/**
 * Parse Zillow HTML using Gemini AI
 */
async function parseZillowWithGemini(
  html: string,
  lead: Lead,
  searchType: 'address' | 'owner_name'
): Promise<Partial<ZillowMatch>> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const truncatedHtml = html.length > 80000 ? html.slice(0, 80000) + '...[truncated]' : html;

  const prompt = `Analyze this Zillow search results page and extract property listing information.

SEARCH CONTEXT:
- Owner Name: ${lead.owner_name}
- Property Address: ${lead.property_address}
- City: ${lead.city}, ${lead.state} ${lead.zip_code}
- Search Type: ${searchType}

Extract the BEST MATCHING property listing from the HTML. Look for:
1. Property address that matches "${lead.property_address}"
2. City/location matching "${lead.city}"
3. Any listing status indicators (For Sale, Pending, Sold, Off Market)

Return ONLY valid JSON with this exact structure:
{
  "found": true/false,
  "zillow_url": "full zillow URL or null",
  "listing_status": "active" | "pending" | "sold" | "off_market" | "unknown",
  "list_price": number or null,
  "days_on_market": number or null,
  "property_type": "single_family" | "condo" | "townhouse" | "multi_family" | null,
  "beds": number or null,
  "baths": number or null,
  "sqft": number or null,
  "match_confidence": 0-100 (how confident the match is),
  "match_type": "exact_address" | "name_match" | "partial" | "fuzzy",
  "match_reasoning": "brief explanation"
}

If no matching property found, return: {"found": false, "match_confidence": 0}

HTML Content:
${truncatedHtml}`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    return { match_confidence: 0, listing_status: 'unknown' };
  }

  // Clean and parse JSON
  let cleanedText = textContent.trim();
  if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
  if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
  if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);
  cleanedText = cleanedText.trim();

  try {
    const parsed = JSON.parse(cleanedText);

    if (!parsed.found) {
      return { match_confidence: 0, listing_status: 'unknown' };
    }

    return {
      zillow_url: parsed.zillow_url || null,
      listing_status: parsed.listing_status || 'unknown',
      list_price: parsed.list_price || null,
      days_on_market: parsed.days_on_market || null,
      match_confidence: parsed.match_confidence || 50,
      match_type: parsed.match_type || 'partial',
      property_type: parsed.property_type,
      beds: parsed.beds,
      baths: parsed.baths,
      sqft: parsed.sqft,
    };
  } catch {
    console.error('Failed to parse Gemini response:', cleanedText.slice(0, 500));
    return { match_confidence: 0, listing_status: 'unknown' };
  }
}

/**
 * Calculate golden score based on match quality
 */
function calculateGoldenScore(
  match: Partial<ZillowMatch>,
  excessAmount: number
): number {
  let score = 0;

  // Base score from match type
  if (match.match_type === 'exact_address') score += 70;
  else if (match.match_type === 'name_match') score += 50;
  else if (match.match_type === 'partial') score += 30;
  else score += 10;

  // Listing status bonus
  if (match.listing_status === 'active') score += 30;
  else if (match.listing_status === 'pending') score += 40; // URGENT
  else if (match.listing_status === 'sold') score += 15;

  // Confidence adjustment
  score = Math.round(score * (match.match_confidence || 50) / 100);

  // High excess funds bonus
  if (excessAmount >= 10000) score += 10;
  else if (excessAmount >= 5000) score += 5;

  return Math.min(score, 100);
}

/**
 * Calculate combined value (excess recovery + equity potential)
 */
function calculateCombinedValue(
  excessAmount: number,
  listPrice: number | null,
  estimatedEquity: number
): number {
  const excessFee = excessAmount * 0.25; // 25% of excess funds
  const equityFee = (listPrice || estimatedEquity || 0) * 0.10; // 10% of equity
  return excessFee + equityFee;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const {
      min_excess_amount = 2000,
      max_leads = 50,
      lead_ids,
    } = body as {
      min_excess_amount?: number;
      max_leads?: number;
      lead_ids?: string[];
    };

    // Create hunt run record
    const { data: huntRun, error: huntError } = await supabase
      .from('golden_hunt_runs')
      .insert({
        status: 'running',
        min_excess_amount,
        max_leads_to_scan: max_leads,
        triggered_by: 'api',
      })
      .select()
      .single();

    if (huntError) {
      console.error('Failed to create hunt run:', huntError);
    }

    const huntId = huntRun?.id;

    // Get leads to scan
    let query = supabase
      .from('maxsam_leads')
      .select('id, owner_name, property_address, city, state, zip_code, excess_funds_amount, estimated_equity')
      .or('golden_lead.is.null,golden_lead.eq.false')
      .gte('excess_funds_amount', min_excess_amount)
      .order('excess_funds_amount', { ascending: false })
      .limit(max_leads);

    if (lead_ids && lead_ids.length > 0) {
      query = supabase
        .from('maxsam_leads')
        .select('id, owner_name, property_address, city, state, zip_code, excess_funds_amount, estimated_equity')
        .in('id', lead_ids);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads to scan',
        scanned: 0,
        golden_found: 0,
      });
    }

    const results = {
      scanned: 0,
      matches_found: 0,
      golden_found: 0,
      errors: [] as string[],
      golden_leads: [] as { id: string; owner_name: string; golden_score: number; listing_status: string }[],
    };

    for (const lead of leads) {
      results.scanned++;

      try {
        // Build search query
        const addressQuery = `${lead.property_address} ${lead.city} ${lead.state}`;

        // Scrape Zillow
        let html: string;
        try {
          html = await scrapeZillow(addressQuery);
        } catch (scrapeError) {
          console.error(`Scrape failed for ${lead.id}:`, scrapeError);
          results.errors.push(`${lead.owner_name}: Scrape failed`);
          continue;
        }

        // Parse with Gemini
        const match = await parseZillowWithGemini(html, lead as Lead, 'address');

        // Calculate scores
        const goldenScore = calculateGoldenScore(match, lead.excess_funds_amount || 0);
        const combinedValue = calculateCombinedValue(
          lead.excess_funds_amount || 0,
          match.list_price || null,
          lead.estimated_equity || 0
        );

        // Save Zillow match
        const zillowMatchData = {
          lead_id: lead.id,
          zillow_url: match.zillow_url || null,
          listing_status: match.listing_status || 'unknown',
          list_price: match.list_price || null,
          days_on_market: match.days_on_market || null,
          match_confidence: match.match_confidence || 0,
          match_type: match.match_type || 'partial',
          search_query: addressQuery,
          search_type: 'address',
          property_type: match.property_type || null,
          beds: match.beds || null,
          baths: match.baths || null,
          sqft: match.sqft || null,
          scraped_at: new Date().toISOString(),
        };

        await supabase.from('zillow_matches').insert(zillowMatchData);

        if (match.match_confidence && match.match_confidence > 0) {
          results.matches_found++;
        }

        // Determine if golden lead (score >= 60 or active/pending listing with good match)
        const isGolden = goldenScore >= 60 ||
          (match.match_type === 'exact_address' && ['active', 'pending'].includes(match.listing_status || ''));

        // Update lead with Zillow data
        await supabase
          .from('maxsam_leads')
          .update({
            golden_lead: isGolden,
            is_golden_lead: isGolden,
            golden_score: goldenScore,
            zillow_status: match.listing_status || 'unknown',
            zillow_url: match.zillow_url || null,
            zillow_price: match.list_price || null,
            zillow_checked_at: new Date().toISOString(),
            combined_value: combinedValue,
            deal_type: isGolden ? 'golden' : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id);

        if (isGolden) {
          results.golden_found++;
          results.golden_leads.push({
            id: lead.id,
            owner_name: lead.owner_name || 'Unknown',
            golden_score: goldenScore,
            listing_status: match.listing_status || 'unknown',
          });
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.errors.push(`${lead.owner_name}: ${errorMsg}`);
        console.error(`Error processing lead ${lead.id}:`, err);
      }
    }

    // Update hunt run
    if (huntId) {
      await supabase
        .from('golden_hunt_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          leads_scanned: results.scanned,
          zillow_matches_found: results.matches_found,
          golden_leads_identified: results.golden_found,
          summary: results,
        })
        .eq('id', huntId);
    }

    // Log activity
    await supabase.from('activity_feed').insert({
      activity_type: 'golden_hunt',
      description: `Golden Hunt complete: ${results.golden_found} golden leads from ${results.scanned} scanned`,
      metadata: results,
    });

    return NextResponse.json({
      success: true,
      hunt_id: huntId,
      ...results,
      message: `Found ${results.golden_found} golden leads from ${results.scanned} scanned`,
    });
  } catch (error) {
    console.error('Golden hunt error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}

// GET endpoint to check status of a hunt
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const huntId = searchParams.get('hunt_id');

  try {
    if (huntId) {
      // Get specific hunt
      const { data, error } = await supabase
        .from('golden_hunt_runs')
        .select('*')
        .eq('id', huntId)
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, hunt: data });
    }

    // Get recent hunts
    const { data, error } = await supabase
      .from('golden_hunt_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return NextResponse.json({ success: true, hunts: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
