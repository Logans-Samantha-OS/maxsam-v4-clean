import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/sms/sync-twilio
 *
 * Pulls SMS history from Twilio REST API and backfills into sms_messages table.
 * Skips messages that already exist (matched on twilio_sid / message_sid).
 */
export async function POST() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '+18449632549'

    if (!accountSid || !authToken) {
      return NextResponse.json({ success: false, error: 'Twilio not configured' }, { status: 500 })
    }

    const supabase = createClient()
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    // Fetch outbound messages (from our number)
    const outboundUrl = `${baseUrl}?From=${encodeURIComponent(twilioPhone)}&PageSize=500`
    const outboundRes = await fetch(outboundUrl, {
      headers: { Authorization: `Basic ${auth}` },
    })
    const outboundData = await outboundRes.json()
    const outboundMessages = outboundData.messages || []

    // Fetch inbound messages (to our number)
    const inboundUrl = `${baseUrl}?To=${encodeURIComponent(twilioPhone)}&PageSize=500`
    const inboundRes = await fetch(inboundUrl, {
      headers: { Authorization: `Basic ${auth}` },
    })
    const inboundData = await inboundRes.json()
    const inboundMessages = inboundData.messages || []

    // Combine and deduplicate by SID
    const allMessages = [...outboundMessages, ...inboundMessages]
    const uniqueMap = new Map<string, typeof allMessages[0]>()
    for (const msg of allMessages) {
      if (msg.sid && !uniqueMap.has(msg.sid)) {
        uniqueMap.set(msg.sid, msg)
      }
    }
    const uniqueMessages = Array.from(uniqueMap.values())

    // Get existing SIDs to skip
    const sids = uniqueMessages.map((m) => m.sid)
    const { data: existingRows } = await supabase
      .from('sms_messages')
      .select('twilio_sid, message_sid')
      .or(
        sids.map((s) => `twilio_sid.eq.${s},message_sid.eq.${s}`).join(',')
      )

    const existingSids = new Set<string>()
    if (existingRows) {
      for (const row of existingRows) {
        if (row.twilio_sid) existingSids.add(row.twilio_sid)
        if (row.message_sid) existingSids.add(row.message_sid)
      }
    }

    // Build phone → lead_id lookup
    const { data: leads } = await supabase
      .from('leads')
      .select('id, phone, phone_1, phone_2')

    const phoneToLeadId = new Map<string, string>()
    if (leads) {
      for (const lead of leads) {
        for (const ph of [lead.phone, lead.phone_1, lead.phone_2]) {
          if (ph) {
            const digits = String(ph).replace(/\D/g, '')
            if (digits.length >= 10) {
              phoneToLeadId.set(digits.slice(-10), lead.id)
            }
          }
        }
      }
    }

    function findLeadId(phone: string): string | null {
      const digits = phone.replace(/\D/g, '')
      return phoneToLeadId.get(digits.slice(-10)) || null
    }

    // Insert new messages
    let inserted = 0
    let skipped = 0

    for (const msg of uniqueMessages) {
      if (existingSids.has(msg.sid)) {
        skipped++
        continue
      }

      const isOutbound = msg.from === twilioPhone || msg.from === twilioPhone.replace('+', '')
      const direction = isOutbound ? 'outbound' : 'inbound'
      const otherPhone = isOutbound ? msg.to : msg.from
      const leadId = findLeadId(otherPhone)

      const row = {
        lead_id: leadId,
        direction,
        message: msg.body || '',
        from_number: msg.from || '',
        to_number: msg.to || '',
        status: mapTwilioStatus(msg.status),
        twilio_sid: msg.sid,
        created_at: msg.date_created || new Date().toISOString(),
      }

      const { error } = await supabase.from('sms_messages').insert(row)
      if (!error) {
        inserted++
      } else {
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      fetched: uniqueMessages.length,
      inserted,
      skipped,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    console.error('[SMS Sync] Error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

function mapTwilioStatus(status: string): string {
  const map: Record<string, string> = {
    delivered: 'delivered',
    sent: 'sent',
    queued: 'queued',
    sending: 'sending',
    failed: 'failed',
    undelivered: 'undelivered',
    received: 'received',
  }
  return map[status?.toLowerCase()] || status || 'unknown'
}
