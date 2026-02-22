import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isSystemPaused } from '@/lib/ops/pause';

const normalizePhone = (phone: string): string => phone.replace(/^\+1/, '').replace(/\D/g, '');

export async function POST(request: NextRequest) {
  try {
    if (await isSystemPaused()) {
      return NextResponse.json({ error: 'System is paused. Dispatch routes are temporarily disabled.' }, { status: 423 });
    }

    const { lead_id, message, template } = await request.json();
    
    // Get lead
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', lead_id)
      .single();
    
    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    
    if (!lead.phone) {
      return NextResponse.json({ error: 'Lead has no phone number' }, { status: 400 });
    }
    
    // Trigger N8N Sam SMS workflow
    const response = await fetch('https://skooki.app.n8n.cloud/webhook/sam-initial-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id,
        phone: lead.phone,
        owner_name: lead.owner_name,
        message,
        template
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send SMS via N8N');
    }
    
    // Log message (if sms_messages table exists)
    try {
      let resolvedLeadId = lead_id;
      if (!resolvedLeadId) {
        const { data: possibleLeads } = await supabase.from('leads').select('id, phone');
        const target = normalizePhone(lead.phone);
        for (const candidate of possibleLeads || []) {
          if (normalizePhone(candidate.phone || '') === target) {
            resolvedLeadId = candidate.id;
            break;
          }
        }
      }

      await supabase.from('sms_messages').insert({
        lead_id: resolvedLeadId,
        direction: 'outbound',
        message,
        to_number: lead.phone,
        from_number: '+18449632549',
        status: 'sent',
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      // Ignore logging errors
    }
    
    // Update lead contact info
    await supabase
      .from('maxsam_leads')
      .update({
        contact_count: (lead.contact_count || 0) + 1,
        last_contacted_at: new Date().toISOString(),
        first_contacted_at: lead.first_contacted_at || new Date().toISOString(),
        status: lead.status === 'new' ? 'contacted' : lead.status
      })
      .eq('id', lead_id);
    
    return NextResponse.json({ success: true, message: 'SMS sent successfully' });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
