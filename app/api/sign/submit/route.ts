import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { notifyContractSigned } from '@/lib/telegram'

export const runtime = 'nodejs'

/**
 * POST /api/sign/submit
 *
 * Stores the signed agreement in signed_agreements table with full UETA audit trail.
 * Updates leads table status → 'agreement_signed'.
 * Fires webhook to N8N at https://skooki.app.n8n.cloud/webhook/agreement-signed.
 *
 * Body: {
 *   token: string,
 *   typed_name: string,
 *   signature_image: string,   // base64 data URL from canvas
 *   consent_text: string,      // exact consent wording shown to user
 *   screen_size: string,
 *   timezone: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const headersList = await headers()

    // Required fields
    if (!body.token) return NextResponse.json({ error: 'Token required' }, { status: 400 })
    if (!body.typed_name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    if (!body.signature_image) return NextResponse.json({ error: 'Signature required' }, { status: 400 })

    // Verify token
    const secret = process.env.SIGNING_SECRET
    if (!secret) return NextResponse.json({ error: 'Signing not configured' }, { status: 500 })

    let decoded: string
    try {
      decoded = Buffer.from(body.token, 'base64url').toString('utf-8')
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    const parts = decoded.split(':')
    if (parts.length !== 4) return NextResponse.json({ error: 'Malformed token' }, { status: 400 })

    const [leadId, agreementType, expiresStr, providedHmac] = parts
    const expires = parseInt(expiresStr, 10)

    const payload = `${leadId}:${agreementType}:${expiresStr}`
    const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    try {
      if (!crypto.timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    if (Date.now() > expires) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 })
    }

    // UETA audit data
    const clientIp = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip') || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'
    const signedAt = new Date().toISOString()

    const supabase = createClient()

    // Check duplicate
    const { data: existing } = await supabase
      .from('signed_agreements')
      .select('id')
      .eq('lead_id', leadId)
      .eq('agreement_type', agreementType)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        error: 'already_signed',
        message: 'This agreement has already been signed.',
      }, { status: 409 })
    }

    // Fetch lead for name verification and webhook data
    const { data: lead } = await supabase
      .from('leads')
      .select('id, owner_name, excess_amount, case_number, cause_number, county, phone, primary_phone, email, primary_email, property_address')
      .eq('id', leadId)
      .single()

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Name verification (case-insensitive)
    if (body.typed_name.trim().toLowerCase() !== lead.owner_name?.trim().toLowerCase()) {
      return NextResponse.json({ error: 'Name does not match our records' }, { status: 400 })
    }

    // Insert signed agreement
    const { data: agreement, error: insertErr } = await supabase
      .from('signed_agreements')
      .insert({
        lead_id: leadId,
        agreement_type: agreementType,
        typed_name: body.typed_name.trim(),
        signature_image: body.signature_image,
        consent_given: true,
        consent_text: body.consent_text || `I, ${body.typed_name.trim()}, agree and sign this agreement electronically.`,
        ip_address: clientIp,
        user_agent: userAgent,
        screen_size: body.screen_size || 'unknown',
        timezone: body.timezone || 'unknown',
        signed_at: signedAt,
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[Sign Submit] Insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to store agreement' }, { status: 500 })
    }

    // Update lead status
    await supabase
      .from('leads')
      .update({
        status: 'agreement_signed',
        agreement_signed_at: signedAt,
        agreement_type: agreementType,
      })
      .eq('id', leadId)

    // Also update agreement_packets if any exist (match both upper and lowercase)
    await supabase
      .from('agreement_packets')
      .update({ status: 'signed', signed_at: signedAt })
      .eq('lead_id', leadId)
      .in('status', ['draft', 'ready_to_send', 'sent', 'viewed', 'partially_signed', 'DRAFT', 'READY_TO_SEND', 'SENT', 'VIEWED', 'PARTIALLY_SIGNED'])

    // Fire N8N webhook (async, don't block response)
    const webhookPayload = {
      event: 'agreement_signed',
      agreement_id: agreement.id,
      lead_id: leadId,
      agreement_type: agreementType,
      owner_name: lead.owner_name,
      property_address: lead.property_address,
      excess_amount: lead.excess_amount || 0,
      case_number: lead.case_number || lead.cause_number || '',
      county: lead.county || 'Dallas',
      phone: lead.phone || lead.primary_phone || '',
      email: lead.email || lead.primary_email || '',
      typed_name: body.typed_name.trim(),
      ip_address: clientIp,
      signed_at: signedAt,
    }

    fireWebhook(webhookPayload).catch(err => {
      console.error('[Sign Submit] Webhook error:', err)
    })

    // Send Telegram notification (non-blocking)
    const excessAmount = Number(lead.excess_amount || 0)
    const feePercent = agreementType === 'wholesale' ? 10 : 25
    notifyContractSigned({
      seller_name: lead.owner_name || 'Unknown',
      property_address: lead.property_address || 'N/A',
      total_fee: Math.round(excessAmount * (feePercent / 100)),
      contract_type: agreementType,
      next_step: agreementType === 'wholesale'
        ? 'Find buyer & schedule closing with title company'
        : 'File claim with county for excess funds',
    }).catch(err => {
      console.error('[Sign Submit] Telegram error:', err)
    })

    // Create task: "File county claim for {owner_name}"
    try {
      await supabase.from('tasks').insert({
        title: `File county claim for ${lead.owner_name || 'Unknown'}`,
        description: `Agreement signed by ${lead.owner_name}. File excess funds claim with ${lead.county || 'Dallas'} County.\nCase: ${lead.case_number || lead.cause_number || 'N/A'}\nProperty: ${lead.property_address || 'N/A'}\nAmount: $${excessAmount.toLocaleString()}`,
        lead_id: leadId,
        status: 'pending',
        priority: 'high',
        created_at: signedAt,
      })
    } catch {
      console.warn('[Sign Submit] Could not create task (table may not exist)')
    }

    return NextResponse.json({
      success: true,
      agreement_id: agreement.id,
      signed_at: signedAt,
    })
  } catch (error) {
    console.error('[Sign Submit] Error:', error)
    return NextResponse.json({ error: 'Failed to process signature' }, { status: 500 })
  }
}

async function fireWebhook(data: Record<string, unknown>) {
  const url = process.env.N8N_AGREEMENT_SIGNED_WEBHOOK
    || 'https://skooki.app.n8n.cloud/webhook/agreement-signed'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) console.error('[Sign Submit] Webhook failed:', res.status)
    else console.log('[Sign Submit] Webhook fired OK')
  } catch (err) {
    console.error('[Sign Submit] Webhook fetch error:', err)
  }
}
