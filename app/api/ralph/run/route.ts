import { NextResponse } from 'next/server'
import { runRalphOnce } from '@/lib/Phase10/ralphExecutor'
import { enforceGates, createBlockedResponse } from '@/lib/governance/middleware'

export async function POST() {
  // GATE ENFORCEMENT - RALPH EXECUTION
  const blocked = await enforceGates({ agent: 'ralph', gate: 'gate_ralph_execution' })
  if (blocked) {
    return NextResponse.json(createBlockedResponse(blocked), { status: 503 })
  }

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
