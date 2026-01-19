import { NextResponse } from 'next/server'
import { runRalphOnce } from '@/lib/Phase10/ralphExecutor'
import { enforceGates, createBlockedResponse } from '@/lib/governance/middleware'

export const dynamic = 'force-dynamic'

export async function POST() {
  // GATE ENFORCEMENT - RALPH LOOP EXECUTION
  const blocked = await enforceGates({ agent: 'ralph', gate: 'gate_ralph_execution' })
  if (blocked) {
    return NextResponse.json(createBlockedResponse(blocked), { status: 503 })
  }

  await runRalphOnce()
  return Response.json({ ok: true })
}
