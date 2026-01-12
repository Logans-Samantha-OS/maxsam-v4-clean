// app/api/stripe/create-invoice/route.ts
// AUTONOMOUS STRIPE INVOICE CREATION

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contract_id, amount, customer_email, description } = body;

    // Create or get customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: customer_email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: customer_email,
        description: `MaxSam Client - Contract ${contract_id}`,
      });
    }

    // Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      description: description,
      metadata: {
        contract_id: contract_id,
        service: 'maxsam_excess_funds',
      },
      auto_advance: true, // Auto-finalize
    });

    // Add invoice item
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      description: description,
    });

    // Finalize invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    // Get payment link
    const paymentLink = finalizedInvoice.hosted_invoice_url;

    return NextResponse.json({
      success: true,
      invoice_id: finalizedInvoice.id,
      payment_link: paymentLink,
      amount: amount,
      customer_id: customer.id,
    });

  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invoice creation failed' },
      { status: 500 }
    );
  }
}

// Webhook handler for payment confirmations
export async function PUT(request: NextRequest) {
  try {
    const sig = request.headers.get('stripe-signature');
    const body = await request.text();

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle payment success
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const contractId = invoice.metadata?.contract_id;

      if (contractId) {
        // Update contract status in Supabase
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabase
          .from('contracts')
          .update({ 
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('id', contractId);

        // Trigger Telegram notification via N8N
        const N8N_WEBHOOK = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
        await fetch(`${N8N_WEBHOOK}/stripe-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'invoice.paid',
            contract_id: contractId,
            amount: invoice.amount_paid / 100,
            customer_email: invoice.customer_email,
          }),
        });
      }
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook failed' },
      { status: 400 }
    );
  }
}
