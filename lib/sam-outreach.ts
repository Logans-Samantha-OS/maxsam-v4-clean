/**
 * Sam AI - Autonomous Outreach Engine
 * Handles intelligent, TCPA-compliant outreach to leads
 */

import { sendSMS, isTwilioConfigured, normalizePhone } from './twilio';
import { SMS_TEMPLATES, getNextTemplate, buildTemplateData } from './sms-templates';
import { createClient } from './supabase/server';

interface Lead {
  id: string;
  owner_name: string | null;
  phone: string | null;
  phone_1: string | null;
  phone_2: string | null;
  property_address: string | null;
  excess_funds_amount: number | null;
  deal_grade: string | null;
  deal_type: string | null;
  contact_priority: string | null;
  contact_attempts: number;
  last_contact_date: string | null;
  status: string;
  created_at: string;
}

interface OutreachResult {
  leadId: string;
  success: boolean;
  action: string;
  error?: string;
}

interface BatchResult {
  processed: number;
  successful: number;
  skipped: number;
  errors: string[];
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  return (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Determine if a lead is ready for outreach
 */
function isReadyForOutreach(lead: Lead): boolean {
  const attempts = lead.contact_attempts || 0;
  const lastContact = lead.last_contact_date ? new Date(lead.last_contact_date) : null;
  const created = new Date(lead.created_at);
  const now = new Date();
  const daysSinceCreated = daysBetween(created, now);
  const daysSinceLastContact = lastContact ? daysBetween(lastContact, now) : daysSinceCreated;
  const isHot = ['A+', 'A'].includes(lead.deal_grade || '');

  // Max attempts reached
  if (attempts >= 5) {
    return false;
  }

  // No phone number
  const phone = lead.phone || lead.phone_1 || lead.phone_2;
  if (!phone) {
    return false;
  }

  // Status doesn't allow outreach
  if (['qualified', 'contract_sent', 'contract_signed', 'closed', 'dead'].includes(lead.status)) {
    return false;
  }

  // Determine timing based on priority
  if (isHot) {
    // Aggressive cadence for hot leads
    if (attempts === 0) return true;
    if (attempts === 1 && daysSinceLastContact >= 0.25) return true; // 6 hours
    if (attempts === 2 && daysSinceLastContact >= 1) return true;
    if (attempts === 3 && daysSinceLastContact >= 2) return true;
    if (attempts === 4 && daysSinceLastContact >= 3) return true;
  } else {
    // Slower cadence for warm/cold leads
    if (attempts === 0) return true;
    if (attempts === 1 && daysSinceLastContact >= 2) return true;
    if (attempts === 2 && daysSinceLastContact >= 4) return true;
    if (attempts === 3 && daysSinceLastContact >= 7) return true;
  }

  return false;
}

/**
 * Execute outreach for a single lead
 */
export async function executeOutreach(lead: Lead): Promise<OutreachResult> {
  if (!isTwilioConfigured()) {
    return {
      leadId: lead.id,
      success: false,
      action: 'skipped',
      error: 'Twilio not configured'
    };
  }

  // Check if ready for outreach
  if (!isReadyForOutreach(lead)) {
    return {
      leadId: lead.id,
      success: false,
      action: 'skipped',
      error: 'Not ready for outreach'
    };
  }

  const phone = lead.phone || lead.phone_1 || lead.phone_2;
  if (!phone) {
    return {
      leadId: lead.id,
      success: false,
      action: 'skipped',
      error: 'No phone number'
    };
  }

  // Determine which template to use
  const dealType = (lead.deal_type || 'excess_only') as 'dual' | 'excess_only' | 'wholesale';
  const templateKey = getNextTemplate(lead.contact_attempts || 0, dealType, lead.status);

  if (!templateKey) {
    return {
      leadId: lead.id,
      success: false,
      action: 'skipped',
      error: 'Max attempts reached'
    };
  }

  // Build template data and message
  const templateData = buildTemplateData(lead);
  const template = SMS_TEMPLATES[templateKey];
  const message = template(templateData);

  // Send SMS
  const result = await sendSMS(phone, message, lead.id);

  if (result.success) {
    // Update lead in database
    const supabase = createClient();

    await supabase.from('maxsam_leads').update({
      contact_attempts: (lead.contact_attempts || 0) + 1,
      last_contact_date: new Date().toISOString(),
      status: lead.contact_attempts === 0 ? 'contacted' : lead.status
    }).eq('id', lead.id);

    // Log status change if first contact
    if (lead.contact_attempts === 0) {
      await supabase.from('status_history').insert({
        lead_id: lead.id,
        old_status: lead.status,
        new_status: 'contacted',
        changed_by: 'sam_outreach',
        reason: `First SMS sent using ${templateKey} template`
      });
    }

    return {
      leadId: lead.id,
      success: true,
      action: `SMS sent: ${templateKey}`
    };
  }

  return {
    leadId: lead.id,
    success: false,
    action: 'failed',
    error: result.error
  };
}

/**
 * Run batch outreach for multiple leads
 */
export async function runOutreachBatch(limit: number = 20): Promise<BatchResult> {
  const supabase = createClient();

  // Get leads ready for outreach
  const { data: leads } = await supabase
    .from('maxsam_leads')
    .select('*')
    .in('status', ['new', 'scored', 'contacted'])
    .lt('contact_attempts', 5)
    .order('eleanor_score', { ascending: false })
    .limit(limit * 2); // Fetch more than needed since some will be skipped

  if (!leads || leads.length === 0) {
    return {
      processed: 0,
      successful: 0,
      skipped: 0,
      errors: []
    };
  }

  let processed = 0;
  let successful = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    if (processed >= limit) break;

    const result = await executeOutreach(lead);

    if (result.action === 'skipped') {
      skipped++;
    } else {
      processed++;

      if (result.success) {
        successful++;
      } else {
        errors.push(`${lead.owner_name || lead.id}: ${result.error}`);
      }
    }

    // Small delay between messages to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { processed, successful, skipped, errors };
}

/**
 * Process an inbound SMS response
 */
export async function processInboundSMS(
  from: string,
  body: string
): Promise<{ response: string; action: string }> {
  const supabase = createClient();
  const normalizedPhone = normalizePhone(from);
  const lowerBody = body.toLowerCase().trim();

  // Check for opt-out keywords
  const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'quit', 'end', 'remove', 'optout', 'opt out'];
  if (optOutKeywords.some(keyword => lowerBody.includes(keyword))) {
    // Add to opt-out list
    await supabase.from('opt_outs').upsert({
      phone: normalizedPhone,
      source: 'sms',
      opted_out_at: new Date().toISOString()
    });

    // Update any leads with this phone to dead
    await supabase.from('maxsam_leads')
      .update({ status: 'dead' })
      .or(`phone.eq.${normalizedPhone},phone_1.eq.${normalizedPhone},phone_2.eq.${normalizedPhone}`);

    return {
      response: 'You have been unsubscribed. You will not receive further messages from MaxSam Real Estate.',
      action: 'opted_out'
    };
  }

  // Check for positive response
  const positiveKeywords = ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'interested', 'help', 'tell me more', 'info'];
  if (positiveKeywords.some(keyword => lowerBody.includes(keyword))) {
    // Find lead by phone and update to qualified
    const { data: lead } = await supabase
      .from('maxsam_leads')
      .select('*')
      .or(`phone.eq.${normalizedPhone},phone_1.eq.${normalizedPhone},phone_2.eq.${normalizedPhone}`)
      .in('status', ['new', 'scored', 'contacted'])
      .single();

    if (lead) {
      await supabase.from('maxsam_leads')
        .update({ status: 'qualified' })
        .eq('id', lead.id);

      // Log status change
      await supabase.from('status_history').insert({
        lead_id: lead.id,
        old_status: lead.status,
        new_status: 'qualified',
        changed_by: 'sms_inbound',
        reason: `Positive SMS response: "${body}"`
      });

      // Log communication
      await supabase.from('communication_logs').insert({
        lead_id: lead.id,
        type: 'sms',
        direction: 'inbound',
        from_number: normalizedPhone,
        to_number: process.env.TWILIO_PHONE_NUMBER,
        content: body,
        status: 'received',
        sentiment: 'positive',
        created_at: new Date().toISOString()
      });

      // Send Telegram notification
      await sendTelegramNotification(lead, body);

      const templateData = buildTemplateData(lead);
      const response = SMS_TEMPLATES.qualified(templateData);

      return {
        response,
        action: 'qualified'
      };
    }
  }

