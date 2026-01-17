import { runRalphOnce } from '@/lib/Phase10/ralphExecutor'

export const dynamic = 'force-dynamic'

export async function POST() {
  await runRalphOnce()
  return Response.json({ ok: true })
}
