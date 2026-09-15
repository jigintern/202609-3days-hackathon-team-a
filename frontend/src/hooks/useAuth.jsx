import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { apiFetch, ApiError } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileRequired, setProfileRequired] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadProfile() {
    try {
      const body = await apiFetch('/api/auth/me')
      setProfile(body.user)
      setProfileRequired(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PROFILE_REQUIRED') {
        setProfile(null)
        setProfileRequired(true)
      } else {
        setProfile(null)
      }
    }
  }

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) {
        await loadProfile()
      }
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        await loadProfile()
      } else {
        setProfile(null)
        setProfileRequired(false)
      }
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await loadProfile()
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setProfileRequired(false)
  }

  async function createProfile(displayName) {
    const body = await apiFetch('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    })
    setProfile(body.user)
    setProfileRequired(false)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    profileRequired,
    loading,
    signIn,
    signUp,
    signOut,
    createProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
