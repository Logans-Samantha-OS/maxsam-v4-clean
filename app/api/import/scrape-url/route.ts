/**
 * URL Scraper API - Scrapes Dallas County excess funds pages
 * Uses Browserless for headless browser rendering, Gemini for intelligent parsing
 */

import { NextRequest, NextResponse } from 'next/server';

interface ParsedLead {
  property_address: string;
  owner_name: string;
  excess_funds_amount: number;
  city?: string;
  state?: string;
  zip_code?: string;
  case_number?: string;
  sale_date?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const BROWSERLESS_URL = process.env.BROWSERLESS_URL || 'https://chrome.browserless.io';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';

/**
 * Fetch page content using Browserless headless Chrome
 */
async function fetchWithBrowserless(url: string): Promise<string> {
  if (!BROWSERLESS_API_KEY) {
    throw new Error('BROWSERLESS_API_KEY not configured');
  }

  const response = await fetch(`${BROWSERLESS_URL}/content?token=${BROWSERLESS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      waitFor: 3000, // Wait for dynamic content
      gotoOptions: {
        waitUntil: 'networkidle2',
        timeout: 30000,
      },
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
 * Simple fetch for static pages
 */
async function fetchSimple(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }

  return response.text();
}

/**
 * Parse HTML content using Gemini to extract lead data
 */
async function parseHtmlWithGemini(html: string, sourceUrl: string): Promise<ParsedLead[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Truncate HTML if too long (Gemini has token limits)
  const maxLength = 100000;
  const truncatedHtml = html.length > maxLength ? html.slice(0, maxLength) + '...[truncated]' : html;

  const prompt = `You are a data extraction specialist. Analyze this HTML from a Dallas County, Texas excess funds / surplus funds webpage.

Source URL: ${sourceUrl}

Extract ALL property records with excess/surplus funds. For each record, extract:
- property_address: The full street address
- owner_name: The owner's name (usually "Last, First" format)
- excess_funds_amount: The dollar amount (number only, no $ or commas)
- city: City name (default "Dallas" if not found)
- state: State (default "TX")
- zip_code: ZIP code if available
- case_number: Case/cause number if available
- sale_date: Sale date if available (format: YYYY-MM-DD)

Look for tables, lists, or structured data containing property addresses, owner names, and dollar amounts.

Return ONLY a valid JSON array. No markdown, no explanation.
If no records found, return: []

Example: [{"property_address":"123 Main St","owner_name":"Smith, John","excess_funds_amount":45000,"city":"Dallas","state":"TX"}]

HTML Content:
${truncatedHtml}`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    console.error('No text content in Gemini response');
    return [];
  }

  // Clean up response
  let cleanedText = textContent.trim();
  if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
  if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
  if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);
  cleanedText = cleanedText.trim();

  try {
    const parsed = JSON.parse(cleanedText);

    if (!Array.isArray(parsed)) {
      console.error('Gemini response is not an array');
      return [];
    }

    return parsed.map((lead: Record<string, unknown>) => ({
      property_address: String(lead.property_address || '').trim(),
      owner_name: String(lead.owner_name || '').trim(),
      excess_funds_amount: Number(lead.excess_funds_amount) || 0,
      city: String(lead.city || 'Dallas').trim(),
      state: String(lead.state || 'TX').trim(),
      zip_code: lead.zip_code ? String(lead.zip_code).trim() : undefined,
      case_number: lead.case_number ? String(lead.case_number).trim() : undefined,
      sale_date: lead.sale_date ? String(lead.sale_date).trim() : undefined,
    })).filter((lead: ParsedLead) =>
      lead.property_address &&
      lead.owner_name &&
      lead.excess_funds_amount > 0
    );
  } catch (parseError) {
    console.error('Failed to parse Gemini JSON:', cleanedText.slice(0, 500));
    throw new Error('Failed to parse extraction results');
  }
}

/**
 * Fallback: Use N8N webhook for URL scraping
 */
async function scrapeWithN8N(url: string): Promise<ParsedLead[]> {
  const response = await fetch('https://skooki.app.n8n.cloud/webhook/alex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      source: 'url_scraper_api',
      action: 'scrape_url',
    }),
  });

  if (!response.ok) {
    throw new Error('N8N scraping failed');
  }

  const data = await response.json();
  return data.leads || [];
}

/**
 * Validate URL is a legitimate government/county source
 */
function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Allow government and county domains
    const allowedPatterns = [
      '.gov',
      '.us',
      'county',
      'dallas',
      'tarrant',
      'harris',
      'bexar',
      'travis',
      'collin',
      'denton',
      'localhost',
    ];

    return allowedPatterns.some(pattern => hostname.includes(pattern));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'No URL provided' },
        { status: 400 }
      );
    }

    if (!validateUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid URL - must be a government or county website' },
        { status: 400 }
      );
    }

    let leads: ParsedLead[];
    let source: string;

    // Try scraping pipeline
    if (BROWSERLESS_API_KEY && GEMINI_API_KEY) {
      try {
        // Use Browserless for JavaScript-rendered pages
        console.log(`Scraping ${url} with Browserless...`);
        const html = await fetchWithBrowserless(url);
        console.log(`Got ${html.length} bytes, parsing with Gemini...`);
        leads = await parseHtmlWithGemini(html, url);
        source = 'browserless+gemini';
      } catch (browserlessError) {
        console.error('Browserless failed, trying simple fetch:', browserlessError);

        try {
          // Fallback to simple fetch for static pages
          const html = await fetchSimple(url);
          leads = await parseHtmlWithGemini(html, url);
          source = 'fetch+gemini';
        } catch (fetchError) {
          console.error('Simple fetch failed, trying N8N:', fetchError);
          leads = await scrapeWithN8N(url);
          source = 'n8n';
        }
      }
    } else if (GEMINI_API_KEY) {
      // No Browserless, try simple fetch
      try {
        const html = await fetchSimple(url);
        leads = await parseHtmlWithGemini(html, url);
        source = 'fetch+gemini';
      } catch {
        leads = await scrapeWithN8N(url);
        source = 'n8n';
      }
    } else {
      // No keys configured, use N8N
      leads = await scrapeWithN8N(url);
      source = 'n8n';
    }

    console.log(`Extracted ${leads.length} leads from ${url} using ${source}`);

    return NextResponse.json({
      success: true,
      leads,
      count: leads.length,
      source,
      url,
    });
  } catch (error) {
    console.error('URL scrape error:', error);
    const message = error instanceof Error ? error.message : 'Failed to scrape URL';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
