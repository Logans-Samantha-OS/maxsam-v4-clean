/**
 * UNIFIED LEAD INGESTION PIPELINE
 *
 * Full autonomous flow:
 * 1. PDF Upload/URL → Parse with Gemini
 * 2. Insert leads to Supabase (deduped)
 * 3. Score with Eleanor AI
 * 4. Flag golden leads (A+/A grade)
 * 5. Skip trace for phone numbers
 * 6. Queue for SAM outreach
 *
 * Triggers: Manual button, Cron, N8N webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateEleanorScore } from '@/lib/eleanor';

// Supabase client with service role for full access
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';

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

interface PipelineResult {
  success: boolean;
  stage: string;
  parsed: number;
  inserted: number;
  duplicates: number;
  scored: number;
  goldenLeads: number;
  skipTraced: number;
  queued: number;
  totalPotential: number;
  errors: string[];
  leadIds: string[];
}

/**
 * Parse PDF with Gemini Vision API
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
If you cannot find any records, return an empty array: []`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Content } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) return [];

  // Clean up response
  let cleanedText = textContent.trim()
    .replace(/^```json\n?/, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanedText);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((lead: Record<string, unknown>) => ({
        property_address: String(lead.property_address || '').trim(),
        owner_name: String(lead.owner_name || '').trim(),
        excess_funds_amount: Number(lead.excess_funds_amount) || 0,
        city: String(lead.city || 'Dallas').trim(),
        state: String(lead.state || 'TX').trim(),
        zip_code: lead.zip_code ? String(lead.zip_code).trim() : undefined,
        case_number: lead.case_number ? String(lead.case_number).trim() : undefined,
        sale_date: lead.sale_date ? String(lead.sale_date).trim() : undefined,
      }))
      .filter((lead: ParsedLead) =>
        lead.property_address && lead.owner_name && lead.excess_funds_amount > 0
      );
  } catch {
    throw new Error('Failed to parse Gemini response');
  }
}

/**
 * Download PDF from URL
 */
async function downloadPDF(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const mimeType = response.headers.get('content-type') || 'application/pdf';

  return { base64, mimeType };
}

/**
 * Check for duplicate leads
 */
async function isDuplicate(supabase: ReturnType<typeof getSupabase>, lead: ParsedLead): Promise<boolean> {
  // Check by case number first (most reliable)
  if (lead.case_number) {
    const { data } = await supabase
      .from('maxsam_leads')
      .select('id')
      .eq('case_number', lead.case_number)
      .limit(1);
    if (data && data.length > 0) return true;
  }

  // Check by address + owner name
  const { data } = await supabase
    .from('maxsam_leads')
    .select('id')
    .ilike('property_address', lead.property_address)
    .ilike('owner_name', lead.owner_name)
    .limit(1);

  return data && data.length > 0;
}

/**
 * Skip trace a lead (simplified - calls external API)
 */
async function skipTraceLead(lead: { id: string; owner_name: string; property_address: string; city: string; state: string }): Promise<{ phone?: string; email?: string }> {
  const apiKey = process.env.BATCH_SKIP_TRACING_API_KEY;

  if (!apiKey) {
    return {}; // Skip tracing not configured
  }

  try {
    const response = await fetch('https://api.batchskiptracing.com/api/v1/skip-trace', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        first_name: lead.owner_name.split(' ')[0] || '',
        last_name: lead.owner_name.split(' ').slice(1).join(' ') || lead.owner_name,
        address: lead.property_address,
        city: lead.city || 'Dallas',
        state: lead.state || 'TX'
      })
    });

    if (!response.ok) return {};

    const data = await response.json();
    return {
      phone: data.phone || data.phones?.[0] || data.mobile,
      email: data.email || data.emails?.[0]
    };
  } catch {
    return {};
  }
}

/**
 * Send Telegram notification
 */
