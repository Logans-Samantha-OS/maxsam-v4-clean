/**
 * Lead Bank API - Park leads that aren't ready for outreach
 * GET: List all banked leads with summary
 * POST: Park a lead in the bank
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('lead_bank')
      .select(`
        *,
        lead:maxsam_leads(
          id, 
          owner_name, 
          primary_phone, 
          phone,
          property_address, 
          city, 
          county,
          excess_funds_amount, 
          eleanor_score
        )
      `)
      .is('reactivated_at', null)
      .order('parked_at', { ascending: false });

    if (error) throw error;

    // Calculate summary by reason
    const summary = (data || []).reduce((acc: Record<string, number>, item) => {
      acc[item.reason] = (acc[item.reason] || 0) + 1;
      return acc;
    }, {});

    // Calculate total value in bank
    const totalValue = (data || []).reduce((sum, item) => sum + (item.amount || 0), 0);

    return NextResponse.json({ 
      leads: data, 
      total: data?.length || 0, 
      summary,
      totalValue
    });
  } catch (error: any) {
    console.error('Lead Bank GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lead_id, reason, notes } = await request.json();
    
    if (!lead_id || !reason) {
      return NextResponse.json({ error: 'lead_id and reason required' }, { status: 400 });
    }

    // Get lead data for archiving
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('eleanor_score, excess_funds_amount, status')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Check if already banked
    const { data: existing } = await supabase
      .from('lead_bank')
      .select('id')
      .eq('lead_id', lead_id)
      .is('reactivated_at', null)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Lead already in bank' }, { status: 400 });
    }

    // Insert into lead_bank
    const { data: banked, error: bankError } = await supabase
      .from('lead_bank')
      .insert({ 
        lead_id, 
        reason, 
        notes, 
        original_score: lead.eleanor_score, 
        amount: lead.excess_funds_amount 
      })
      .select()
      .single();

    if (bankError) throw bankError;

    // Update lead status to 'banked'
    await supabase
      .from('maxsam_leads')
      .update({ status: 'banked', updated_at: new Date().toISOString() })
      .eq('id', lead_id);

    return NextResponse.json({ success: true, banked });
  } catch (error: any) {
    console.error('Lead Bank POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
