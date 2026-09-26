import { createClient, type Session } from '@supabase/supabase-js'
import { API_CACHE } from './cacheNames'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isConfigured = Boolean(url && key)

// The session is persisted to localStorage, so a refresh keeps you signed in.
// The placeholders are never called: App shows setup instructions instead.
export const supabase = createClient(url || 'http://localhost', key || 'missing')

// supabase-js's default storage key for this project.
const AUTH_STORAGE_KEY = url ? `sb-${new URL(url).hostname.split('.')[0]}-auth-token` : ''

/** The session saved in localStorage, without trying to refresh it. */
export function storedSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? 'null')
  } catch {
    return null
  }
}

export async function signOut() {
  await supabase.auth.signOut()
  // The API cache holds this user's rows. The next person to sign in on this
  // device must not be shown them while offline.
  if ('caches' in window) await caches.delete(API_CACHE)
}
