import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/sms/sync-twilio
 * Pulls latest SMS history from Twilio's Messages API into sms_messages table.
 * Syncs delivery statuses and captures any replies we may have missed.
 */
export async function POST() {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioPhone) {
      return NextResponse.json(
        { success: false, error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    // Fetch recent messages from Twilio (last 7 days, up to 200)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?PageSize=200&DateSent%3E=${sevenDaysAgo}`

    const response = await fetch(twilioUrl, {
      headers: { Authorization: authHeader },
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { success: false, error: `Twilio API error: ${errorData.message || response.statusText}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    const twilioMessages = data.messages || []

    if (twilioMessages.length === 0) {
      return NextResponse.json({ success: true, synced: 0, updated: 0, message: 'No messages found in Twilio' })
    }

    // Build a set of existing twilio_sids to avoid duplicates
    const sids = twilioMessages.map((m: { sid: string }) => m.sid)
    const { data: existingRows } = await supabase
      .from('sms_messages')
      .select('twilio_sid, status')
      .in('twilio_sid', sids)

    const existingBySid = new Map<string, string>()
    for (const row of existingRows || []) {
      if (row.twilio_sid) existingBySid.set(row.twilio_sid, row.status || '')
    }

    // Load leads for phone matching
    const { data: leadsRows } = await supabase
      .from('maxsam_leads')
      .select('id, phone, phone_1, phone_2')

    const leadByPhone = new Map<string, string>()
    for (const lead of leadsRows || []) {
      for (const ph of [lead.phone, lead.phone_1, lead.phone_2]) {
        const normalized = normalizePhone(ph)
        if (normalized && normalized.length >= 10) leadByPhone.set(normalized, lead.id)
      }
    }

    let syncedCount = 0
    let updatedCount = 0

    for (const msg of twilioMessages) {
      const sid = msg.sid as string
      const twilioStatus = (msg.status as string || '').toLowerCase()
      const direction = (msg.direction as string || '').includes('inbound') ? 'inbound' : 'outbound'
      const fromNumber = msg.from as string || ''
      const toNumber = msg.to as string || ''
      const body = msg.body as string || ''
      const dateSent = msg.date_sent as string || msg.date_created as string || ''

      // Determine the contact phone (the non-Twilio number)
      const contactPhone = direction === 'inbound' ? fromNumber : toNumber
      const normalizedContact = normalizePhone(contactPhone)
      const leadId = leadByPhone.get(normalizedContact) || null

      if (existingBySid.has(sid)) {
        // Update delivery status if changed
        const currentStatus = existingBySid.get(sid)
        if (currentStatus !== twilioStatus) {
          await supabase
            .from('sms_messages')
            .update({ status: twilioStatus })
            .eq('twilio_sid', sid)
          updatedCount++
        }
      } else {
        // Insert new message
        await supabase.from('sms_messages').insert({
          lead_id: leadId,
          direction,
          message: body,
          from_number: fromNumber,
          to_number: toNumber,
          status: twilioStatus,
          twilio_sid: sid,
          created_at: dateSent || new Date().toISOString(),
        })
        syncedCount++
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      updated: updatedCount,
      total_from_twilio: twilioMessages.length,
      message: `Synced ${syncedCount} new messages, updated ${updatedCount} statuses`,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to sync Twilio'
    console.error('[sync-twilio] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

function normalizePhone(phone: unknown): string {
  return String(phone || '').replace(/^\+1/, '').replace(/\D/g, '')
}
