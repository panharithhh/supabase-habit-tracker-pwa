import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** navigator.onLine, re-rendered on every online/offline event. */
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine)
}
