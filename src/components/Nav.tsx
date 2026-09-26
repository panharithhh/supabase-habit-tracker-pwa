import { signOut } from '../lib/supabase'
import { crashTest } from '../lib/crashTest'
import Avatar from './Avatar'
import ShareButton from './ShareButton'

type Props = { email: string; avatarUrl: string | null | undefined }

export default function Nav({ email, avatarUrl }: Props) {
  crashTest('nav')

  return (
    <header className="topbar">
      <h1>Habits</h1>
      <div className="who">
        <Avatar src={avatarUrl} email={email} size={32} alt={email} />
        {/* On a phone the avatar stands in for the address, so the buttons fit on one line. */}
        <span className="email muted hidden sm:inline">{email}</span>
        <ShareButton />
        <button className="ghost" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}
