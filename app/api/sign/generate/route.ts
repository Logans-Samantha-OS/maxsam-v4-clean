import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/sign/generate
 *
 * Called by N8N Agreement Sender workflow.
 * Generates HMAC-signed token(s) and returns signing URL(s).
 *
 * Body: { lead_id: string, agreement_type: "excess_funds" | "wholesale" | "full_recovery" }
 *
 * - excess_funds  → 1 URL (Excess Funds Recovery Agreement)
 * - wholesale     → 1 URL (Wholesale/Finder Services Agreement)
 * - full_recovery → 2 URLs (one for each)
 *
 * Token format: base64url( lead_id : agreement_type : expires_ms : hmac_hex )
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lead_id, agreement_type } = body

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
    }

    const secret = process.env.SIGNING_SECRET
    if (!secret) {
      console.error('[Sign Generate] SIGNING_SECRET not set')
      return NextResponse.json({ error: 'Signing not configured' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: lead, error: err } = await supabase
      .from('leads')
      .select('id, owner_name, status')
      .eq('id', lead_id)
      .single()

    if (err || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    function makeToken(type: string): string {
      const expires = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
      const payload = `${lead_id}:${type}:${expires}`
      const hmac = crypto.createHmac('sha256', secret!).update(payload).digest('hex')
      return Buffer.from(`${payload}:${hmac}`).toString('base64url')
    }

    function makeUrl(type: string): string {
      return `${baseUrl}/sign?token=${makeToken(type)}`
    }

    if (agreement_type === 'full_recovery') {
      return NextResponse.json({
        success: true,
        lead_id,
        lead_name: lead.owner_name,
        agreement_type: 'full_recovery',
        excess_funds_url: makeUrl('excess_funds'),
        wholesale_url: makeUrl('wholesale'),
      })
    }

    const type = agreement_type === 'wholesale' ? 'wholesale' : 'excess_funds'

    return NextResponse.json({
      success: true,
      lead_id,
      lead_name: lead.owner_name,
      agreement_type: type,
      signing_url: makeUrl(type),
    })
  } catch (error) {
    console.error('[Sign Generate] Error:', error)
    return NextResponse.json({ error: 'Failed to generate signing URL' }, { status: 500 })
  }
}
