import { useEffect, useState } from 'react'

const TITLE = 'Habit Tracker'
const TEXT = 'I’m tracking my daily habits with Habit Tracker. It installs on your phone and works offline.'

/**
 * Opens the phone's share sheet (Web Share API). Where there isn't one, as on
 * most desktop browsers, it copies the link instead; if even that is blocked,
 * it shows the link so it can be copied by hand.
 */
export default function ShareButton() {
  const [status, setStatus] = useState<string | null>(null)
  const url = new URL(import.meta.env.BASE_URL, location.origin).href

  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(t)
  }, [status])

  async function share() {
    const data = { title: TITLE, text: TEXT, url }
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try {
        await navigator.share(data)
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return // the user closed the sheet
        // Anything else: fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus('Link copied')
    } catch {
      setStatus(`Copy this link: ${url}`)
    }
  }

  return (
    <span className="share">
      <button className="ghost" onClick={share}>
        Share
      </button>
      {status && (
        <span className="share-status" role="status">
          {status}
        </span>
      )}
    </span>
  )
}
