import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/leads/[id] - Perform actions on a lead
 * Actions: generate-contract, send-sms, skip-trace, score
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, ...actionData } = body;

    const supabase = getSupabase();

    // Get lead first
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    switch (action) {
      case 'generate-contract': {
        // Import contract generator dynamically
        const { generateContract } = await import('@/lib/contract-generator');

        const contractType = actionData.contract_type ||
          (lead.deal_type === 'wholesale' ? 'wholesale' :
           lead.deal_type === 'dual' ? 'dual' : 'excess_funds');

        const result = await generateContract(id, contractType);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // Send notification via Telegram
        try {
          const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
          const chatId = process.env.TELEGRAM_CHAT_ID;

          if (telegramToken && chatId) {
            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `📄 <b>Contract Sent!</b>\n\n<b>Lead:</b> ${lead.owner_name}\n<b>Property:</b> ${lead.property_address}\n<b>Amount:</b> $${(lead.excess_funds_amount || 0).toLocaleString()}\n<b>Type:</b> ${contractType}\n\nAgreement ID: ${result.agreementId || 'N/A'}`,
                parse_mode: 'HTML'
              })
            });
          }
        } catch (e) {
          console.error('Telegram notification failed:', e);
        }

        return NextResponse.json({
          success: true,
          agreementId: result.agreementId,
          pdfUrl: result.pdfUrl,
          message: 'Agreement PDF generated and stored'
        });
      }

      case 'send-sms': {
        const { sendSMS } = await import('@/lib/twilio');
        const { message, to_number } = actionData;

        if (!message) {
          return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const phone = to_number || lead.phone || lead.phone_1 || lead.phone_2;
        if (!phone) {
          return NextResponse.json({ error: 'No phone number available' }, { status: 400 });
        }

        const result = await sendSMS(phone, message, id);

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // Log to sms_messages
        await supabase.from('sms_messages').insert({
          lead_id: id,
          direction: 'outbound',
          body: message,
          from_number: process.env.TWILIO_PHONE_NUMBER,
          to_number: phone,
          status: 'sent',
          message_sid: result.sid,
          sent_at: new Date().toISOString(),
          agent_name: 'SAM',
          created_at: new Date().toISOString()
        });

        // Update contact info
        await supabase.from('maxsam_leads').update({
          contact_attempts: (lead.contact_attempts || 0) + 1,
          last_contact_date: new Date().toISOString()
        }).eq('id', id);

        return NextResponse.json({
          success: true,
          sid: result.sid,
          message: 'SMS sent successfully'
        });
      }

      case 'skip-trace': {
        // Call skip trace API
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        const skipResponse = await fetch(`${baseUrl}/api/leads/${id}/skip-trace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const skipResult = await skipResponse.json();

        return NextResponse.json(skipResult, { status: skipResponse.ok ? 200 : 400 });
      }

      case 'score': {
        // Call Eleanor scoring
        const { calculateEleanorScore } = await import('@/lib/eleanor');

        const result = calculateEleanorScore(lead);

        await supabase.from('maxsam_leads').update({
          eleanor_score: result.eleanor_score,
          deal_grade: result.deal_grade,
          contact_priority: result.contact_priority,
          scoring_notes: result.reasoning?.join('; ')
        }).eq('id', id);

        return NextResponse.json({
          success: true,
          score: result.eleanor_score,
          grade: result.deal_grade,
          priority: result.contact_priority
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Lead action error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
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

    // Get current lead for status history
    const { data: currentLead } = await supabase
      .from('maxsam_leads')
      .select('status')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('maxsam_leads')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log status change if status was updated
    if (body.status && currentLead && body.status !== currentLead.status) {
      await supabase.from('status_history').insert({
        lead_id: id,
        old_status: currentLead.status,
        new_status: body.status,
        changed_by: 'api_update',
        reason: body.status_reason || 'Manual status update'
      });
    }

    return NextResponse.json(data);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Also support PATCH for backwards compatibility
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // Soft delete - set status to 'deleted'
    const { error } = await supabase
      .from('maxsam_leads')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Lead deleted' });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
