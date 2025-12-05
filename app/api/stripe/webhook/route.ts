import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { notifyPaymentReceived } from '@/lib/telegram';

/**
 * POST /api/stripe/webhook - Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    // In production, verify the webhook signature
    // For now, we'll parse the body directly
    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log(`Stripe webhook: ${event.type}`);

    const supabase = createClient();

    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object;
        const contractId = invoice.metadata?.contract_id;

        if (contractId) {
          // Update revenue record
          await supabase.from('revenue').update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_invoice_id: invoice.id,
            stripe_payment_intent_id: invoice.payment_intent
          }).eq('contract_id', contractId);

          // Update contract
          await supabase.from('contracts').update({
            payment_status: 'paid',
            paid_at: new Date().toISOString()
          }).eq('id', contractId);

          // Get contract details
          const { data: contract } = await supabase
            .from('contracts')
            .select('*, maxsam_leads(*)')
            .eq('id', contractId)
            .single();

          if (contract) {
            // Update lead status
            await supabase.from('maxsam_leads').update({
              status: 'closed'
            }).eq('id', contract.lead_id);

            // Log status change
            await supabase.from('status_history').insert({
              lead_id: contract.lead_id,
              contract_id: contractId,
              old_status: 'contract_signed',
              new_status: 'closed',
              changed_by: 'stripe_webhook',
              reason: `Payment received: $${(invoice.amount_paid / 100).toFixed(2)}`
            });

            // MONEY RECEIVED! Send celebration notification
            await notifyPaymentReceived({
              amount: invoice.amount_paid / 100,
              property_address: contract.property_address,
              seller_name: contract.seller_name,
              contract_type: contract.contract_type
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const contractId = invoice.metadata?.contract_id;

        if (contractId) {
          // Update revenue record
          await supabase.from('revenue').update({
            status: 'failed'
          }).eq('contract_id', contractId);

          // Update contract
          await supabase.from('contracts').update({
            payment_status: 'failed'
          }).eq('id', contractId);

          // TODO: Send notification about failed payment
          console.log('Payment failed for contract:', contractId);
        }
        break;
      }

      case 'invoice.sent': {
        const invoice = event.data.object;
        const contractId = invoice.metadata?.contract_id;

        if (contractId) {
          // Update contract with invoice URL
          await supabase.from('contracts').update({
            stripe_invoice_url: invoice.hosted_invoice_url,
            payment_status: 'invoiced'
          }).eq('id', contractId);
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Stripe webhook error:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
