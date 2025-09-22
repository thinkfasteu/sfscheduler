import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '../lib/supabaseClient'
import type { Staff } from '@shared/types'
import { fetchStaffById } from '@shared/contracts'

interface AuthContextType {
  user: User | null
  staff: Staff | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  staff: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
})

export { AuthContext }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = getSupabaseClient()

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error.message)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)

        // Load staff data if we have a user
        if (session?.user) {
          await loadStaffData(session.user)
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await loadStaffData(session.user)
        } else {
          setStaff(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const loadStaffData = async (user: User) => {
    try {
      // TODO: Map user to staff record properly
      // For now, we'll use user ID as staff ID for demo purposes
      // In production, you'd have a mapping table or store staff_id in user metadata
      const staffId = parseInt(user.user_metadata?.staff_id || '1')
      const staffData = await fetchStaffById(staffId)
      setStaff(staffData)
    } catch (error) {
      console.error('Error loading staff data:', error)
      // For demo purposes, create a mock staff record
      setStaff({
        id: 1,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        role: 'permanent', // Test with permanent role for demo
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      throw new Error(error.message)
    }
    
    setStaff(null)
  }

  const value = {
    user,
    staff,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}