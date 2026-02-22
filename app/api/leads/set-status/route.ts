import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const leadId = String(body?.lead_id || '')
    const status = String(body?.status || '')

    if (!leadId || !status) {
      return NextResponse.json({ success: false, error: 'lead_id and status are required' }, { status: 400 })
    }

    const { error } = await supabase.from('leads').update({ status }).eq('id', leadId)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update lead status'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
