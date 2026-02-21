import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const changedBy = (body as Record<string, unknown>)?.changed_by ?? 'operator'

    const supabase = createClient()

    const { error } = await supabase
      .from('system_flags')
      .update({
        enabled: false,
        changed_by: String(changedBy),
        reason: 'Resumed',
      })
      .eq('flag_key', 'pause_all')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      paused: false,
      message: 'System resumed — dispatch routes operational.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
