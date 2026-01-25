import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton pattern to avoid build-time errors
let _supabase: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client during build that throws on use
    throw new Error('Supabase environment variables not configured')
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey)
  return _supabase
}

// Export getter function for lazy initialization
export function getSupabase(): SupabaseClient {
  return getSupabaseClient()
}

// Legacy export for backwards compatibility - use getSupabase() in new code
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient]
  }
})
