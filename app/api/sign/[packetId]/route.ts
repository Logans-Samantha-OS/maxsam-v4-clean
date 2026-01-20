import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ============================================================================
// GET /api/sign/[packetId] - Load packet data for signing page
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packetId: string }> }
) {
  try {
    const { packetId } = await params
    const supabase = await createClient()

    // Fetch packet with lead info
    const { data: packet, error } = await supabase
      .from('agreement_packets')
      .select(`
        id,
        lead_id,
        client_name,
        client_email,
        client_phone,
        property_address,
        case_number,
        selection_code,
        excess_funds_amount,
        estimated_equity,
        calculated_excess_fee,
        calculated_wholesale_fee,
        total_fee,
        status,
        provider,
        signing_link,
        signing_link_expires_at,
        created_at,
        sent_at,
        first_viewed_at,
        signed_at
      `)
      .eq('id', packetId)
      .single()

    if (error || !packet) {
      console.error('[Sign API] Packet not found:', packetId, error)
      return NextResponse.json(
        { error: 'Agreement not found or has expired' },
        { status: 404 }
      )
    }

    // Check if already signed
    if (packet.status === 'SIGNED') {
      return NextResponse.json({
        success: true,
        packet: {
          ...packet,
          agreement_type: getAgreementType(packet.selection_code),
        },
        already_signed: true,
      })
    }

    // Check if expired
    if (packet.signing_link_expires_at) {
      const expiresAt = new Date(packet.signing_link_expires_at)
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'This signing link has expired. Please request a new one.' },
          { status: 410 }
        )
      }
    }

    // Check if voided or cancelled
    if (['VOIDED', 'DECLINED', 'EXPIRED', 'FAILED'].includes(packet.status)) {
      return NextResponse.json(
        { error: 'This agreement is no longer available for signing.' },
        { status: 410 }
      )
    }

    // Fetch associated documents
    const { data: documents } = await supabase
      .from('agreement_documents')
      .select('id, document_type, status')
      .eq('packet_id', packetId)

    return NextResponse.json({
      success: true,
      packet: {
        ...packet,
        agreement_type: getAgreementType(packet.selection_code),
        documents: documents || [],
      },
    })

  } catch (error) {
    console.error('[Sign API] Error loading packet:', error)
    return NextResponse.json(
      { error: 'Failed to load agreement' },
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
