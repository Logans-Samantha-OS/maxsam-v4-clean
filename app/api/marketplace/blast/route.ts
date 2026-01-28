/**
 * Marketplace Blast API - Notify buyers about available inventory
 * POST: Send SMS blast to matching buyers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const TYPE_LABELS: Record<string, string> = {
  distressed_seller: 'Distressed Seller',
  excess_funds: 'Excess Funds',
  skip_trace: 'Skip Trace',
  mass_tort: 'Mass Tort',
  unclaimed_property: 'Unclaimed Property',
  death_benefit: 'Death Benefit',
  wholesale: 'Wholesale'
};

export async function POST(request: NextRequest) {
  try {
    const { lead_type, message, buyer_ids } = await request.json();

    if (!lead_type) {
      return NextResponse.json({ error: 'lead_type required' }, { status: 400 });
    }

    // Get buyers interested in this lead type
    let query = supabase
      .from('maxsam_buyers')
      .select('*')
      .eq('is_active', true);

    if (buyer_ids && buyer_ids.length > 0) {
      query = query.in('id', buyer_ids);
    } else {
      // Filter by lead_types array containing this type
      query = query.contains('lead_types', [lead_type]);
    }

    const { data: buyers, error: buyerError } = await query;
    if (buyerError) throw buyerError;

    if (!buyers?.length) {
      return NextResponse.json({ error: 'No matching buyers found' }, { status: 404 });
    }

    // Get inventory count for this type
    const { data: inventory } = await supabase
      .from('marketplace_inventory')
      .select('id')
      .eq('lead_type', lead_type)
      .eq('status', 'available');

    const count = inventory?.length || 0;
    const typeLabel = TYPE_LABELS[lead_type] || lead_type.replace('_', ' ');

    const results: { buyer: string; status: string; error?: string }[] = [];

    for (const buyer of buyers) {
      if (!buyer.phone) {
        results.push({ buyer: buyer.name, status: 'skipped', error: 'No phone number' });
        continue;
      }

      const smsBody = message || 
        `MaxSam Alert: ${count} new ${typeLabel} leads available! ` +
        `Reply YES to claim or visit our portal for details.`;

      try {
        await twilioClient.messages.create({
          body: smsBody,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: buyer.phone
        });
        results.push({ buyer: buyer.name, status: 'sent' });
      } catch (err: any) {
        results.push({ buyer: buyer.name, status: 'failed', error: err.message });
      }

      // Rate limit: 1 SMS per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = results.filter(r => r.status === 'sent').length;

    return NextResponse.json({ 
      success: true, 
      notified: successCount, 
      total: buyers.length,
      results 
    });
  } catch (error: any) {
    console.error('Marketplace Blast error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
