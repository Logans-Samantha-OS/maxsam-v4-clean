import { NextResponse } from 'next/server'
import { runRalphOnce } from '@/lib/Phase10/ralphExecutor'

export async function POST() {
  try {
    const result = await runRalphOnce()
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('Ralph route error:', err)
    return NextResponse.json(
      { ok: false, error: 'Ralph execution failed' },
      { status: 500 }
    )
  }
}
