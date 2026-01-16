import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;
    const supabase = getSupabase();

    // Fetch winning bid (accepted bid) with buyer and deal details
    const { data: winningBid, error: bidError } = await supabase
      .from('deal_bids')
        .select(`
          id,
          bid_amount,
          bid_percentage,
          buyer_id,
          created_at,
          wholesale_buyers!inner(
            id,
            name,
            email,
            company
          ),
          maxsam_leads!inner(
            id,
            property_address,
            city,
            arv,
            offer_amount,
            excess_funds_amount
          )
        `)
      .eq('deal_id', dealId)
      .eq('status', 'accepted')
      .single();

    if (bidError || !winningBid) {
      return NextResponse.json(
        { error: 'No accepted bid found for this deal' },
        { status: 404 }
      );
    }

    // Check if invoice already exists
    const { data: existingContract, error: contractError } = await supabase
      .from('contracts')
      .select('id, stripe_invoice_id, status, payment_url')
      .eq('deal_id', dealId)
      .eq('buyer_id', (winningBid as any).wholesale_buyers.id)
      .single();

    const bidData = winningBid as any;
    const dealData = bidData.maxsam_leads;
    const buyerData = bidData.wholesale_buyers;

    return NextResponse.json({
      deal: {
        id: dealData.id,
        property_address: dealData.property_address,
        city: dealData.city,
        arv: dealData.arv,
        offer_amount: dealData.offer_amount,
        excess_funds_amount: dealData.excess_funds_amount
      },
      bid: {
        id: bidData.id,
        amount: bidData.bid_amount,
        percentage: bidData.bid_percentage,
        created_at: bidData.created_at
      },
      buyer: {
        id: buyerData.id,
        name: buyerData.name,
        email: buyerData.email,
        company: buyerData.company
      },
      existing_contract: existingContract || null,
      fee_amount: bidData.bid_amount * 0.10, // 10% assignment fee
      total_amount: bidData.bid_amount
    });

  } catch (error) {
    console.error('Error fetching invoice data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;
    const supabase = getSupabase();
    const body = await request.json();
    const { buyer_email } = body;

    // First fetch the deal and winning bid data
    const { data: winningBid, error: bidError } = await supabase
      .from('deal_bids')
        .select(`
          id,
          bid_amount,
          bid_percentage,
          buyer_id,
          created_at,
          wholesale_buyers!inner(
            id,
            name,
            email,
            company
          ),
          maxsam_leads!inner(
            id,
            property_address,
            city,
            arv,
            offer_amount,
            excess_funds_amount
          )
        `)
      .eq('deal_id', dealId)
      .eq('status', 'accepted')
      .single();

    if (bidError || !winningBid) {
      return NextResponse.json(
        { error: 'No accepted bid found for this deal' },
        { status: 404 }
      );
    }

    const bidData = winningBid as any;
    const dealData = bidData.maxsam_leads;
    const buyerData = bidData.wholesale_buyers;

    // Verify buyer email matches
    if (buyerData.email !== buyer_email) {
      return NextResponse.json(
        { error: 'Buyer email does not match accepted bid' },
        { status: 400 }
      );
    }

    // Check if invoice already exists
    const { data: existingContract, error: contractError } = await supabase
      .from('contracts')
      .select('id, stripe_invoice_id, status')
      .eq('deal_id', dealId)
      .eq('buyer_id', buyerData.id)
      .single();

    if (existingContract && existingContract.stripe_invoice_id) {
      return NextResponse.json(
        { error: 'Invoice already exists for this deal' },
        { status: 409 }
      );
    }

    // Calculate fees
    const bidAmount = bidData.bid_amount;
    const assignmentFee = Math.round(bidAmount * 0.10 * 100); // 10% fee in cents
    const totalAmount = Math.round(bidAmount * 100); // Convert to cents

    // Create Stripe invoice
    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email: buyerData.email,
      name: buyerData.name,
      metadata: {
        buyer_id: buyerData.id,
        company: buyerData.company || '',
        deal_id: dealId
      }
    });

    // Create invoice item for the assignment fee
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount: assignmentFee,
      currency: 'usd',
      description: `Assignment Fee - ${dealData.property_address}, ${dealData.city}`,
      metadata: {
        deal_id: dealId,
        bid_id: bidData.id,
        buyer_id: buyerData.id,
        fee_type: 'assignment_fee'
      }
    });

    // Create the invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      currency: 'usd',
      description: `MaxSam Assignment Fee - ${dealData.property_address}, ${dealData.city}`,
      metadata: {
        deal_id: dealId,
        bid_id: bidData.id,
        buyer_id: buyerData.id,
        bid_amount: bidAmount.toString(),
        assignment_fee: (assignmentFee / 100).toString()
      },
      auto_advance: true,
      collection_method: 'send_invoice'
    });

    // Send the invoice
    await stripe.invoices.sendInvoice(invoice.id);

    // Store contract in database
    const contractData = {
      deal_id: dealId,
      buyer_id: buyerData.id,
      bid_id: bidData.id,
      bid_amount: bidAmount,
      assignment_fee: assignmentFee / 100,
      total_amount: bidAmount,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: customer.id,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    let contract;
    if (existingContract) {
      // Update existing contract
      const { data: updatedContract, error: updateError } = await supabase
        .from('contracts')
        .update(contractData)
        .eq('id', existingContract.id)
        .select()
        .single();

      if (updateError) throw updateError;
      contract = updatedContract;
    } else {
      // Create new contract
      const { data: newContract, error: insertError } = await supabase
        .from('contracts')
        .insert(contractData)
        .select()
        .single();

      if (insertError) throw insertError;
      contract = newContract;
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        payment_url: invoice.hosted_invoice_url,
        amount: assignmentFee / 100,
        status: invoice.status,
        created_at: invoice.created
      },
      contract: {
        id: contract.id,
        status: contract.status
      }
    });

  } catch (error) {
    console.error('Error creating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