async function notifyTelegram(message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch {
    console.error('Telegram notification failed');
  }
}

/**
 * Schedule ALEX skip trace webhook to run after a delay
 * Uses fire-and-forget fetch to the webhook endpoint
 */
function scheduleSkipTraceWebhook(delayMinutes: number): void {
  // Fire-and-forget: schedule the webhook call after delay
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  setTimeout(async () => {
    try {
      await fetch(`${baseUrl}/api/cron/alex-skip-trace-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes_ago: delayMinutes + 5, // Look back slightly longer than delay
          limit: 50,
          trigger: 'post_pipeline'
        })
      });
    } catch (err) {
      console.error('Failed to trigger skip trace webhook:', err);
    }
  }, delayMinutes * 60 * 1000);
}

/**
 * Main pipeline execution
 */
async function executePipeline(
  leads: ParsedLead[],
  options: { skipTrace?: boolean; queueOutreach?: boolean; source?: string }
): Promise<PipelineResult> {
  const supabase = getSupabase();
  const result: PipelineResult = {
    success: false,
    stage: 'init',
    parsed: leads.length,
    inserted: 0,
    duplicates: 0,
    scored: 0,
    goldenLeads: 0,
    skipTraced: 0,
    queued: 0,
    totalPotential: 0,
    errors: [],
    leadIds: []
  };

  try {
    // Stage 1: Insert leads (with deduplication)
    result.stage = 'inserting';

    for (const lead of leads) {
      const duplicate = await isDuplicate(supabase, lead);

      if (duplicate) {
        result.duplicates++;
        continue;
      }

      // Score with Eleanor
      const scoring = calculateEleanorScore({
        id: 'temp',
        excess_funds_amount: lead.excess_funds_amount,
        owner_name: lead.owner_name,
        zip_code: lead.zip_code,
        city: lead.city,
        property_address: lead.property_address
      });

      const leadData = {
        property_address: lead.property_address,
        owner_name: lead.owner_name,
        excess_funds_amount: lead.excess_funds_amount,
        city: lead.city || 'Dallas',
        state: lead.state || 'TX',
        zip_code: lead.zip_code,
        case_number: lead.case_number,
        sale_date: lead.sale_date,
        eleanor_score: scoring.eleanor_score,
        deal_grade: scoring.deal_grade,
        contact_priority: scoring.contact_priority,
        deal_type: scoring.deal_type,
        potential_revenue: scoring.potential_revenue,
        excess_fee: scoring.excess_fee,
        wholesale_fee: scoring.wholesale_fee,
        is_golden: scoring.deal_grade === 'A+' || scoring.deal_grade === 'A',
        status: 'scored',
        source: options.source || 'pipeline',
        scored_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const { data: inserted, error } = await supabase
        .from('maxsam_leads')
        .insert([leadData])
        .select('id')
        .single();

      if (error) {
        result.errors.push(`Insert failed for ${lead.owner_name}: ${error.message}`);
        continue;
      }

      result.inserted++;
      result.scored++;
      result.totalPotential += scoring.potential_revenue;
      result.leadIds.push(inserted.id);

      if (leadData.is_golden) {
        result.goldenLeads++;
      }
    }

    // Stage 2: Skip trace golden leads (if enabled and API configured)
    if (options.skipTrace && process.env.BATCH_SKIP_TRACING_API_KEY) {
      result.stage = 'skip_tracing';

      // Get golden leads that need phones
      const { data: goldenLeads } = await supabase
        .from('maxsam_leads')
        .select('id, owner_name, property_address, city, state')
        .in('id', result.leadIds)
        .eq('is_golden', true)
        .is('phone', null);

      if (goldenLeads) {
        for (const lead of goldenLeads) {
          const contact = await skipTraceLead(lead);

          if (contact.phone || contact.email) {
            await supabase
              .from('maxsam_leads')
              .update({ phone: contact.phone, email: contact.email })
              .eq('id', lead.id);
            result.skipTraced++;
          }

          // Rate limit
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // Stage 3: Queue for SAM outreach (if enabled)
    if (options.queueOutreach) {
      result.stage = 'queuing';

      // Get leads with phone numbers
      const { data: contactableLeads } = await supabase
        .from('maxsam_leads')
        .select('id')
        .in('id', result.leadIds)
        .not('phone', 'is', null)
        .eq('status', 'scored');

      if (contactableLeads && contactableLeads.length > 0) {
        // Add to execution queue for SAM
        const queueItems = contactableLeads.map(lead => ({
          lead_id: lead.id,
          action_type: 'initial_outreach',
          priority: 1,
          status: 'pending',
          created_at: new Date().toISOString()
        }));

        await supabase.from('execution_queue').insert(queueItems);
        result.queued = contactableLeads.length;
      }
    }

    result.stage = 'complete';
    result.success = true;

    // Send Telegram notification
    await notifyTelegram(
      `🚀 <b>PIPELINE COMPLETE</b>\n\n` +
      `📊 Parsed: ${result.parsed}\n` +
      `✅ Inserted: ${result.inserted}\n` +
      `🔄 Duplicates: ${result.duplicates}\n` +
      `⭐ Golden Leads: ${result.goldenLeads}\n` +
      `📱 Skip Traced: ${result.skipTraced}\n` +
      `📤 Queued for SAM: ${result.queued}\n` +
      `💰 Potential: $${result.totalPotential.toLocaleString()}`
    );

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

/**
 * POST /api/pipeline/ingest
 *
 * Accepts:
 * - FormData with PDF file
 * - JSON with { url: "pdf_url" }
 * - JSON with { data: "base64_content", name: "filename.pdf" }
 * - JSON with { leads: [...] } (pre-parsed leads)
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let leads: ParsedLead[] = [];
    let source = 'manual';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get('file') as File;
      source = (formData.get('source') as string) || 'upload';

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      leads = await parsePDFWithGemini(base64, file.type || 'application/pdf');

    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      source = body.source || 'api';

      if (body.leads && Array.isArray(body.leads)) {
        // Pre-parsed leads
        leads = body.leads;
      } else if (body.url) {
        // Download from URL
        const { base64, mimeType } = await downloadPDF(body.url);
        leads = await parsePDFWithGemini(base64, mimeType);
      } else if (body.data) {
        // Base64 content
        leads = await parsePDFWithGemini(body.data, body.type || 'application/pdf');
      } else {
        return NextResponse.json({ error: 'Provide file, url, data, or leads' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }

    if (leads.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No leads found in document',
        parsed: 0
      });
    }

    // Execute full pipeline
    const result = await executePipeline(leads, {
      skipTrace: true,
      queueOutreach: true,
      source
    });

    // Schedule ALEX skip trace webhook to run in 5 minutes
    // This handles any leads that didn't get skip traced during pipeline
    if (result.inserted > 0) {
      scheduleSkipTraceWebhook(5);
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Pipeline error:', error);
    const message = error instanceof Error ? error.message : 'Pipeline failed';
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

/**
 * GET /api/pipeline/ingest - Check pipeline status
 */
export async function GET() {
  const hasGemini = !!GEMINI_API_KEY;
  const hasSkipTrace = !!process.env.BATCH_SKIP_TRACING_API_KEY;
  const hasTelegram = !!process.env.TELEGRAM_BOT_TOKEN;

  return NextResponse.json({
    configured: {
      gemini: hasGemini,
      skipTrace: hasSkipTrace,
      telegram: hasTelegram
    },
    endpoints: {
      upload: 'POST with multipart/form-data (file)',
      url: 'POST with JSON { url: "pdf_url" }',
      base64: 'POST with JSON { data: "base64", name: "file.pdf" }',
      leads: 'POST with JSON { leads: [...] }'
    }
  });
}
