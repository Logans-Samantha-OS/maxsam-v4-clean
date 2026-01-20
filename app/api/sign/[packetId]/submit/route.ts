import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

// ============================================================================
// POST /api/sign/[packetId]/submit - Submit signature
// ============================================================================

interface SignaturePayload {
  typed_name: string
  agree_terms: boolean
  agree_fee: boolean
  signed_at: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ packetId: string }> }
) {
  try {
    const { packetId } = await params
    const supabase = await createClient()
    const headersList = await headers()
    const body: SignaturePayload = await request.json()

    // Validate required fields
    if (!body.typed_name?.trim()) {
      return NextResponse.json(
        { error: 'Typed name is required' },
        { status: 400 }
      )
    }

    if (!body.agree_terms || !body.agree_fee) {
      return NextResponse.json(
        { error: 'You must agree to the terms and fee structure' },
        { status: 400 }
      )
    }

    // Get client IP and user agent for legal compliance
    const clientIp = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip')
      || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    // Fetch packet
    const { data: packet, error: fetchError } = await supabase
      .from('agreement_packets')
      .select('id, status, client_name, lead_id, selection_code')
      .eq('id', packetId)
      .single()

    if (fetchError || !packet) {
      return NextResponse.json(
        { error: 'Agreement not found' },
        { status: 404 }
      )
    }

    // Check if already signed
    if (packet.status === 'SIGNED') {
      return NextResponse.json(
        { error: 'This agreement has already been signed' },
        { status: 409 }
      )
    }

    // Check if voided/expired
    if (['VOIDED', 'DECLINED', 'EXPIRED', 'FAILED'].includes(packet.status)) {
      return NextResponse.json(
        { error: 'This agreement is no longer available for signing' },
        { status: 410 }
      )
    }

    // Verify name matches (case-insensitive)
    if (body.typed_name.trim().toLowerCase() !== packet.client_name?.toLowerCase()) {
      return NextResponse.json(
        { error: 'Typed name must match your name on the agreement' },
        { status: 400 }
      )
    }

    const signedAt = new Date().toISOString()

    // Update packet status to SIGNED
    const { error: updateError } = await supabase
      .from('agreement_packets')
      .update({
        status: 'SIGNED',
        signed_at: signedAt,
      })
      .eq('id', packetId)

    if (updateError) {
      console.error('[Sign Submit] Failed to update packet:', updateError)
      return NextResponse.json(
        { error: 'Failed to process signature' },
        { status: 500 }
      )
    }

    // Log signature event with full audit data
    const signatureData = {
      typed_name: body.typed_name.trim(),
      agree_terms: body.agree_terms,
      agree_fee: body.agree_fee,
      ip_address: clientIp,
      user_agent: userAgent,
      signed_at: signedAt,
      client_provided_timestamp: body.signed_at,
    }

    const { error: eventError } = await supabase
      .from('agreement_events')
      .insert({
        packet_id: packetId,
        event_type: 'SIGNED',
        event_data: signatureData,
      })

    if (eventError) {
      console.error('[Sign Submit] Failed to log event:', eventError)
      // Don't fail - the signature was recorded
    }

    // Update associated documents to signed
    await supabase
      .from('agreement_documents')
      .update({ status: 'SIGNED', signed_at: signedAt })
      .eq('packet_id', packetId)

    // Create a message event for the timeline (if messages table exists)
    try {
      await supabase
        .from('messages')
        .insert({
          lead_id: packet.lead_id,
          direction: 'system',
          channel: 'agreement',
          content: `Agreement signed: ${getAgreementType(packet.selection_code)}`,
          metadata: {
            packet_id: packetId,
            event_type: 'signed',
            typed_name: body.typed_name.trim(),
          },
        })
    } catch {
      // Messages table might not exist yet - that's ok
      console.log('[Sign Submit] Messages table not available yet')
    }

    // Trigger completion webhook (n8n) - fire and forget
    triggerCompletionWebhook(packetId, packet.lead_id, signatureData).catch(err => {
      console.error('[Sign Submit] Failed to trigger completion webhook:', err)
    })

    return NextResponse.json({
      success: true,
      message: 'Agreement signed successfully',
      signed_at: signedAt,
    })

  } catch (error) {
    console.error('[Sign Submit] Error processing signature:', error)
    return NextResponse.json(
      { error: 'Failed to process signature' },
      { status: 500 }
    )
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAgreementType(selectionCode: number): string {
  switch (selectionCode) {
    case 1:
      return 'Excess Funds Recovery Agreement'
    case 2:
      return 'Wholesale Assignment Agreement'
    case 3:
      return 'Combined Services Agreement'
    default:
      return 'Service Agreement'
  }
}

async function triggerCompletionWebhook(
  packetId: string,
  leadId: string,
  signatureData: Record<string, unknown>
): Promise<void> {
  const webhookUrl = process.env.N8N_AGREEMENT_COMPLETION_WEBHOOK

  if (!webhookUrl) {
    console.log('[Sign Submit] No completion webhook configured')
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'agreement_signed',
        packet_id: packetId,
        lead_id: leadId,
        signature_data: signatureData,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      console.error('[Sign Submit] Completion webhook failed:', response.status)
    }
  } catch (error) {
    console.error('[Sign Submit] Completion webhook error:', error)
  }
}
