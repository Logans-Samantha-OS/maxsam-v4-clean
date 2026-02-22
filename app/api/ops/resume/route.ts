import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('system_flags')
      .upsert({
        flag_key: 'global',
        status: 'active',
        pause_all: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'flag_key' })

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, pause_all: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to resume system'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
