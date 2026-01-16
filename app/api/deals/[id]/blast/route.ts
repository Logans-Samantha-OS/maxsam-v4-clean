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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;
    const supabase = getSupabase();

    // 1. Verify deal exists
    const { data: deal, error: dealError } = await supabase
      .from('maxsam_leads')
      .select('id, property_address, city, arv, eleanor_score, excess_funds_amount')
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    // 2. Trigger N8N webhook to blast to buyers
    try {
      const webhookPayload = {
        lead_id: dealId,
        deal_data: {
          property_address: deal.property_address,
          city: deal.city,
          arv: deal.arv,
          eleanor_score: deal.eleanor_score,
          excess_funds_amount: deal.excess_funds_amount
        },
        timestamp: new Date().toISOString()
      };

      console.log('Triggering buyer blast for deal:', dealId, webhookPayload);

      const webhookResponse = await fetch('https://skooki.app.n8n.cloud/webhook/push-to-buyers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'MaxSam-V4-BuyerBlast'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!webhookResponse.ok) {
        console.error('N8N buyer blast webhook failed:', webhookResponse.status, webhookResponse.statusText);
        const errorText = await webhookResponse.text();
        console.error('Error response:', errorText);
        
        return NextResponse.json(
          { 
            error: 'Failed to trigger buyer blast webhook',
            details: `HTTP ${webhookResponse.status}: ${webhookResponse.statusText}`
          },
          { status: 500 }
        );
      }

      const responseData = await webhookResponse.json();
      console.log('N8N buyer blast webhook response:', responseData);

      // 3. Optionally update deal status to indicate blast was sent
      await supabase
        .from('maxsam_leads')
        .update({ 
          status: 'buyer_blast_sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', dealId);

      return NextResponse.json({
        success: true,
        message: 'Buyer blast triggered successfully',
        deal_id: dealId,
        webhook_response: responseData
      });

    } catch (webhookError) {
      console.error('Error triggering N8N buyer blast webhook:', webhookError);
      
      return NextResponse.json(
        { 
          error: 'Failed to trigger buyer blast webhook',
          details: webhookError instanceof Error ? webhookError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Buyer blast error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dealId } = await params;
    const supabase = getSupabase();

    // Check if buyer blast has been sent for this deal
    const { data: deal, error } = await supabase
      .from('maxsam_leads')
      .select('id, status, updated_at')
      .eq('id', dealId)
      .single();

    if (error || !deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      deal_id: dealId,
      blast_sent: deal.status === 'buyer_blast_sent',
      last_updated: deal.updated_at
    });

  } catch (error) {
    console.error('GET blast status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
