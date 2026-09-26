import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { storedSession, supabase } from './supabase'

/** undefined while loading, null when signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    // Offline, an access token older than an hour can't be refreshed, so
    // supabase-js reports no session even though one is saved. Keep using the
    // saved one so the app still opens with no signal; supabase-js refreshes
    // it once the network is back.
    const accept = (next: Session | null) => setSession(next ?? (navigator.onLine ? null : storedSession()))

    supabase.auth.getSession().then(({ data }) => accept(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, next) =>
      event === 'SIGNED_OUT' ? setSession(null) : accept(next),
    )
    return () => data.subscription.unsubscribe()
  }, [])

  return session
}
