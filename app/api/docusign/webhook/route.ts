import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyContractSigned } from '@/lib/telegram';

/**
 * POST /api/docusign/webhook - Handle DocuSign events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // DocuSign Connect sends events in different formats
    // Handle both envelope status change and recipient events
    const event = body.event || body.envelopeStatus?.status;
    const envelopeId = body.data?.envelopeId || body.envelopeId || body.envelopeStatus?.envelopeId;

    if (!envelopeId) {
      console.log('DocuSign webhook: No envelope ID');
      return NextResponse.json({ received: true });
    }

    console.log(`DocuSign webhook: ${event} for envelope ${envelopeId}`);

    const supabase = createClient();

    // Map DocuSign status to our status
    const statusMap: Record<string, string> = {
      'sent': 'sent',
      'delivered': 'delivered',
      'completed': 'signed',
      'signed': 'signed',
      'declined': 'rejected',
      'voided': 'rejected',
      'timedout': 'expired'
    };

    const newStatus = statusMap[event?.toLowerCase()] || statusMap[body.status?.toLowerCase()];

    if (!newStatus) {
      console.log('DocuSign webhook: Unknown event type:', event);
      return NextResponse.json({ received: true });
    }

    // Get contract by envelope ID
    const { data: contract } = await supabase
      .from('contracts')
      .select('*')
      .eq('docusign_envelope_id', envelopeId)
      .single();

    if (!contract) {
      console.log('DocuSign webhook: Contract not found for envelope:', envelopeId);
      return NextResponse.json({ received: true });
    }

    // Update contract status
    const updates: Record<string, unknown> = { status: newStatus };

    if (newStatus === 'sent') {
      updates.sent_at = new Date().toISOString();
    }

    if (newStatus === 'signed') {
      updates.signed_at = new Date().toISOString();
    }

    await supabase
      .from('contracts')
      .update(updates)
      .eq('id', contract.id);

    // Update lead status
    const leadStatusMap: Record<string, string> = {
      'sent': 'contract_sent',
      'delivered': 'contract_sent',
      'signed': 'contract_signed',
      'rejected': 'dead',
      'expired': 'contacted'
    };

    const leadStatus = leadStatusMap[newStatus];
    if (leadStatus && contract.lead_id) {
      await supabase
        .from('maxsam_leads')
        .update({ status: leadStatus })
        .eq('id', contract.lead_id);

      // Log status change
      await supabase.from('status_history').insert({
        lead_id: contract.lead_id,
        contract_id: contract.id,
        old_status: contract.status,
        new_status: leadStatus,
        changed_by: 'docusign_webhook',
        reason: `DocuSign event: ${event}`
      });
    }

    // Handle signed contract - Create deal record for proper payment tracking
    // NOTE: MaxSam does NOT invoice clients via Stripe
    // - Excess Funds: Money comes from COUNTY payout (we take 25%)
    // - Wholesale: Money comes from TITLE COMPANY at closing (we take 10%)
    if (newStatus === 'signed') {
      // Determine deal type from contract
      const dealType = contract.contract_type === 'wholesale' ? 'wholesale' : 'excess_funds';

      // Create deal record (replaces old revenue record for tracking)
      const dealData: Record<string, unknown> = {
        lead_id: contract.lead_id,
        contract_id: contract.id,
        deal_type: dealType,
        property_address: contract.property_address,
        seller_name: contract.seller_name,
        status: 'pending'
      };

      // Add type-specific fields
      if (dealType === 'excess_funds') {
        dealData.excess_funds_amount = contract.excess_funds_amount || contract.total_fee / 0.25;
        dealData.our_excess_fee_percentage = 0.25;
        dealData.our_excess_fee_amount = contract.total_fee;
        dealData.owner_payout_amount = (contract.excess_funds_amount || 0) * 0.75;
        dealData.claim_status = 'pending';
      } else {
        dealData.assignment_fee = contract.total_fee;
        dealData.assignment_fee_percentage = 0.10;
        dealData.closing_status = 'scheduled';
      }

      const { data: deal } = await supabase.from('deals').insert(dealData).select().single();

      // Link deal to contract
      if (deal) {
        await supabase.from('contracts').update({ deal_id: deal.id }).eq('id', contract.id);
      }

      // Create revenue record (pending - money hasn't arrived yet)
      await supabase.from('revenue').insert({
        contract_id: contract.id,
        lead_id: contract.lead_id,
        deal_id: deal?.id,
        amount: contract.total_fee,
        fee_type: contract.contract_type,
        status: 'pending',
        source: dealType === 'excess_funds' ? 'county_payout' : 'title_company',
        owner_amount: contract.owner_fee,
        partner_amount: contract.partner_fee
      });

      // Send Telegram notification with correct payment flow info
      await notifyContractSigned({
        seller_name: contract.seller_name,
        property_address: contract.property_address,
        total_fee: contract.total_fee,
        contract_type: contract.contract_type,
        // Add next steps info
        next_step: dealType === 'excess_funds'
          ? 'File claim with county'
          : 'Find buyer and schedule closing'
      });

      // If wholesale or dual, notify buyer network
      if (contract.contract_type === 'wholesale' || contract.contract_type === 'dual') {
        console.log('TODO: Notify buyer network about:', contract.property_address);
      }
    }

    return NextResponse.json({ received: true, status: newStatus });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('DocuSign webhook error:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
