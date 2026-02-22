import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logExecution } from '@/lib/ops/logExecution'

export const runtime = 'nodejs'

type SmsRow = Record<string, unknown>
type LeadRow = {
  id: string
  owner_name: string | null
  phone: string | null
  excess_funds_amount: number | null
  case_number: string | null
  property_address: string | null
  eleanor_score: number | null
  eleanor_grade: string | null
  status: string | null
}

const normalizePhone = (phone: unknown): string =>
  String(phone || '').replace(/^\+1/, '').replace(/\D/g, '')

function getSmsPhone(row: SmsRow): string {
  const direction = String(row.direction || '')
  const toPhone = row.to_phone || row.to_number
  const fromPhone = row.from_phone || row.from_number
  return normalizePhone(direction === 'inbound' ? fromPhone : toPhone)
}

function getMessageText(row: SmsRow): string {
  return String(row.message_body || row.message || row.body || '')
}

export async function GET(req: NextRequest) {
  const executionId = await logExecution({
    status: 'received',
    workflowName: 'conversations_list',
    webhookPath: '/api/conversations',
  })

  try {
    await logExecution({
      id: executionId || undefined,
      status: 'running',
      workflowName: 'conversations_list',
      webhookPath: '/api/conversations',
    })

    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit') || 100)

    const { data: smsRows, error: smsError } = await supabase
      .from('sms_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (smsError) {
      return NextResponse.json({ success: true, conversations: [], warning: smsError.message })
    }

    const { data: leadsRows, error: leadsError } = await supabase
      .from('leads')
      .select('id, owner_name, phone, excess_funds_amount, case_number, property_address, eleanor_score, eleanor_grade, status')

    const leads = leadsError ? [] : ((leadsRows || []) as LeadRow[])
    const leadById = new Map(leads.map((lead) => [lead.id, lead]))
    const leadByPhone = new Map<string, LeadRow>()
    for (const lead of leads) {
      const phone = normalizePhone(lead.phone)
      if (phone) leadByPhone.set(phone, lead)
    }

    const conversationMap = new Map<string, {
      phone: string
      lead: LeadRow | null
      last_message: string
      last_direction: string
      last_message_at: string
      message_count: number
    }>()

    for (const row of (smsRows || []) as SmsRow[]) {
      const phone = getSmsPhone(row)
      if (!phone) continue

      const lead = (row.lead_id ? leadById.get(String(row.lead_id)) : undefined) || leadByPhone.get(phone) || null
      const existing = conversationMap.get(phone)
      if (!existing) {
        conversationMap.set(phone, {
          phone,
          lead,
          last_message: getMessageText(row),
          last_direction: String(row.direction || 'outbound'),
          last_message_at: String(row.created_at || ''),
          message_count: 1,
        })
      } else {
        existing.message_count += 1
      }
    }

    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
      .slice(0, limit)
      .map((conv) => ({
        phone: conv.phone,
        lead_id: conv.lead?.id || null,
        owner_name: conv.lead?.owner_name || 'Unknown',
        excess_funds_amount: Number(conv.lead?.excess_funds_amount || 0),
        case_number: conv.lead?.case_number || '',
        property_address: conv.lead?.property_address || '',
        eleanor_score: Number(conv.lead?.eleanor_score || 0),
        eleanor_grade: conv.lead?.eleanor_grade || 'N/A',
        lead_status: conv.lead?.status || 'unknown',
        last_message: conv.last_message,
        last_direction: conv.last_direction,
        last_message_at: conv.last_message_at,
        message_count: conv.message_count,
      }))

    await logExecution({
      id: executionId || undefined,
      status: 'success',
      workflowName: 'conversations_list',
      webhookPath: '/api/conversations',
      artifacts: { count: conversations.length },
    })

    return NextResponse.json({ success: true, conversations })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch conversations'
    await logExecution({
      id: executionId || undefined,
      status: 'failure',
      workflowName: 'conversations_list',
      webhookPath: '/api/conversations',
      errorText: message,
    })
    return NextResponse.json({ success: true, conversations: [], warning: message })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const phone = String(body?.phone || '').trim()
    const leadId = body?.lead_id as string | null
    const message = String(body?.message || '').trim()

    if (!phone || !message) {
      return NextResponse.json({ success: false, error: 'phone and message are required' }, { status: 400 })
    }

    const { sendSMS } = await import('@/lib/twilio')
    const result = await sendSMS(phone, message, leadId || undefined)
    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 500 })

    const smsResult = result as { sid?: string; messageSid?: string }
    return NextResponse.json({ success: true, message_sid: smsResult.sid || smsResult.messageSid || null })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send message'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
