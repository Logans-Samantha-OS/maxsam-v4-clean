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

    // Handle signed contract - THIS IS MONEY TIME!
    if (newStatus === 'signed') {
      // Create revenue record
      await supabase.from('revenue').insert({
        contract_id: contract.id,
        lead_id: contract.lead_id,
        amount: contract.total_fee,
        fee_type: contract.contract_type,
        status: 'pending',
        owner_amount: contract.owner_fee,
        partner_amount: contract.partner_fee
      });

      // Send Telegram notification
      await notifyContractSigned({
        seller_name: contract.seller_name,
        property_address: contract.property_address,
        total_fee: contract.total_fee,
        contract_type: contract.contract_type
      });

      // If wholesale or dual, we would notify buyer network here
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
