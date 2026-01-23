/**
 * Send Contract API
 * POST: Send a contract for signing (via DocuSign/BoldSign)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const { contract_id, lead_id, recipient_email, recipient_name } = await request.json();
    const supabase = getSupabase();

    if (!contract_id && !lead_id) {
      return NextResponse.json(
        { error: 'contract_id or lead_id is required' },
        { status: 400 }
      );
    }

    // Get or create contract
    let contract;
    if (contract_id) {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contract_id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }
      contract = data;
    } else {
      // Create contract from lead
      const { data: lead, error: leadError } = await supabase
        .from('maxsam_leads')
        .select('*')
        .eq('id', lead_id)
        .single();

      if (leadError || !lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      // Create new contract
      const { data: newContract, error: createError } = await supabase
        .from('contracts')
        .insert({
          lead_id,
          contract_type: lead.deal_type || 'excess_funds',
          seller_name: recipient_name || lead.owner_name,
          seller_email: recipient_email || lead.email,
          property_address: lead.property_address,
          excess_funds_amount: lead.excess_funds_amount,
          total_fee: (lead.excess_funds_amount || 0) * 0.25,
          owner_fee: (lead.excess_funds_amount || 0) * 0.25,
          status: 'draft',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }

      contract = newContract;
    }

    // Trigger N8N document generator workflow
    await fetch('https://skooki.app.n8n.cloud/webhook/doc-generator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract_id: contract.id,
        lead_id: contract.lead_id,
        recipient_email: recipient_email || contract.seller_email,
        recipient_name: recipient_name || contract.seller_name,
        property_address: contract.property_address,
        amount: contract.total_fee
      })
    });

    // Update contract status
    await supabase
      .from('contracts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', contract.id);

    return NextResponse.json({
      success: true,
      contract_id: contract.id,
      message: 'Contract sent for signing'
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
