import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendSMS } from '@/lib/twilio'
import crypto from 'crypto'

/**
 * POST /api/leads/[id]/agreement - Generate and send agreement signing link
 *
 * Uses self-hosted e-signature system (/sign page with HMAC tokens).
 * Sends signing link via Twilio SMS.
 *
 * Body:
 * - type: 'excess_funds' | 'wholesale' | 'both' (default: 'excess_funds')
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { type = 'excess_funds' } = body

    const secret = process.env.SIGNING_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Signing system not configured. Set SIGNING_SECRET.' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const supabase = createClient()

    // Get lead info
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const phone = lead.phone || lead.phone_1 || lead.phone_2
    if (!phone) {
      return NextResponse.json({ error: 'No phone number for this lead' }, { status: 400 })
    }

    // Generate signing URL
    function makeSigningUrl(agreementType: string): string {
      const expires = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
      const payload = `${id}:${agreementType}:${expires}`
      const hmac = crypto.createHmac('sha256', secret!).update(payload).digest('hex')
      const token = Buffer.from(`${payload}:${hmac}`).toString('base64url')
      return `${baseUrl}/sign?token=${token}`
    }

    // Extract first name
    let firstName = 'there'
    if (lead.owner_name) {
      const name = lead.owner_name.trim()
      if (name.includes(',')) {
        const parts = name.split(',')
        const first = (parts[1] || '').trim().split(/\s+/)[0]
        if (first) firstName = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
      } else {
        const first = name.split(/\s+/)[0]
        firstName = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
      }
    }

    const excessAmount = lead.excess_funds_amount || 0
    const amt = excessAmount > 0
      ? `$${Number(excessAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : ''

    const links: string[] = []
    let smsMessage = ''

    if (type === 'excess_funds' || type === 'both') {
      const excessUrl = makeSigningUrl('excess_funds')
      links.push(excessUrl)

      if (type === 'both') {
        const wholesaleUrl = makeSigningUrl('wholesale')
        links.push(wholesaleUrl)
        smsMessage = `${firstName}, your recovery agreements for ${lead.property_address || 'your property'} are ready to sign.`
        if (amt) smsMessage += ` Est. recovery: ${amt}.`
        smsMessage += `\n\nExcess Funds Agreement: ${excessUrl}`
        smsMessage += `\n\nWholesale Agreement: ${wholesaleUrl}`
        smsMessage += `\n\nSign on your phone in 60 seconds. No upfront cost.\n\n-Sam, MaxSam Recovery`
      } else {
        smsMessage = `${firstName}, your Excess Funds Recovery Agreement for ${lead.property_address || 'your property'} is ready to sign.`
        if (amt) smsMessage += ` Est. recovery: ${amt}.`
        smsMessage += `\n\nSign on your phone in 60 seconds: ${excessUrl}`
        smsMessage += `\n\nNo upfront cost — we only get paid when you do.\n\n-Sam, MaxSam Recovery`
      }
    } else if (type === 'wholesale' || type === 'distressed_property') {
      const wholesaleUrl = makeSigningUrl('wholesale')
      links.push(wholesaleUrl)
      smsMessage = `${firstName}, your Wholesale Agreement for ${lead.property_address || 'your property'} is ready to sign.`
      smsMessage += `\n\nSign on your phone in 60 seconds: ${wholesaleUrl}`
      smsMessage += `\n\nNo upfront cost.\n\n-Sam, MaxSam Recovery`
    }

    // Send SMS
    const smsResult = await sendSMS(phone, smsMessage, id)

    // Update lead status
    await supabase
      .from('maxsam_leads')
      .update({
        status: 'agreement_sent',
        agreement_type: type === 'both' ? 'both' : type === 'distressed_property' ? 'wholesale' : type,
        last_contact_at: new Date().toISOString(),
        contact_attempts: (lead.contact_attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      message: `Agreement link(s) sent to ${lead.owner_name}`,
      links,
      type,
      sms_sent: smsResult.success,
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send agreement'
    console.error('Agreement send error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
