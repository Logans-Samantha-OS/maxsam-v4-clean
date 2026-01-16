/**
 * PDF Parser API - Extracts lead data from Dallas County excess funds PDFs
 * Uses Google Gemini Vision API for intelligent document parsing
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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';

/**
 * Parse PDF content using Gemini Vision API
 */
async function parsePDFWithGemini(base64Content: string, mimeType: string): Promise<ParsedLead[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = `You are a document parser specializing in Dallas County, Texas excess funds / surplus funds lists from tax sales and foreclosures.

Analyze this PDF document and extract ALL property records you can find. For each record, extract:
- property_address: The full street address of the property
- owner_name: The owner's name (usually in "Last, First" format)
- excess_funds_amount: The dollar amount of excess/surplus funds (number only, no $ or commas)
- city: City name (default to "Dallas" if not specified)
- state: State (default to "TX")
- zip_code: ZIP code if available
- case_number: Case number, cause number, or reference number if available
- sale_date: Sale date if available (format: YYYY-MM-DD)

Return ONLY a valid JSON array of objects with these fields. No markdown, no explanation, just the JSON array.
If you cannot find any records, return an empty array: []

Example output format:
[{"property_address":"123 Main St","owner_name":"Smith, John","excess_funds_amount":45000,"city":"Dallas","state":"TX","zip_code":"75201","case_number":"TX-2024-001","sale_date":"2024-01-15"}]`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Content,
            },
          },
        ],
      },
    ],
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

  // Clean up the response - remove markdown code blocks if present
  let cleanedText = textContent.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.slice(7);
  }
  if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.slice(3);
  }
  if (cleanedText.endsWith('```')) {
    cleanedText = cleanedText.slice(0, -3);
  }
  cleanedText = cleanedText.trim();

  try {
    const parsed = JSON.parse(cleanedText);

    if (!Array.isArray(parsed)) {
      console.error('Gemini response is not an array:', cleanedText);
      return [];
    }

    // Validate and normalize each lead
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
    console.error('Failed to parse Gemini JSON response:', cleanedText);
    throw new Error('Failed to parse document extraction results');
  }
}

/**
 * Fallback: Use N8N webhook for PDF parsing if Gemini fails
 */
async function parsePDFWithN8N(base64Content: string, fileName: string): Promise<ParsedLead[]> {
  const response = await fetch('https://skooki.app.n8n.cloud/webhook/alex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files: [{
        name: fileName,
        type: 'application/pdf',
        data: base64Content,
      }],
      source: 'pdf_parser_api',
      parse_only: true,
    }),
  });

  if (!response.ok) {
    throw new Error('N8N parsing failed');
  }

  const data = await response.json();
  return data.leads || [];
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let base64Content: string;
    let fileName = 'document.pdf';
    let mimeType = 'application/pdf';

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData upload
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json(
          { error: 'File must be a PDF' },
          { status: 400 }
        );
      }

      fileName = file.name;
      mimeType = file.type || 'application/pdf';

      const buffer = await file.arrayBuffer();
      base64Content = Buffer.from(buffer).toString('base64');
    } else if (contentType.includes('application/json')) {
      // Handle JSON with base64 data
      const body = await request.json();

      if (!body.data) {
        return NextResponse.json(
          { error: 'No file data provided' },
          { status: 400 }
        );
      }

      base64Content = body.data;
      fileName = body.name || 'document.pdf';
      mimeType = body.type || 'application/pdf';
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    let leads: ParsedLead[];

    // Try Gemini first, fallback to N8N
    if (GEMINI_API_KEY) {
      try {
        leads = await parsePDFWithGemini(base64Content, mimeType);
        console.log(`Gemini extracted ${leads.length} leads from ${fileName}`);
      } catch (geminiError) {
        console.error('Gemini parsing failed, trying N8N fallback:', geminiError);
        leads = await parsePDFWithN8N(base64Content, fileName);
      }
    } else {
      // No Gemini key, use N8N directly
      leads = await parsePDFWithN8N(base64Content, fileName);
    }

    return NextResponse.json({
      success: true,
      leads,
      count: leads.length,
      source: GEMINI_API_KEY ? 'gemini' : 'n8n',
    });
  } catch (error) {
    console.error('PDF parse error:', error);
    const message = error instanceof Error ? error.message : 'Failed to parse PDF';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
