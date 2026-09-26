import { useState, useSyncExternalStore } from 'react'

// Chrome, Edge and Samsung Internet fire this once the app is installable.
// Safari and Firefox don't, so there the browser's own menu is the way in.
type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED = 'install-dismissed-at'
const QUIET_DAYS = 14

// The browser fires the event once, early, often while the sign-in form is
// still up. It is kept here until the card is shown.
let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // stops Chrome's mini-infobar on Android; the card asks instead
  deferred = e as BeforeInstallPromptEvent
  emit()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  emit()
})

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISSED))
    return Date.now() - at < QUIET_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

/** Offers "Install" in the page, instead of relying on an icon in the address bar. */
export default function InstallPrompt() {
  const event = useSyncExternalStore(subscribe, () => deferred)
  const [hidden, setHidden] = useState(recentlyDismissed)

  if (!event || hidden) return null

  async function install() {
    await event!.prompt() // the browser's own install dialog
    await event!.userChoice
    deferred = null // an event can prompt only once
    emit()
  }

  function notNow() {
    try {
      localStorage.setItem(DISMISSED, String(Date.now()))
    } catch {
      // Storage blocked: it just asks again next visit.
    }
    setHidden(true)
  }

  return (
    <div className="toast install" role="region" aria-label="Install the app">
      <img src={`${import.meta.env.BASE_URL}pwa-96x96.png`} alt="" width={40} height={40} />
      <p>
        <strong>Install Habit Tracker</strong>
        <span className="muted">Opens from your home screen, even with no signal.</span>
      </p>
      <div className="toast-actions">
        <button onClick={install}>Install</button>
        <button className="ghost" onClick={notNow}>
          Not now
        </button>
      </div>
    </div>
  )
}
