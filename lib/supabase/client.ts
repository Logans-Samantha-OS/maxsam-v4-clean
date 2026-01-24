import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

// Use placeholder values during build, actual values at runtime
// This prevents build failures when env vars aren't available at build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)
  }
  return _supabase
}

// Proxy object that lazily initializes the Supabase client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabase()[prop as keyof SupabaseClient]
  }
})

export function createClient() {
  return getSupabase()
}
