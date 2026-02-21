import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const phone = String(body?.phone || '').trim()

    if (!phone) {
      return NextResponse.json({ success: false, error: 'phone is required' }, { status: 400 })
    }

    const { error } = await supabase.from('sms_blocklist').insert({
      phone,
      reason: 'opt_out',
      source: 'dashboard',
      created_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to opt out number'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
