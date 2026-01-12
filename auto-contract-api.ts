// app/api/contracts/auto-generate/route.ts
// AUTONOMOUS CONTRACT GENERATION

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const N8N_WEBHOOK = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://skooki.app.n8n.cloud/webhook';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, deal_type, vip_hold = false } = body;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Calculate fees
    const excessAmount = lead.excess_funds_amount || 0;
    const excessFee = excessAmount * 0.25;
    
    // For wholesale, we'd need property details (ARV, repairs)
    // For now, assuming dual-deal if property_address exists
    const hasProp = !!lead.property_address;
    const wholesaleFee = hasProp ? excessAmount * 0.10 : 0; // Placeholder
    
    const totalFee = excessFee + wholesaleFee;
    const actualDealType = deal_type || (hasProp ? 'dual' : 'excess');

    // Create contract
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        lead_id: lead.id,
        owner_name: lead.owner_name,
        property_address: lead.property_address,
        email: lead.email,
        phone: lead.phone,
        deal_type: actualDealType,
        excess_amount: excessAmount,
        wholesale_amount: hasProp ? excessAmount * 0.90 : 0,
        excess_fee: excessFee,
        wholesale_fee: wholesaleFee,
        total_fee: totalFee,
        owner: 'Logan Toups',
        owner_percentage: 100,
        status: vip_hold ? 'draft' : 'pending_signature',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (contractError) throw contractError;

    // If NOT VIP hold, proceed with automation
    if (!vip_hold) {
      // Trigger N8N contract workflow
      await fetch(`${N8N_WEBHOOK}/generate-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contract.id,
          lead_id: lead.id,
          total_fee: totalFee,
          auto_send: true,
        }),
      });

      // Create Stripe invoice
      const stripeResponse = await fetch('/api/stripe/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contract.id,
          amount: totalFee,
          customer_email: lead.email,
          description: `MaxSam Fee - ${actualDealType} deal for ${lead.owner_name}`,
        }),
      });

      if (stripeResponse.ok) {
        const stripeData = await stripeResponse.json();
        
        // Update contract with Stripe info
        await supabase
          .from('contracts')
          .update({
            stripe_invoice_id: stripeData.invoice_id,
            stripe_payment_link: stripeData.payment_link,
          })
          .eq('id', contract.id);
      }
    }

    return NextResponse.json({
      success: true,
      contract,
      vip_hold,
      message: vip_hold 
        ? 'Contract created and held for your review'
        : 'Contract created and sent to client',
    });

  } catch (error) {
    console.error('Contract generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Contract creation failed' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch pending contracts
export async function GET(request: NextRequest) {
  const vipOnly = request.nextUrl.searchParams.get('vip') === 'true';
  
  let query = supabase
    .from('contracts')
    .select('*, maxsam_leads(owner_name, phone, excess_funds_amount)')
    .in('status', ['draft', 'pending_signature']);

  const { data: contracts } = await query;

  return NextResponse.json({
    contracts: contracts || [],
    count: contracts?.length || 0,
  });
}
