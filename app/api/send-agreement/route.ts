/**
 * POST /api/send-agreement
 *
 * Full agreement workflow:
 *   1. Accept lead_id and agreement_type (excess_funds | wholesale)
 *   2. Check system_flags for human-approval gate
 *   3. Call contract-generator to create filled PDF
 *   4. Create row in agreements table (status: draft → sent)
 *   5. Send SMS via Twilio with link to the PDF
 *   6. Update agreement status to "sent"
 *
 * Also supports:
 *   - action: "generate" — generate PDF only (no SMS, stays draft)
 *   - action: "send"    — send an already-generated agreement by ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAgreementPdf, type AgreementType } from '@/lib/contract-generator'
import { sendSMS } from '@/lib/twilio'
import { isPaused } from '@/lib/ops/checkPause'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      lead_id,
      agreement_type,
      agreement_id,
      action = 'generate_and_send',
      skip_approval = false,
    } = body as {
      lead_id?: string
      agreement_type?: AgreementType
      agreement_id?: string
      action?: 'generate' | 'send' | 'generate_and_send'
      skip_approval?: boolean
    }

    const supabase = createClient()

    // ---------------------------------------------------------------
    // Gate: human-approval check via system_flags
    // ---------------------------------------------------------------
    if (!skip_approval && (action === 'send' || action === 'generate_and_send')) {
      const paused = await isPaused()
      if (paused) {
        return NextResponse.json(
          {
            success: false,
            error: 'System is paused. Agreements cannot be sent until an operator resumes the system.',
            requires_approval: true,
          },
          { status: 403 },
        )
      }

      // Check agreement-specific gate
      const { data: agreementGate } = await supabase
        .from('system_flags')
        .select('enabled')
        .eq('flag_key', 'require_agreement_approval')
        .single()

      if (agreementGate?.enabled === true) {
        return NextResponse.json(
          {
            success: false,
            error: 'Agreement sending requires human approval. An operator must approve this action or disable the require_agreement_approval flag.',
            requires_approval: true,
          },
          { status: 403 },
        )
      }
    }

    // ---------------------------------------------------------------
    // Action: SEND (an already-generated agreement)
    // ---------------------------------------------------------------
    if (action === 'send') {
      if (!agreement_id) {
        return NextResponse.json(
          { success: false, error: 'agreement_id is required for send action' },
          { status: 400 },
        )
      }

      const { data: agreement, error: fetchErr } = await supabase
        .from('agreements')
        .select('*')
        .eq('id', agreement_id)
        .single()

      if (fetchErr || !agreement) {
        return NextResponse.json(
          { success: false, error: `Agreement not found: ${agreement_id}` },
          { status: 404 },
        )
      }

      if (!agreement.pdf_url) {
        return NextResponse.json(
          { success: false, error: 'Agreement has no PDF generated yet' },
          { status: 400 },
        )
      }

      if (!agreement.client_phone) {
        return NextResponse.json(
          { success: false, error: 'Agreement has no client phone number' },
          { status: 400 },
        )
      }

      if (['sent', 'signed'].includes(agreement.status)) {
        return NextResponse.json(
          { success: false, error: `Agreement already in status: ${agreement.status}` },
          { status: 400 },
        )
      }

      // Build SMS
      const firstName = extractFirstName(agreement.client_name)
      const typeName = agreement.agreement_type === 'excess_funds'
        ? 'Excess Funds Recovery'
        : 'Real Estate Assignment'
      const smsMessage =
        `${firstName}, your ${typeName} Agreement is ready for review.\n\n` +
        `View & download: ${agreement.pdf_url}\n\n` +
        `No upfront cost — we only get paid when you do.\n\n` +
        `-Sam, MaxSam Recovery`

      const smsResult = await sendSMS(agreement.client_phone, smsMessage, agreement.lead_id)

      // Update status to sent
      await supabase
        .from('agreements')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', agreement_id)

      // Log agent action
      try {
        await supabase.from('agent_memories').insert({
          agent_name: 'SAM',
          action_type: 'agreement_sent',
          content: `Sent ${agreement.agreement_type} agreement to ${agreement.client_name} (${agreement.client_phone})`,
          lead_id: agreement.lead_id,
          created_at: new Date().toISOString(),
        })
      } catch { /* non-critical */ }

      return NextResponse.json({
        success: true,
        agreement_id,
        status: 'sent',
        sms_sent: smsResult.success,
        pdf_url: agreement.pdf_url,
      })
    }

    // ---------------------------------------------------------------
    // Action: GENERATE or GENERATE_AND_SEND
    // ---------------------------------------------------------------
    if (!lead_id) {
      return NextResponse.json(
        { success: false, error: 'lead_id is required' },
        { status: 400 },
      )
    }

    const type: AgreementType = agreement_type === 'wholesale' ? 'wholesale' : 'excess_funds'

    // Generate PDF
    const result = await generateAgreementPdf(lead_id, type)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'PDF generation failed' },
        { status: 500 },
      )
    }

    // If generate-only, return here
    if (action === 'generate') {
      return NextResponse.json({
        success: true,
        agreement_id: result.agreementId,
        pdf_url: result.pdfUrl,
        status: 'draft',
        message: 'Agreement generated. Use action=send to deliver via SMS.',
      })
    }

    // GENERATE_AND_SEND: now send SMS
    if (!result.agreementId) {
      return NextResponse.json({
        success: true,
        pdf_url: result.pdfUrl,
        status: 'draft',
        warning: 'PDF generated but could not be tracked. Send manually.',
      })
    }

    // Fetch agreement to get phone
    const { data: agreement } = await supabase
      .from('agreements')
      .select('*')
      .eq('id', result.agreementId)
      .single()

    if (!agreement?.client_phone) {
      return NextResponse.json({
        success: true,
        agreement_id: result.agreementId,
        pdf_url: result.pdfUrl,
        status: 'draft',
        warning: 'No phone on file — agreement generated but not sent.',
      })
    }

    // Send SMS
    const firstName = extractFirstName(agreement.client_name)
    const typeName = type === 'excess_funds' ? 'Excess Funds Recovery' : 'Real Estate Assignment'
    const smsMessage =
      `${firstName}, your ${typeName} Agreement is ready for review.\n\n` +
      `View & download: ${result.pdfUrl}\n\n` +
      `No upfront cost — we only get paid when you do.\n\n` +
      `-Sam, MaxSam Recovery`

    const smsResult = await sendSMS(agreement.client_phone, smsMessage, lead_id)

    // Update status to sent
    await supabase
      .from('agreements')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', result.agreementId)

    // Log agent action
    try {
      await supabase.from('agent_memories').insert({
        agent_name: 'SAM',
        action_type: 'agreement_sent',
        content: `Generated & sent ${type} agreement to ${agreement.client_name} (${agreement.client_phone})`,
        lead_id,
        created_at: new Date().toISOString(),
      })
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      agreement_id: result.agreementId,
      pdf_url: result.pdfUrl,
      status: 'sent',
      sms_sent: smsResult.success,
      agreement_type: type,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process agreement'
    console.error('[send-agreement] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractFirstName(name: string | null): string {
  if (!name) return 'there'
  const trimmed = name.trim()
  if (trimmed.includes(',')) {
    // "LAST, FIRST MIDDLE" format
    const parts = trimmed.split(',')
    const first = (parts[1] || '').trim().split(/\s+/)[0]
    if (first) return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
  }
  const first = trimmed.split(/\s+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}