  // Log unknown response
  console.log(`Unknown SMS from ${from}: ${body}`);

  return {
    response: '', // No auto-response for unknown messages
    action: 'unknown'
  };
}

/**
 * Send Telegram notification for hot lead
 */
async function sendTelegramNotification(lead: Lead, response: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return;
  }

  const message = `🔥 HOT LEAD RESPONDED!

${lead.owner_name} replied YES!

Property: ${lead.property_address}
Excess Funds: $${(lead.excess_funds_amount || 0).toLocaleString()}
Phone: ${lead.phone || lead.phone_1 || lead.phone_2}

Their response: "${response}"

Send contract NOW!`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }
}

/**
 * Get outreach statistics
 */
export async function getOutreachStats(): Promise<{
  totalSent: number;
  todaySent: number;
  responseRate: number;
  optOutRate: number;
}> {
  const supabase = createClient();

  const today = new Date().toISOString().split('T')[0];

  const { count: totalSent } = await supabase
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'sms')
    .eq('direction', 'outbound');

  const { count: todaySent } = await supabase
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'sms')
    .eq('direction', 'outbound')
    .gte('created_at', today);

  const { count: responses } = await supabase
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'sms')
    .eq('direction', 'inbound')
    .eq('sentiment', 'positive');

  const { count: optOuts } = await supabase
    .from('opt_outs')
    .select('*', { count: 'exact', head: true });

  const responseRate = totalSent ? ((responses || 0) / totalSent) * 100 : 0;
  const optOutRate = totalSent ? ((optOuts || 0) / totalSent) * 100 : 0;

  return {
    totalSent: totalSent || 0,
    todaySent: todaySent || 0,
    responseRate: Math.round(responseRate * 10) / 10,
    optOutRate: Math.round(optOutRate * 10) / 10
  };
}
