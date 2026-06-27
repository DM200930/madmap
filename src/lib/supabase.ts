import { createClient } from '@supabase/supabase-js'

// Fall back to harmless placeholders so the app can be built/prerendered
// without env vars present (real values are injected on Vercel at runtime).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
