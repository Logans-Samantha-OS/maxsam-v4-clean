import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role key for full access
export function createClient() {
  // Use placeholder values during build, actual values at runtime
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    // Fall back to anon key for development or build
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
    return createSupabaseClient(supabaseUrl, anonKey);
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Export typed client for better DX
export type SupabaseClient = ReturnType<typeof createClient>;
