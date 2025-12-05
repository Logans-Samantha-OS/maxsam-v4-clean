import { createClient } from '@supabase/supabase-js'

// Use placeholder values during build, actual values at runtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Create client - will use real values at runtime in production
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
