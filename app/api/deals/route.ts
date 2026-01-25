/**
 * Deals API
 * GET: List all deals with filtering
 * POST: Create a new deal
 *
 * NOTE: MaxSam does NOT invoice clients via Stripe
 * - Excess Funds: Money comes from COUNTY payout (we take 25%)
 * - Wholesale: Money comes from TITLE COMPANY at closing (we take 10%)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);

    const dealType = searchParams.get('deal_type');
    const status = searchParams.get('status');
    const claimStatus = searchParams.get('claim_status');
    const closingStatus = searchParams.get('closing_status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('deals')
      .select(`
        *,
        maxsam_leads (
          id,
          owner_name,
          case_number,
          eleanor_score,
          phone,
          email
        ),
        contracts (
          id,
          status,
          docusign_envelope_id,
          signed_at
        ),
        buyers (
          id,
          name,
          company,
          phone,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (dealType) {
      query = query.eq('deal_type', dealType);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (claimStatus) {
      query = query.eq('claim_status', claimStatus);
    }

    if (closingStatus) {
      query = query.eq('closing_status', closingStatus);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Calculate summary stats
    const stats = {
      total: data?.length || 0,
      excess_funds: data?.filter(d => d.deal_type === 'excess_funds').length || 0,
      wholesale: data?.filter(d => d.deal_type === 'wholesale').length || 0,
      pending_claims: data?.filter(d => d.claim_status === 'pending').length || 0,
      approved_claims: data?.filter(d => d.claim_status === 'approved').length || 0,
      pending_closings: data?.filter(d => d.closing_status === 'scheduled').length || 0,
      closed: data?.filter(d => d.status === 'closed').length || 0,
      total_pipeline: data?.reduce((sum, d) => {
        if (d.deal_type === 'excess_funds') {
          return sum + (d.our_excess_fee_amount || 0);
        }
        return sum + (d.assignment_fee || 0);
      }, 0) || 0
    };

    return NextResponse.json({
      ok: true,
      deals: data,
      stats
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const {
      lead_id,
      contract_id,
      deal_type,
      property_address,
      seller_name,
      seller_email,
      seller_phone,
      // Excess funds fields
      excess_funds_amount,
      county_name,
      county_case_number,
      // Wholesale fields
      contract_price,
      assignment_fee,
      buyer_id,
      buyer_name,
      buyer_company,
      title_company,
      closing_date,
      notes
    } = body;

    if (!deal_type || !['excess_funds', 'wholesale'].includes(deal_type)) {
      return NextResponse.json(
        { ok: false, error: 'deal_type must be excess_funds or wholesale' },
        { status: 400 }
      );
    }

    // Build deal data based on type
    const dealData: Record<string, unknown> = {
      lead_id,
      contract_id,
      deal_type,
      property_address,
      seller_name,
      seller_email,
      seller_phone,
      status: 'pending',
      notes
    };

    if (deal_type === 'excess_funds') {
      dealData.excess_funds_amount = excess_funds_amount;
      dealData.county_name = county_name || 'Dallas';
      dealData.county_case_number = county_case_number;
      dealData.our_excess_fee_percentage = 0.25;
      dealData.our_excess_fee_amount = excess_funds_amount ? excess_funds_amount * 0.25 : null;
      dealData.owner_payout_amount = excess_funds_amount ? excess_funds_amount * 0.75 : null;
      dealData.claim_status = 'pending';
    } else {
      dealData.contract_price = contract_price;
      dealData.assignment_fee = assignment_fee;
      dealData.assignment_fee_percentage = 0.10;
      dealData.buyer_id = buyer_id;
      dealData.buyer_name = buyer_name;
      dealData.buyer_company = buyer_company;
      dealData.title_company = title_company;
      dealData.closing_date = closing_date;
      dealData.closing_status = 'scheduled';
    }

    const { data, error } = await supabase
      .from('deals')
      .insert(dealData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Link deal to contract if provided
    if (contract_id && data) {
      await supabase
        .from('contracts')
        .update({ deal_id: data.id })
        .eq('id', contract_id);
    }

    return NextResponse.json({ ok: true, deal: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
