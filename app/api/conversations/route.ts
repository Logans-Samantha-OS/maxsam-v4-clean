import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        lead_id,
        phone,
        last_message,
        updated_at,
        messages (
          id,
          body,
          direction,
          created_at
        )
      `)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error(error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ conversations: data })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
