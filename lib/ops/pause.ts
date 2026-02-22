import { createClient } from '@/lib/supabase/server'

export async function isSystemPaused(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('system_flags')
      .select('pause_all')
      .eq('flag_key', 'global')
      .single()

    return Boolean(data?.pause_all)
  } catch {
    return false
  }
}
