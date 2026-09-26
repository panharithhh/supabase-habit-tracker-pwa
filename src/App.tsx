import type { User } from '@supabase/supabase-js'
import { isConfigured, signOut } from './lib/supabase'
import { useSession } from './lib/useSession'
import { useHabits } from './lib/useHabits'
import { useProfile } from './lib/useProfile'
import { clearCrashTest } from './lib/crashTest'
import AuthForm from './components/AuthForm'
import AvatarUpload from './components/AvatarUpload'
import ErrorBoundary from './components/ErrorBoundary'
import HabitList from './components/HabitList'
import InstallPrompt from './components/InstallPrompt'
import Nav from './components/Nav'
import OfflineBanner from './components/OfflineBanner'
import SectionFallback from './components/SectionFallback'
import Stats from './components/Stats'
import UpdateToast from './components/UpdateToast'

export default function App() {
  return (
    <>
      <OfflineBanner />
      {isConfigured ? <Main /> : <MissingConfig />}
    </>
  )
}

function Main() {
  const session = useSession()

  return (
    <>
      {session === undefined ? (
        <p className="muted center">Loading…</p>
      ) : !session ? (
        <AuthForm />
      ) : (
        // Keyed by user so switching accounts never flashes the previous user's data.
        <Dashboard key={session.user.id} user={session.user} />
      )}
      <div className="toasts">
        {/* Offer to install once someone is using the app, not over the sign-in form. */}
        {session && <InstallPrompt />}
        <UpdateToast />
      </div>
    </>
  )
}

// Each section sits in its own ErrorBoundary. If one throws while rendering,
// only that section swaps to its fallback; the others keep working. The data
// hooks live up here, outside the boundaries, so a crash and a retry never
// lose or refetch what the other sections are showing.
function Dashboard({ user }: { user: User }) {
  const habits = useHabits(user.id)
  const profile = useProfile(user.id)
  const email = user.email ?? ''

  return (
    <main className="dashboard">
      <ErrorBoundary
        name="nav"
        onReset={() => clearCrashTest('nav')}
        fallback={(p) => (
          <SectionFallback
            {...p}
            className="topbar"
            title="The top bar didn’t load"
            actions={
              <button className="ghost" onClick={signOut}>
                Sign out
              </button>
            }
          >
            You’re still signed in, and everything below works.
          </SectionFallback>
        )}
      >
        <Nav email={email} avatarUrl={profile.avatarUrl} />
      </ErrorBoundary>

      <div className="stack">
        {/* Phone and tablet: stacked. Desktop: the photo takes a third, the stats two. */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <div className="min-w-0">
            <ErrorBoundary
              name="profile"
              onReset={() => clearCrashTest('profile')}
              fallback={(p) => (
                <SectionFallback {...p} title="Profile photo is unavailable">
                  Your current photo is unchanged. Nothing was uploaded.
                </SectionFallback>
              )}
            >
              <AvatarUpload
                email={email}
                avatarUrl={profile.avatarUrl}
                loadError={profile.error}
                uploadAvatar={profile.uploadAvatar}
              />
            </ErrorBoundary>
          </div>

          <div className="min-w-0 lg:col-span-2">
            <ErrorBoundary
              name="stats"
              onReset={() => clearCrashTest('stats')}
              fallback={(p) => (
                <SectionFallback {...p} title="Stats couldn’t be shown">
                  Your habits and check-ins below are safe. Only this summary failed.
                </SectionFallback>
              )}
            >
              <Stats habits={habits.habits} />
            </ErrorBoundary>
          </div>
        </div>

        <ErrorBoundary
          name="habits"
          onReset={() => clearCrashTest('habits')}
          fallback={(p) => (
            <SectionFallback {...p} title="Your habit list hit a problem">
              Nothing was lost: every check-in is saved in the database.
            </SectionFallback>
          )}
        >
          <HabitList {...habits} />
        </ErrorBoundary>
      </div>
    </main>
  )
}

function MissingConfig() {
  return (
    <main className="narrow">
      <h1>Habits</h1>
      <div className="card">
        <h2>Supabase isn't configured</h2>
        <ol>
          <li>
            Copy <code>.env.example</code> to <code>.env</code>
          </li>
          <li>
            Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
          </li>
          <li>
            Restart <code>npm run dev</code>
          </li>
        </ol>
      </div>
    </main>
  )
}
