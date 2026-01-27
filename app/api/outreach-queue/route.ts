/**
 * Outreach Queue API
 * Manage pre-outreach approval queue for SAM messages
 *
 * GET /api/outreach-queue - List queued messages
 * POST /api/outreach-queue - Queue a new message
 * PATCH /api/outreach-queue - Approve/reject messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/twilio';

/**
 * GET /api/outreach-queue
 * List queued messages with filters
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';
  const limit = parseInt(searchParams.get('limit') || '50');
  const includeStats = searchParams.get('stats') === 'true';

  const supabase = createClient();

  try {
    // Get queued messages
    let query = supabase
      .from('outreach_queue')
      .select(`
        *,
        maxsam_leads(
          golden_lead,
          is_golden_lead,
          days_until_expiration,
          excess_funds_expiry_date
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: messages, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Get stats if requested
    let stats = null;
    if (includeStats) {
      const { data: statsData } = await supabase.rpc('get_outreach_queue_stats');
      stats = statsData;
    }

    // Check approval mode setting
    const { data: config } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'outreach_approval_required')
      .single();

    return NextResponse.json({
      success: true,
      messages,
      count: messages?.length || 0,
      stats,
      approval_required: config?.value === 'true'
    });
  } catch (error) {
    console.error('Outreach queue GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch queue' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/outreach-queue
 * Queue a new message for approval
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, phone, message, template_key, priority } = body;

    if (!lead_id || !phone || !message) {
      return NextResponse.json(
        { success: false, error: 'lead_id, phone, and message are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data, error } = await supabase.rpc('queue_outreach_message', {
      p_lead_id: lead_id,
      p_phone: phone,
      p_message: message,
      p_template_key: template_key || 'custom',
      p_priority: priority || 'normal'
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      queue_id: data,
      message: 'Message queued for approval'
    });
  } catch (error) {
    console.error('Outreach queue POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to queue message' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/outreach-queue
 * Approve or reject queued messages
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, queue_ids, reviewer, notes, custom_message } = body;

    if (!action || !queue_ids || !Array.isArray(queue_ids)) {
      return NextResponse.json(
        { success: false, error: 'action and queue_ids array are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const queueId of queue_ids) {
      if (action === 'approve') {
        // Approve the message
        const { data, error } = await supabase.rpc('approve_outreach_message', {
          p_queue_id: queueId,
          p_reviewer: reviewer || 'dashboard',
          p_notes: notes,
          p_custom_message: custom_message
        });

        if (error) {
          results.push({ id: queueId, success: false, error: error.message });
          continue;
        }

        // Get the approved message details
        const { data: queueItem } = await supabase
          .from('outreach_queue')
          .select('*')
          .eq('id', queueId)
          .single();

        if (queueItem) {
          // Send the SMS
          const messageToSend = queueItem.customized_message || queueItem.message_preview;
          const smsResult = await sendSMS(queueItem.phone, messageToSend, queueItem.lead_id);

          if (smsResult.success) {
            // Update queue item as sent
            await supabase
              .from('outreach_queue')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                message_sid: smsResult.messageSid
              })
              .eq('id', queueId);

            // Update lead contact attempts
            await supabase
              .from('maxsam_leads')
              .update({
                contact_attempts: (queueItem.contact_attempts || 0) + 1,
                last_contact_date: new Date().toISOString(),
                last_contacted_at: new Date().toISOString()
              })
              .eq('id', queueItem.lead_id);

            results.push({ id: queueId, success: true });
          } else {
            results.push({ id: queueId, success: false, error: smsResult.error });
          }
        }
      } else if (action === 'reject') {
        const { error } = await supabase.rpc('reject_outreach_message', {
          p_queue_id: queueId,
          p_reviewer: reviewer || 'dashboard',
          p_notes: notes
        });

        results.push({
          id: queueId,
          success: !error,
          error: error?.message
        });
      } else if (action === 'send_all_approved') {
        // Send all approved messages that haven't been sent yet
        const { data: approvedMessages } = await supabase
          .from('outreach_queue')
          .select('*')
          .eq('status', 'approved')
          .order('created_at');

        for (const msg of approvedMessages || []) {
          const messageToSend = msg.customized_message || msg.message_preview;
          const smsResult = await sendSMS(msg.phone, messageToSend, msg.lead_id);

          if (smsResult.success) {
            await supabase
              .from('outreach_queue')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                message_sid: smsResult.messageSid
              })
              .eq('id', msg.id);

            results.push({ id: msg.id, success: true });
          } else {
            results.push({ id: msg.id, success: false, error: smsResult.error });
          }

          // Rate limit delay
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      action,
      results,
      summary: { successful, failed, total: results.length }
    });
  } catch (error) {
    console.error('Outreach queue PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process queue action' },
      { status: 500 }
    );
  }
}
