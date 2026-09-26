import { useEffect, useState } from 'react'
import { useOnline } from '../lib/useOnline'

/** A strip across the top while offline, and a short "back online" after. */
export default function OfflineBanner() {
  const online = useOnline()
  const [back, setBack] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const onOnline = () => {
      setBack(true)
      clearTimeout(timer)
      timer = setTimeout(() => setBack(false), 4000)
    }
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
      clearTimeout(timer)
    }
  }, [])

  if (online && !back) return null

  return (
    <div className={`net-banner ${online ? 'back' : 'offline'}`} role="status">
      {online ? (
        'Back online. Syncing anything you added offline.'
      ) : (
        <>
          <strong>You’re offline.</strong> Showing what’s saved on this device. New habits wait here and sync
          when you reconnect.
        </>
      )}
    </div>
  )
}
