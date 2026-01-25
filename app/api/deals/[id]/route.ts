/**
 * Deal by ID API
 * GET: Get deal details
 * PUT: Update deal (status changes, claim updates, closing updates)
 * POST: Perform actions (file_claim, approve_claim, record_payout, schedule_closing, close_deal)
 *
 * NOTE: MaxSam does NOT invoice clients via Stripe
 * - Excess Funds: Money comes from COUNTY payout (we take 25%)
 * - Wholesale: Money comes from TITLE COMPANY at closing (we take 10%)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  notifyClaimFiled,
  notifyClaimApproved,
  notifyClosingScheduled,
  notifyDealClosed,
  notifyPaymentReceived
} from '@/lib/telegram';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        maxsam_leads (
          id,
          owner_name,
          case_number,
          eleanor_score,
          phone,
          email,
          property_address
        ),
        contracts (
          id,
          status,
          contract_type,
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
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deal: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('deals')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deal: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST actions for deal state transitions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;
    const supabase = getSupabase();

    // Get current deal
    const { data: deal, error: fetchError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !deal) {
      return NextResponse.json({ ok: false, error: 'Deal not found' }, { status: 404 });
    }

    switch (action) {
      // ============================================
      // EXCESS FUNDS ACTIONS
      // ============================================

      case 'file_claim': {
        if (deal.deal_type !== 'excess_funds') {
          return NextResponse.json(
            { ok: false, error: 'file_claim only applies to excess_funds deals' },
            { status: 400 }
          );
        }

        const { data: updated } = await supabase
          .from('deals')
          .update({
            claim_status: 'pending',
            claim_filed_date: new Date().toISOString(),
            status: 'claim_filed',
            county_name: body.county_name || deal.county_name,
            county_case_number: body.county_case_number || deal.county_case_number
          })
          .eq('id', id)
          .select()
          .single();

        // Send notification
        await notifyClaimFiled({
          seller_name: deal.seller_name,
          property_address: deal.property_address,
          county_name: body.county_name || deal.county_name,
          excess_funds_amount: deal.excess_funds_amount,
          our_fee: deal.our_excess_fee_amount
        });

        return NextResponse.json({ ok: true, deal: updated, message: 'Claim filed with county' });
      }

      case 'approve_claim': {
        if (deal.deal_type !== 'excess_funds') {
          return NextResponse.json(
            { ok: false, error: 'approve_claim only applies to excess_funds deals' },
            { status: 400 }
          );
        }

        const { data: updated } = await supabase
          .from('deals')
          .update({
            claim_status: 'approved',
            status: 'claim_approved'
          })
          .eq('id', id)
          .select()
          .single();

        // Send notification
        await notifyClaimApproved({
          seller_name: deal.seller_name,
          property_address: deal.property_address,
          county_name: deal.county_name,
          payout_amount: deal.excess_funds_amount,
          our_fee: deal.our_excess_fee_amount
        });

        return NextResponse.json({ ok: true, deal: updated, message: 'Claim approved by county' });
      }

      case 'deny_claim': {
        if (deal.deal_type !== 'excess_funds') {
          return NextResponse.json(
            { ok: false, error: 'deny_claim only applies to excess_funds deals' },
            { status: 400 }
          );
        }

        const { data: updated } = await supabase
          .from('deals')
          .update({
            claim_status: 'denied',
            status: 'claim_denied',
            notes: body.denial_reason
              ? `${deal.notes || ''}\nDenial reason: ${body.denial_reason}`
              : deal.notes
          })
          .eq('id', id)
          .select()
          .single();

        return NextResponse.json({ ok: true, deal: updated, message: 'Claim denied' });
      }

      case 'record_county_payout': {
        if (deal.deal_type !== 'excess_funds') {
          return NextResponse.json(
            { ok: false, error: 'record_county_payout only applies to excess_funds deals' },
            { status: 400 }
          );
        }

        const payoutAmount = body.payout_amount || deal.excess_funds_amount;
        const ourFee = payoutAmount * (deal.our_excess_fee_percentage || 0.25);
        const ownerPayout = payoutAmount - ourFee;

        const { data: updated } = await supabase
          .from('deals')
          .update({
            claim_status: 'paid',
            status: 'closed',
            county_payout_date: new Date().toISOString(),
            county_payout_amount: payoutAmount,
            our_excess_fee_amount: ourFee,
            owner_payout_amount: ownerPayout,
            total_revenue: ourFee,
            owner_revenue: ourFee // 100% to Logan for now
          })
          .eq('id', id)
          .select()
          .single();

        // Update revenue record
        await supabase
          .from('revenue')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            amount: ourFee,
            source: 'county_payout'
          })
          .eq('deal_id', id);

        // Send notifications
        await notifyPaymentReceived({
          amount: ourFee,
          property_address: deal.property_address,
          seller_name: deal.seller_name,
          contract_type: 'excess_funds',
          source: 'county_payout'
        });

        await notifyDealClosed({
          deal_type: 'excess_funds',
          seller_name: deal.seller_name,
          property_address: deal.property_address,
          total_revenue: ourFee,
          owner_payout: ownerPayout
        });

        return NextResponse.json({
          ok: true,
          deal: updated,
          message: `County payout received. Our fee: $${ourFee.toLocaleString()}`
        });
      }

      case 'record_owner_payment': {
        if (deal.deal_type !== 'excess_funds') {
          return NextResponse.json(
            { ok: false, error: 'record_owner_payment only applies to excess_funds deals' },
            { status: 400 }
          );
        }

        const { data: updated } = await supabase
          .from('deals')
          .update({
            owner_paid_date: new Date().toISOString(),
            owner_paid_method: body.payment_method || 'check',
            status: 'paid_out'
          })
          .eq('id', id)
          .select()
          .single();

        return NextResponse.json({
          ok: true,
          deal: updated,
          message: `Owner paid $${deal.owner_payout_amount?.toLocaleString()}`
        });
      }

      // ============================================
      // WHOLESALE ACTIONS
      // ============================================

      case 'assign_buyer': {
        if (deal.deal_type !== 'wholesale') {
          return NextResponse.json(
            { ok: false, error: 'assign_buyer only applies to wholesale deals' },
            { status: 400 }
          );
        }

        const { data: updated } = await supabase
          .from('deals')
          .update({
            buyer_id: body.buyer_id,
            buyer_name: body.buyer_name,
            buyer_company: body.buyer_company,
            buyer_phone: body.buyer_phone,
            buyer_email: body.buyer_email
          })
          .eq('id', id)
          .select()
          .single();

        return NextResponse.json({ ok: true, deal: updated, message: 'Buyer assigned' });
      }

      case 'schedule_closing': {
        if (deal.deal_type !== 'wholesale') {
          return NextResponse.json(
            { ok: false, error: 'schedule_closing only applies to wholesale deals' },
            { status: 400 }
          );
        }

        const { data: updated } = await supabase
          .from('deals')
          .update({
            closing_date: body.closing_date,
            closing_status: 'scheduled',
            status: 'scheduled',
            title_company: body.title_company || deal.title_company,
            title_company_contact: body.title_company_contact,
            title_company_phone: body.title_company_phone,
            title_company_email: body.title_company_email
          })
          .eq('id', id)
          .select()
          .single();

        // Send notification
        await notifyClosingScheduled({
          seller_name: deal.seller_name,
          property_address: deal.property_address,
          buyer_name: deal.buyer_name || body.buyer_name,
          title_company: body.title_company || deal.title_company,
          closing_date: body.closing_date,
          assignment_fee: deal.assignment_fee
        });

        return NextResponse.json({ ok: true, deal: updated, message: 'Closing scheduled' });
      }

      case 'close_deal': {
        if (deal.deal_type !== 'wholesale') {
          return NextResponse.json(
            { ok: false, error: 'close_deal only applies to wholesale deals' },
            { status: 400 }
          );
        }

        const assignmentFee = body.assignment_fee || deal.assignment_fee;

        const { data: updated } = await supabase
          .from('deals')
          .update({
            closing_status: 'closed',
            status: 'closed',
            assignment_fee: assignmentFee,
            assignment_fee_received: true,
            assignment_fee_received_date: new Date().toISOString(),
            total_revenue: assignmentFee,
            owner_revenue: assignmentFee // 100% to Logan for now
          })
          .eq('id', id)
          .select()
          .single();

        // Update revenue record
        await supabase
          .from('revenue')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            amount: assignmentFee,
            source: 'title_company'
          })
          .eq('deal_id', id);

        // Send notifications
        await notifyPaymentReceived({
          amount: assignmentFee,
          property_address: deal.property_address,
          seller_name: deal.seller_name,
          contract_type: 'wholesale',
          source: 'title_company'
        });

        await notifyDealClosed({
          deal_type: 'wholesale',
          seller_name: deal.seller_name,
          property_address: deal.property_address,
          total_revenue: assignmentFee
        });

        return NextResponse.json({
          ok: true,
          deal: updated,
          message: `Deal closed! Assignment fee: $${assignmentFee?.toLocaleString()}`
        });
      }

      case 'deal_fell_through': {
        const { data: updated } = await supabase
          .from('deals')
          .update({
            status: 'fell_through',
            closing_status: deal.deal_type === 'wholesale' ? 'fell_through' : deal.closing_status,
            notes: body.reason
              ? `${deal.notes || ''}\nFell through: ${body.reason}`
              : deal.notes
          })
          .eq('id', id)
          .select()
          .single();

        // Update revenue record
        await supabase
          .from('revenue')
          .update({ status: 'cancelled' })
          .eq('deal_id', id);

        return NextResponse.json({ ok: true, deal: updated, message: 'Deal marked as fell through' });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
