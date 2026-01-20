import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isDocuSignConfigured } from '@/lib/docusign';
import { isTwilioConfigured } from '@/lib/twilio';
import { isStripeConfigured } from '@/lib/stripe';
import { isTelegramConfigured } from '@/lib/telegram';
import { isSkipTracingConfigured } from '@/lib/skip-tracing';

/**
 * GET /api/settings - Get all settings and integration status
 */
export async function GET() {
  try {
    const supabase = createClient();

    // Get system config
    const { data: configs } = await supabase
      .from('system_config')
      .select('*');

    const config = Object.fromEntries(
      (configs || []).map(c => [c.key, c.value])
    );

    // Check integration status
    const integrations = {
      supabase: {
        configured: true, // If we got here, Supabase works
        status: 'connected'
      },
      docusign: {
        configured: isDocuSignConfigured(),
        status: isDocuSignConfigured() ? 'connected' : 'not_configured',
        account_id: process.env.DOCUSIGN_ACCOUNT_ID ? '***' + process.env.DOCUSIGN_ACCOUNT_ID.slice(-4) : null
      },
      twilio: {
        configured: isTwilioConfigured(),
        status: isTwilioConfigured() ? 'connected' : 'not_configured',
        phone: process.env.TWILIO_PHONE_NUMBER || null
      },
      stripe: {
        configured: isStripeConfigured(),
        status: isStripeConfigured() ? 'connected' : 'not_configured'
      },
      telegram: {
        configured: isTelegramConfigured(),
        status: isTelegramConfigured() ? 'connected' : 'not_configured'
      },
      skip_tracing: {
        configured: isSkipTracingConfigured(),
        status: isSkipTracingConfigured() ? 'connected' : 'not_configured'
      },
      elevenlabs: {
        configured: !!process.env.ELEVENLABS_API_KEY,
        status: process.env.ELEVENLABS_API_KEY ? 'connected' : 'not_configured'
      }
    };

    return NextResponse.json({
      config: {
        legal_entity_name: config.legal_entity_name || 'Logan Toups',
        business_address: config.business_address || 'Richardson, TX',
        signer_title: config.signer_title || 'Real Estate Investor',
        excess_funds_fee_percent: config.excess_funds_fee_percent || '25',
        wholesale_fee_percent: config.wholesale_fee_percent || '10',
        owner_split_percent: config.owner_split_percent || '100',
        partner_split_percent: config.partner_split_percent || '0',
        partner_name: config.partner_name || '',
        partner_email: config.partner_email || '',
        dallas_county_pdf_url: config.dallas_county_pdf_url || '',
        outreach_enabled: config.outreach_enabled === 'true',
        max_daily_sms: config.max_daily_sms || '100',
        max_contact_attempts: config.max_contact_attempts || '5'
      },
      integrations
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/settings - Update a single setting (for CEO Dashboard)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
    }

    const allowedKeys = [
      'autonomy_level',
      'ralph_enabled',
      'outreach_enabled',
      'max_daily_sms',
      'max_contact_attempts'
    ];

    if (!allowedKeys.includes(key)) {
      return NextResponse.json({ error: `Key '${key}' is not allowed` }, { status: 400 });
    }

    await supabase
      .from('system_config')
      .upsert({
        key,
        value: String(value),
        updated_at: new Date().toISOString(),
        updated_by: 'ceo_dashboard'
      }, { onConflict: 'key' });

    return NextResponse.json({
      success: true,
      key,
      value: String(value)
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * PUT /api/settings - Update settings
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    // Validate and update each setting
    const allowedKeys = [
      'legal_entity_name',
      'business_address',
      'signer_title',
      'excess_funds_fee_percent',
      'wholesale_fee_percent',
      'owner_split_percent',
      'partner_split_percent',
      'partner_name',
      'partner_email',
      'dallas_county_pdf_url',
      'outreach_enabled',
      'max_daily_sms',
      'max_contact_attempts',
      'autonomy_level',
      'ralph_enabled'
    ];

    const updates: Array<{ key: string; value: string }> = [];

    for (const [key, value] of Object.entries(body)) {
      if (allowedKeys.includes(key)) {
        updates.push({
          key,
          value: String(value)
        });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid settings to update' }, { status: 400 });
    }

    // Upsert each setting
    for (const update of updates) {
      await supabase
        .from('system_config')
        .upsert({
          key: update.key,
          value: update.value,
          updated_at: new Date().toISOString(),
          updated_by: 'api'
        }, { onConflict: 'key' });
    }

    return NextResponse.json({
      success: true,
      updated: updates.map(u => u.key)
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
