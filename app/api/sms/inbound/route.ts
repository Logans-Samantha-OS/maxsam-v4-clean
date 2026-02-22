import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTelegramMessage } from '@/lib/telegram'

export const runtime = 'nodejs'

// Positive-intent keywords that trigger auto-agreement flow
const ENGAGED_KEYWORDS = ['1', 'yes', 'yeah', 'yep', 'yea', 'interested', 'sure', 'ok', 'okay', 'sign me up', 'lets do it', "let's do it", 'i want', 'claim', 'ready']
const STOP_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'end', 'remove', 'optout', 'opt out']

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * POST /api/sms/inbound
 * Twilio webhook for inbound SMS. Handles:
 * - Logging inbound messages to sms_messages
 * - Auto-triggering agreement workflow on positive intent
 * - Opt-out / DNC on STOP keywords
 * - Telegram notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Twilio sends form-encoded data
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string
    const to = formData.get('To') as string
    const messageSid = formData.get('MessageSid') as string

    if (!from || !body) {
      return twiml()
    }

    console.log(`[sms/inbound] From: ${from}, Body: ${body}`)

    const supabase = createClient()
    const normalizedFrom = normalizePhone(from)
    const lowerBody = body.toLowerCase().trim()

    // 1. Look up the lead by phone number
    const { data: lead } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, phone, status, excess_funds_amount, property_address, is_golden_lead, golden_lead, eleanor_score')
      .or(`phone.eq.${normalizedFrom},phone_1.eq.${normalizedFrom},phone_2.eq.${normalizedFrom}`)
      .single()

    // 2. Log the inbound message to sms_messages
    const messageRow = {
      lead_id: lead?.id || null,
      direction: 'inbound' as const,
      message: body,
      from_number: normalizedFrom,
      to_number: to || process.env.TWILIO_PHONE_NUMBER || '',
      status: 'received',
      twilio_sid: messageSid || null,
      created_at: new Date().toISOString(),
    }

    await supabase.from('sms_messages').insert(messageRow)

    // 3. Send Telegram notification
    const isGolden = lead?.is_golden_lead || lead?.golden_lead
    const amount = lead?.excess_funds_amount
      ? `$${Math.round(Number(lead.excess_funds_amount) / 1000)}K`
      : 'Unknown'

    if (lead) {
      await sendTelegramMessage(
        `${isGolden ? '🥇' : '📱'} <b>INBOUND SMS</b>\n\n` +
        `<b>From:</b> ${lead.owner_name || 'Unknown'}${isGolden ? ' GOLDEN' : ''}\n` +
        `<b>Amount:</b> ${amount}\n` +
        `<b>Property:</b> ${lead.property_address || 'N/A'}\n\n` +
        `💬 <i>"${body.length > 100 ? body.substring(0, 100) + '...' : body}"</i>\n\n` +
        `${normalizedFrom}`
      ).catch(() => {}) // Non-critical
    } else {
      await sendTelegramMessage(
        `📱 <b>INBOUND SMS - UNKNOWN</b>\n\n` +
        `<b>From:</b> ${normalizedFrom}\n\n` +
        `💬 <i>"${body.length > 100 ? body.substring(0, 100) + '...' : body}"</i>\n\n` +
        `⚠️ No matching lead found`
      ).catch(() => {})
    }

    // 4. Check for STOP / opt-out keywords
    if (STOP_KEYWORDS.some(kw => lowerBody.includes(kw))) {
      if (lead) {
        // Update lead: sms_opt_out + do_not_contact
        await supabase
          .from('maxsam_leads')
          .update({
            sms_opt_out: true,
            do_not_contact: true,
            status: 'dead',
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id)
      }

      // Insert into sms_blocklist
      await supabase.from('sms_blocklist').upsert(
        {
          phone: normalizedFrom,
          reason: 'opt_out',
          source: 'inbound_sms',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'phone' }
      )

      // Also add to opt_outs table (used by lib/twilio.ts)
      await supabase.from('opt_outs').upsert({
        phone: normalizedFrom,
        source: 'sms',
        opted_out_at: new Date().toISOString(),
      })

      await sendTelegramMessage(
        `🛑 <b>OPT-OUT</b>\n${lead?.owner_name || normalizedFrom} replied STOP`
      ).catch(() => {})

      return twiml('You have been unsubscribed. You will not receive further messages.')
    }

    // 5. Check for positive intent -> auto-trigger agreement
    if (lead && ENGAGED_KEYWORDS.some(kw => lowerBody === kw || lowerBody.includes(kw))) {
      // Update lead status to 'engaged'
      await supabase
        .from('maxsam_leads')
        .update({
          status: 'engaged',
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)

      // Trigger agreement workflow via n8n
      try {
        await fetch('https://skooki.app.n8n.cloud/webhook/send-agreement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            name: lead.owner_name,
            agreement_type: 'excess_funds',
          }),
        })
      } catch (webhookErr) {
        console.error('[sms/inbound] n8n webhook error:', webhookErr)
      }

      // Log agent action
      await supabase.from('agent_memories').insert({
        agent_name: 'SAM',
        action_type: 'auto_agreement_triggered',
        content: `Positive reply from ${lead.owner_name} ("${body}") → triggered agreement workflow`,
        lead_id: lead.id,
        created_at: new Date().toISOString(),
      }).then(() => {}, () => {}) // Non-critical

      await sendTelegramMessage(
        `🤝 <b>AUTO-AGREEMENT TRIGGERED</b>\n\n` +
        `<b>${lead.owner_name}</b> replied "${body}"\n` +
        `Amount: ${amount}\n\n` +
        `Agreement workflow dispatched automatically.`
      ).catch(() => {})

      return twiml()
    }

    // 6. No special action - just logged the message
    return twiml()
  } catch (error: unknown) {
    console.error('[sms/inbound] Error:', error)
    return twiml()
  }
}

/** Return empty TwiML so Twilio doesn't retry */
function twiml(message?: string): NextResponse {
  if (message) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  )
}
