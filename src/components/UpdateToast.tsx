import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR = 60 * 60 * 1000

/**
 * Registers the service worker. With registerType "prompt", a new build
 * installs in the background and waits; this toast lets the user choose when
 * to switch, so an update never reloads the page under them.
 */
export default function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // An installed app can stay open for days; look for a new build hourly.
      if (registration) setInterval(() => navigator.onLine && registration.update(), HOUR)
    },
  })

  // "Ready to work offline" is news once; it clears itself.
  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 6000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="toast" role="status">
      <p>
        {needRefresh ? (
          <>
            <strong>New version available</strong>
            <span className="muted">Refresh to get the latest.</span>
          </>
        ) : (
          <strong>Ready to work offline</strong>
        )}
      </p>
      <div className="toast-actions">
        {needRefresh && <button onClick={() => updateServiceWorker(true)}>Refresh</button>}
        <button
          className="ghost"
          onClick={() => {
            setNeedRefresh(false)
            setOfflineReady(false)
          }}
        >
          {needRefresh ? 'Later' : 'OK'}
        </button>
      </div>
    </div>
  )
}
