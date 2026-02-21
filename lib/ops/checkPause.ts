/**
 * Check the system_flags.pause_all flag.
 * Returns true when the system is paused and execution should be refused.
 */

import { createClient } from '@/lib/supabase/server'

export async function isPaused(): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase
    .from('system_flags')
    .select('enabled')
    .eq('flag_key', 'pause_all')
    .single()

  return data?.enabled === true
}
