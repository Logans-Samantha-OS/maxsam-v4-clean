import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = (await headers()).get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;
    const stripe = getStripe();

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Handle different event types
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice paid:', invoice.id);

        // Extract metadata with type safety
        const metadata = invoice.metadata || {};
        const deal_id = metadata.deal_id as string;
        const bid_id = metadata.bid_id as string;
        const buyer_id = metadata.buyer_id as string;

        if (!deal_id || !buyer_id) {
          console.error('Missing required metadata in invoice:', invoice.id);
          return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
        }

        // Update contract status to paid
        const { error: contractError } = await supabase
          .from('contracts')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: (invoice as any).payment_intent as string || null
          })
          .eq('stripe_invoice_id', invoice.id);

        if (contractError) {
          console.error('Error updating contract:', contractError);
          return NextResponse.json({ error: 'Failed to update contract' }, { status: 500 });
        }

        // Update deal status
        await supabase
          .from('maxsam_leads')
          .update({
            status: 'assignment_fee_paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', deal_id);

        // Trigger N8N webhook to send documents
        try {
          const webhookPayload = {
            deal_id,
            buyer_id,
            bid_id,
            invoice_id: invoice.id,
            payment_amount: invoice.amount_paid / 100,
            customer_email: invoice.customer_email,
            timestamp: new Date().toISOString(),
            event_type: 'assignment_fee_paid'
          };

          console.log('Triggering N8N webhook for paid invoice:', webhookPayload);

          const webhookResponse = await fetch('https://skooki.app.n8n.cloud/webhook/assignment-fee-paid', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'MaxSam-V4-Stripe-Webhook'
            },
            body: JSON.stringify(webhookPayload)
          });

          if (!webhookResponse.ok) {
            console.error('N8N webhook failed:', webhookResponse.status, webhookResponse.statusText);
            // Don't fail the webhook response, just log the error
          } else {
            console.log('N8N webhook triggered successfully for invoice:', invoice.id);
          }
        } catch (webhookError) {
          console.error('Error triggering N8N webhook:', webhookError);
          // Don't fail the webhook response, just log the error
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice payment failed:', invoice.id);

        // Update contract status to failed
        const { error: contractError } = await supabase
          .from('contracts')
          .update({
            status: 'payment_failed',
            last_payment_attempt: new Date().toISOString()
          })
          .eq('stripe_invoice_id', invoice.id);

        if (contractError) {
          console.error('Error updating contract for failed payment:', contractError);
        }

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice payment succeeded:', invoice.id);

        // This is similar to invoice.paid but includes successful payment attempts
        const metadata = invoice.metadata || {};
        const deal_id = metadata.deal_id as string;
        const buyer_id = metadata.buyer_id as string;

        if (deal_id && buyer_id) {
          await supabase
            .from('contracts')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: (invoice as any).payment_intent as string || null
            })
            .eq('stripe_invoice_id', invoice.id);
        }

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // Handle subscription events if needed in the future
        console.log(`Subscription event: ${event.type}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'Stripe webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}
