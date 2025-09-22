import { createClient } from '@supabase/supabase-js'

// Vite-specific Supabase client configuration
export interface SupabaseConfig {
  url: string
  anonKey: string
}

let supabaseClient: ReturnType<typeof createClient> | null = null

export function createSupabaseClient(config?: SupabaseConfig) {
  // Use provided config or fall back to Vite environment variables
  const url = config?.url || 
               import.meta.env.VITE_SUPABASE_URL ||
               ''

  const anonKey = config?.anonKey || 
                  import.meta.env.VITE_SUPABASE_ANON_KEY ||
                  ''

  if (!url || !anonKey) {
    console.warn('[SupabaseClient] Missing configuration - provide SUPABASE_URL and SUPABASE_ANON_KEY')
    
    // Return a mock client for development
    return createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }

  return supabaseClient
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    return createSupabaseClient()
  }
  return supabaseClient
}

export { supabaseClient }