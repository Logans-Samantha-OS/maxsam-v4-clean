import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const normalizePhone = (phone: unknown): string =>
  String(phone || '').replace(/^\+1/, '').replace(/\D/g, '')

function mapSmsRow(row: Record<string, unknown>) {
  return {
    id: String(row.id || ''),
    lead_id: row.lead_id ? String(row.lead_id) : null,
    message: String(row.message_body || row.message || row.body || ''),
    direction: String(row.direction || 'outbound'),
    from_number: String(row.from_number || row.from_phone || ''),
    to_number: String(row.to_number || row.to_phone || ''),
    status: String(row.status || 'pending'),
    created_at: String(row.created_at || ''),
  }
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  const phone = searchParams.get('phone')

  try {
    let query = supabase.from('sms_messages').select('*').order('created_at', { ascending: true })

    if (leadId) {
      query = query.eq('lead_id', leadId)
    } else if (phone) {
      const normalized = normalizePhone(phone)
      const { data, error } = await supabase.from('sms_messages').select('*').order('created_at', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const filtered = (data || []).filter((row) => {
        const typedRow = row as Record<string, unknown>
        const from = normalizePhone(typedRow.from_number || typedRow.from_phone)
        const to = normalizePhone(typedRow.to_number || typedRow.to_phone)
        return from === normalized || to === normalized
      })

      return NextResponse.json({ success: true, messages: filtered.map((row) => mapSmsRow(row as Record<string, unknown>)) })
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, messages: (data || []).map((row) => mapSmsRow(row as Record<string, unknown>)) })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  try {
    const reqBody = await request.json()
    const { lead_id, message } = reqBody
    const toNumber = String(reqBody?.to_number || reqBody?.to_phone || '').trim()

    if (!message || !toNumber) {
      return NextResponse.json({ error: 'message and to_number are required' }, { status: 400 })
    }

    const { sendSMS } = await import('@/lib/twilio')
    const twilioResult = await sendSMS(toNumber, String(message), lead_id || undefined)
    if (!twilioResult.success) return NextResponse.json({ error: twilioResult.error || 'Failed to send SMS' }, { status: 400 })

    const now = new Date().toISOString()
    await supabase.from('sms_messages').insert({
      lead_id: lead_id || null,
      direction: 'outbound',
      message: String(message),
      to_number: toNumber,
      from_number: '+18449632549',
      status: 'sent',
      created_at: now,
      twilio_sid: (twilioResult as { sid?: string; messageSid?: string }).sid || (twilioResult as { sid?: string; messageSid?: string }).messageSid || null,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({ success: true, body })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
