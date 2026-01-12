import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { buyer_email, bid_amount, bid_percentage } = body;

    // Validate required fields
    if (!buyer_email || !bid_amount || !bid_percentage) {
      return NextResponse.json(
        { error: 'Missing required fields: buyer_email, bid_amount, bid_percentage' },
        { status: 400 }
      );
    }

    // 1. Find buyer by email
    const { data: buyer, error: buyerError } = await supabase
      .from('wholesale_buyers')
      .select('id')
      .eq('email', buyer_email)
      .single();

    if (buyerError || !buyer) {
      return NextResponse.json(
        { error: 'Buyer not found with this email address' },
        { status: 404 }
      );
    }

    // 2. Check if deal exists
    const { data: deal, error: dealError } = await supabase
      .from('maxsam_leads')
      .select('id, arv')
      .eq('id', params.id)
      .single();

    if (dealError || !deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    // 3. Validate bid amount against ARV limits
    const minBid = deal.arv * 0.70;
    const maxBid = deal.arv * 0.95;
    
    if (bid_amount < minBid || bid_amount > maxBid) {
      return NextResponse.json(
        { 
          error: `Bid amount must be between $${minBid.toLocaleString()} (70% of ARV) and $${maxBid.toLocaleString()} (95% of ARV)` 
        },
        { status: 400 }
      );
    }

    // 4. Check if buyer already has a pending bid for this deal
    const { data: existingBid, error: existingBidError } = await supabase
      .from('deal_bids')
      .select('id')
      .eq('deal_id', params.id)
      .eq('buyer_id', buyer.id)
      .eq('status', 'pending')
      .single();

    if (existingBid && !existingBidError) {
      return NextResponse.json(
        { error: 'You already have a pending bid for this deal' },
        { status: 409 }
      );
    }

    // 5. Save bid to database
    const { data: bid, error: bidError } = await supabase
      .from('deal_bids')
      .insert({
        deal_id: params.id,
        buyer_id: buyer.id,
        bid_amount,
        bid_percentage,
        status: 'pending'
      })
      .select()
      .single();

    if (bidError) {
      console.error('Bid insertion error:', bidError);
      return NextResponse.json(
        { error: 'Failed to save bid: ' + bidError.message },
        { status: 500 }
      );
    }

    // 6. Trigger N8N webhook
    try {
      const webhookPayload = {
        deal_id: params.id,
        buyer_id: buyer.id,
        bid_amount,
        bid_percentage,
        buyer_email,
        timestamp: new Date().toISOString()
      };

      const webhookResponse = await fetch('https://skooki.app.n8n.cloud/webhook/submit-bid', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'MaxSam-V4-BidSystem'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!webhookResponse.ok) {
        console.error('N8N webhook failed:', webhookResponse.status, webhookResponse.statusText);
        // Don't fail the request, just log the error
      } else {
        console.log('N8N webhook triggered successfully for bid:', bid.id);
      }
    } catch (webhookError) {
      console.error('Error triggering N8N webhook:', webhookError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({ 
      success: true, 
      bid: {
        id: bid.id,
        deal_id: bid.deal_id,
        bid_amount: bid.bid_amount,
        bid_percentage: bid.bid_percentage,
        status: bid.status,
        submitted_at: bid.created_at
      }
    });

  } catch (error) {
    console.error('Bid submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabase();
    
    // Fetch all bids for this deal with buyer information
    const { data, error } = await supabase
      .from('deal_bids')
      .select(`
        id,
        bid_amount,
        bid_percentage,
        status,
        created_at,
        wholesale_buyers!inner(
          name,
          email,
          company
        )
      `)
      .eq('deal_id', params.id)
      .order('bid_amount', { ascending: false });

    if (error) {
      console.error('Error fetching bids:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bids' },
        { status: 500 }
      );
    }

    return NextResponse.json({ bids: data || [] });

  } catch (error) {
    console.error('GET bids error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
