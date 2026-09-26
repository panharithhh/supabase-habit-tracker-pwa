# Habit Tracker: installable, offline-first PWA

A React 19 + TypeScript (Vite) habit tracker on Supabase, now a Progressive Web
App: it installs to a phone's home screen, opens on a train with no signal,
queues habits you add offline and syncs them when you reconnect, fits a 320 px
screen without sideways scrolling, and scores green on Lighthouse.

It builds on the earlier steps:
[Auth + RLS](https://github.com/panharithhh/supabase-habit-tracker) (email
sign-in, one user's rows only) and
[avatar uploads + error boundaries](https://github.com/panharithhh/supabase-habit-tracker-avatars).

**Live (HTTPS):** <https://panharithhh.github.io/supabase-habit-tracker-pwa/>

## Run it

```bash
npm install
cp .env.example .env    # the Supabase URL and publishable key (see below)
npm run dev             # http://localhost:5173, no service worker in dev
npm run build           # tsc -b && vite build, generates sw.js + manifest
npm run preview         # serve the production build, service worker included
npm run test:rls        # 29 policy and validation tests, no Supabase project needed
```

A service worker only runs from `localhost` or HTTPS, so test install and
offline with `npm run preview`, not `npm run dev`.

**Supabase setup** (once): create a project, run
[`supabase/schema.sql`](supabase/schema.sql) then
[`supabase/avatars.sql`](supabase/avatars.sql) in the SQL editor, turn off
*Confirm email* for easy test accounts, and put the Project URL and the
**publishable** key into `.env`. Never the secret / `service_role` key.

**Deploy:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
builds on every push to `main` and publishes to GitHub Pages. It reads
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from repository
variables and sets `BASE_PATH=/<repo>/`, which the manifest scope, start URL
and service worker all follow.

## 1. Manifest, icons, install

[`vite.config.ts`](vite.config.ts) configures `vite-plugin-pwa`:

- **Manifest:** name *Habit Tracker*, short name *Habits*, theme color
  `#2f7d4f`, background `#f6f5f2`, `display: standalone`, `id`/`scope`/
  `start_url` set to the base path, and two manifest screenshots (wide and
  narrow) so Chrome can show its richer install sheet.
- **Icons**, all rendered from one SVG by
  [`scripts/generate-icons.mjs`](scripts/generate-icons.mjs) (`sharp`):
  `purpose: any` at 48, 64, 72, 96, 128, 144, 152, 192, 256, 384 and 512 px;
  `maskable` at 192 and 512 px with the mark inside the 80 % safe zone;
  `apple-touch-icon-180x180.png` for iOS; `favicon.ico` (16 + 32) and
  `favicon.svg` for tabs.
- **Install prompt:** [`InstallPrompt`](src/components/InstallPrompt.tsx)
  catches `beforeinstallprompt` (kept from page load, because the browser fires
  it once, early), and once you're signed in shows an *Install Habit Tracker*
  card. **Install** opens the browser's own install dialog; **Not now** stays
  quiet for 14 days.
- `index.html` gained a meta description, `theme-color`, favicons, the Apple
  touch icon, and `viewport-fit=cover`, so the side padding can respect the
  notch when the app runs full screen.

### Update toast

`registerType: "prompt"`: a new build installs in the background and **waits**.
[`UpdateToast`](src/components/UpdateToast.tsx) uses `useRegisterSW` and shows
**New version available** with **Refresh** (calls `updateServiceWorker(true)`,
which activates the new worker and reloads) and **Later**. An installed app
can stay open for days, so it also checks for a new build every hour. On first
install it shows *Ready to work offline* for a few seconds.

## 2. Caching strategy

| Asset | Strategy | Why it earns it |
|---|---|---|
| App shell: `index.html`, JS, CSS, manifest, icons, favicons | **Precache** (install time, cache first, revisioned) | They change only when a new build ships, and the precache manifest carries a hash for each, so serving them straight from the cache is instant and offline-safe while `Refresh` swaps the whole set at once. |
| Avatars (`…/storage/v1/object/public/avatars/…`) | **CacheFirst**, 20 entries, 30 days, opaque responses allowed | Every upload gets a new `?v=` URL, so a cached avatar can never be stale and there is no reason to ask the network for it again. |
| Supabase API reads (`GET …/rest/v1/…`) | **NetworkFirst**, 4 s timeout, 30 entries, 7 days | Habits must be fresh when online, but a slow or missing connection should still show the last list rather than a spinner, so it falls back to the cached copy after 4 seconds or when offline. |
| Writes (`POST`/`PATCH`/`DELETE`) and `/auth/v1` | **Network only** (no rule) | A write that "succeeds" from a cache would be a lie, and tokens must never be cached; new habits are queued by the app instead (below). |

Two details that matter:

- **Anchored patterns.** Workbox only matches a cross-origin request if the
  pattern matches from the start of the URL, so the rules are built from
  `VITE_SUPABASE_URL` (`^https://<ref>.supabase.co/rest/v1/`). A plain
  `/\/rest\/v1\//` silently never matched: the offline test caught it.
- **Per-user data in a shared cache.** The API cache is keyed by URL, not by
  token, so `signOut()` deletes it. The next person to sign in on the device
  never sees the previous user's habits offline.

## 3. Offline banner and the offline queue

- [`useOnline`](src/lib/useOnline.ts) wraps `navigator.onLine` in
  `useSyncExternalStore`, subscribed to the `online` and `offline` events.
  [`OfflineBanner`](src/components/OfflineBanner.tsx) shows *You're offline.
  Showing what's saved on this device…* and, on the `online` event, *Back
  online. Syncing anything you added offline.* for a few seconds.
- **Adding a habit offline** ([`useHabits`](src/lib/useHabits.ts),
  [`offlineQueue`](src/lib/offlineQueue.ts)): the habit gets its final id from
  `crypto.randomUUID()` and goes into a per-user queue in `localStorage`. It
  shows at once with a dashed border and a **Queued · syncs when you're
  online** pill, and survives a reload or a closed tab. The same happens if
  the connection drops mid-request.
- **Sync on reconnect:** the `online` event (and every app start) sends the
  queue oldest first. Because each habit already has its id, a retry after a
  half-finished sync hits the primary key (`23505`) and is treated as done, so
  nothing is ever added twice. A habit the server refuses is dropped with a
  message saying why.
- Check-ins need the server (they log against a saved habit), so the day
  buttons are disabled while offline, with a tooltip saying so.
- **Signed in on a train:** an access token older than an hour can't be
  refreshed offline, and supabase-js then reports no session.
  [`useSession`](src/lib/useSession.ts) keeps the saved session while offline,
  so the app still opens; supabase-js refreshes it when the network returns.

## 4. Mobile-first pass

Checked at DevTools' device sizes, iPhone SE (375 × 667) → Pixel 5
(393 × 851) → iPad Mini (768 × 1024), plus 320 px and desktop:

| | Before | After |
|---|---|---|
| Page wider than the screen | no | no, at every size (`scrollWidth − clientWidth = 0`) |
| Text overflowing its box | the **TODAY** label spilled out of its day button at 375 px (38 > 36 px) and 320 px (34 > 29 px) | none: every day shows its short weekday, today is marked by color and its accessible name |
| Habit cards | one 600 px column at every size | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| Top bar on a phone | wrapped onto two rows | one row: the avatar stands in for the email below `sm` (`hidden sm:inline`) |

Styles are mobile first: phone sizes are the defaults and `min-width` queries
add to them. Tailwind v4 is loaded as **theme + utilities only** (no preflight),
in a cascade layer, so it adds the grid/breakpoint classes without disturbing
the hand-written CSS. Other fixes: `min-width: 0` on the add-habit input (a flex
item won't shrink below ~20 characters otherwise), toasts full width on phones
and a corner card from `sm` up, and `env(safe-area-inset-*)` padding.

**Share** ([`ShareButton`](src/components/ShareButton.tsx)) opens the phone's
share sheet with `navigator.share`. Where there isn't one (most desktop
browsers), it copies the link with `navigator.clipboard.writeText` and says
*Link copied*; if the clipboard is blocked too, it shows the link to copy by
hand. Closing the share sheet (`AbortError`) is not treated as a failure.

## 5. Lighthouse

Lighthouse 13.5 on the production build (`vite preview`), headless Brave,
default mobile and desktop presets, signed-out entry page. Before and after
were run back to back, twice; both runs gave identical scores.

| | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| Mobile, before | 99 | 100 | 96 | 82 |
| Mobile, after | **99** | **100** | **100** | **100** |
| Desktop, before | 100 | 100 | 96 | 82 |
| Desktop, after | **100** | **100** | **100** | **100** |

What the fixes were:

- **Best Practices 96 → 100:** the console logged a 404 for `/favicon.ico`.
  There is now a real favicon (and an SVG one).
- **SEO 82 → 100:** added a meta description, and a real `robots.txt` (before,
  the SPA fallback answered `/robots.txt` with `index.html`: "13 errors").
- **Performance:** the first version showed the install card on the sign-in
  page, which became the largest paint and caused a layout shift (mobile
  98, CLS 0.027). It now appears only once you're signed in: back to 99, CLS 0.

## Screenshots

In [`docs/screenshots/`](docs/screenshots/). The app screenshots use a demo
account against a local stand-in for the Supabase API (so no real account or
data is involved); DevTools is real Brave DevTools, driven in headless mode.

- Install: [in-app card](docs/screenshots/20-install-card.png),
  [DevTools → Manifest](docs/screenshots/21-devtools-manifest.png)
- Offline: [page loaded offline](docs/screenshots/22-offline-page.png),
  [DevTools Network, Offline, all from ServiceWorker](docs/screenshots/23-devtools-network-offline.png),
  [DevTools Service workers, Offline ticked](docs/screenshots/24-devtools-sw-offline.png),
  [habit queued](docs/screenshots/25-offline-queued.png),
  [synced after reconnect](docs/screenshots/26-synced.png)
- Update: [New version available](docs/screenshots/27-update-toast.png)
- Layout: [iPhone SE](docs/screenshots/28-iphone-se.png),
  [Pixel 5](docs/screenshots/29-pixel-5.png),
  [iPad Mini](docs/screenshots/30-ipad-mini.png),
  [desktop](docs/screenshots/31-desktop.png),
  [share fallback](docs/screenshots/32-share-fallback.png)
- Lighthouse: [mobile before](docs/screenshots/33-lighthouse-before-mobile.png),
  [mobile after](docs/screenshots/34-lighthouse-after-mobile.png),
  [desktop before](docs/screenshots/35-lighthouse-before-desktop.png),
  [desktop after](docs/screenshots/36-lighthouse-after-desktop.png)

### How the offline flow was checked

With DevTools open: load once online (the service worker installs and
precaches), reload (now controlled; the API read lands in `supabase-api`),
tick **Offline** in Application → Service workers, reload. The page, JS, CSS,
manifest, icons and both API reads came from `(ServiceWorker)`; the network
attempts Workbox made first failed, as they should. A habit added offline
showed as queued and was still there after another offline reload. Unticking
Offline fired `online`, the habit was POSTed once with its client id, and the
queue emptied. Appending a byte to `sw.js` and calling
`registration.update()` brought up **New version available**; **Refresh**
reloaded onto the new worker.

## Project layout

```
vite.config.ts                     PWA plugin: manifest, icons, precache, runtime caching
scripts/generate-icons.mjs         every icon size from one SVG
public/                            icons, favicons, robots.txt, manifest screenshots
.github/workflows/deploy.yml       build + GitHub Pages
src/components/UpdateToast.tsx     useRegisterSW: "New version available" + Refresh
src/components/InstallPrompt.tsx   beforeinstallprompt → Install card
src/components/OfflineBanner.tsx   online/offline banner
src/components/ShareButton.tsx     Web Share, clipboard fallback
src/lib/useOnline.ts               navigator.onLine as React state
src/lib/offlineQueue.ts            per-user queue of habits added offline
src/lib/useHabits.ts               reads, writes, queue and sync on reconnect
src/lib/useSession.ts              keeps the saved session while offline
src/lib/cacheNames.ts              runtime cache names, shared with the config
supabase/*.sql                     tables, RLS, avatars bucket and storage policy
scripts/*.test.mjs                 policy and validation tests (npm run test:rls)
```
