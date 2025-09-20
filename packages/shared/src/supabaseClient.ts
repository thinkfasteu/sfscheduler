import { createClient } from '@supabase/supabase-js'

// Supabase client configuration
export interface SupabaseConfig {
  url: string
  anonKey: string
}

let supabaseClient: ReturnType<typeof createClient> | null = null

export function createSupabaseClient(config?: SupabaseConfig) {
  // Use provided config or fall back to environment variables
  const url = config?.url || 
               (typeof window !== 'undefined' ? window.__CONFIG__?.SUPABASE_URL : undefined) ||
               import.meta.env?.VITE_SUPABASE_URL ||
               process.env?.SUPABASE_URL

  const anonKey = config?.anonKey || 
                  (typeof window !== 'undefined' ? window.__CONFIG__?.SUPABASE_ANON_KEY : undefined) ||
                  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
                  process.env?.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.warn('[SupabaseClient] Missing configuration - provide SUPABASE_URL and SUPABASE_ANON_KEY')
    
    // In development, return a mock client that shows helpful error messages
    if ((import.meta as any).env?.DEV || process.env?.NODE_ENV === 'development') {
      const mockClient = {
        auth: {
          signUp: async () => ({ error: new Error('Supabase not configured. Please add your credentials to .env.local') }),
          signIn: async () => ({ error: new Error('Supabase not configured. Please add your credentials to .env.local') }),
          signOut: async () => ({ error: null }),
          getSession: async () => ({ data: { session: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
        }
      }
      return mockClient as any
    }
    
    throw new Error('Missing Supabase configuration')
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'X-Client-Info': 'staff-portal@0.1.0',
        },
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

// Type-safe database types for Supabase
export interface Database {
  public: {
    Tables: {
      staff: {
        Row: {
          id: number
          name: string
          role: string
          contract_hours: number | null
          typical_workdays: number | null
          weekend_preference: boolean | null
          version: number
          created_at: string
          updated_at: string
          created_by: number | null
        }
        Insert: {
          name: string
          role: string
          contract_hours?: number | null
          typical_workdays?: number | null
          weekend_preference?: boolean | null
          created_by?: number | null
        }
        Update: {
          name?: string
          role?: string
          contract_hours?: number | null
          typical_workdays?: number | null
          weekend_preference?: boolean | null
        }
      }
      availability_submissions: {
        Row: {
          id: string
          staff_id: number
          month: string
          entries: Record<string, any>
          submitted_at: string | null
          locked_at: string | null
          status: string
          created_at: string
          updated_at: string
          created_by: number | null
        }
        Insert: {
          staff_id: number
          month: string
          entries: Record<string, any>
          status?: string
          created_by?: number | null
        }
        Update: {
          entries?: Record<string, any>
          submitted_at?: string | null
          locked_at?: string | null
          status?: string
        }
      }
      swap_requests: {
        Row: {
          id: string
          created_by: number
          month: string
          date: string
          shift_key: string
          target_staff_id: number | null
          status: string
          accepted_by: number | null
          messages: any[]
          created_at: string
          updated_at: string
        }
        Insert: {
          created_by: number
          month: string
          date: string
          shift_key: string
          target_staff_id?: number | null
          status?: string
          messages?: any[]
        }
        Update: {
          status?: string
          accepted_by?: number | null
          messages?: any[]
        }
      }
      sick_reports: {
        Row: {
          id: string
          staff_id: number
          date_from: string
          date_to: string
          note: string | null
          requires_certificate: boolean
          certificate_submitted: boolean
          status: string
          approved_by: number | null
          approved_at: string | null
          created_at: string
          updated_at: string
          created_by: number | null
        }
        Insert: {
          staff_id: number
          date_from: string
          date_to: string
          note?: string | null
          requires_certificate?: boolean
          certificate_submitted?: boolean
          status?: string
          created_by?: number | null
        }
        Update: {
          note?: string | null
          certificate_submitted?: boolean
          status?: string
          approved_by?: number | null
          approved_at?: string | null
        }
      }
      vacation_requests: {
        Row: {
          id: string
          staff_id: number
          date_from: string
          date_to: string
          reason: string | null
          days_requested: number
          status: string
          approved_by: number | null
          approved_at: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
          created_by: number | null
        }
        Insert: {
          staff_id: number
          date_from: string
          date_to: string
          reason?: string | null
          days_requested: number
          status?: string
          created_by?: number | null
        }
        Update: {
          reason?: string | null
          status?: string
          approved_by?: number | null
          approved_at?: string | null
          rejection_reason?: string | null
        }
      }
      hours_statements: {
        Row: {
          id: string
          staff_id: number
          month: string
          generated_at: string
          source: string
          totals: Record<string, any>
          breakdown: Record<string, any>
          status: string
          created_at: string
          updated_at: string
          created_by: number | null
        }
        Insert: {
          staff_id: number
          month: string
          source?: string
          totals: Record<string, any>
          breakdown: Record<string, any>
          status?: string
          created_by?: number | null
        }
        Update: {
          totals?: Record<string, any>
          breakdown?: Record<string, any>
          status?: string
        }
      }
    }
  }
}

// Re-export for convenience
export { createClient } from '@supabase/supabase-js'
export type { SupabaseClient } from '@supabase/supabase-js'