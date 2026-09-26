import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { API_CACHE, AVATAR_CACHE } from './src/lib/cacheNames.ts'

const DAY = 24 * 60 * 60
const THEME = '#2f7d4f'

// GitHub Pages serves the app from /<repo>/, so the deploy sets BASE_PATH.
// The manifest's start_url and scope and the service worker follow it.
const base = process.env.BASE_PATH ?? '/'

const anyIcons = [48, 64, 72, 96, 128, 144, 152, 192, 256, 384, 512].map((n) => ({
  src: `pwa-${n}x${n}.png`,
  sizes: `${n}x${n}`,
  type: 'image/png',
  purpose: 'any',
}))

export default defineConfig(({ mode }) => {
  // Workbox only matches a cross-origin request if the pattern matches from the
  // start of the URL, so the runtime rules are anchored to the Supabase origin.
  const supabase = (loadEnv(mode, process.cwd()).VITE_SUPABASE_URL ?? '')
    .replace(/\/$/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // "prompt": a new service worker waits until the user taps Refresh in
        // UpdateToast, so a deploy never reloads the page mid-edit.
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png', 'robots.txt'],
        manifest: {
          id: base,
          name: 'Habit Tracker',
          short_name: 'Habits',
          description: 'Track daily habits and streaks. Installable, and it opens with no signal.',
          lang: 'en',
          start_url: base,
          scope: base,
          display: 'standalone',
          theme_color: THEME,
          background_color: '#f6f5f2',
          categories: ['productivity', 'lifestyle'],
          icons: [
            ...anyIcons,
            { src: 'maskable-icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          // Chrome shows these in a richer install dialog (a store-like sheet).
          screenshots: [
            {
              src: 'screenshots/wide.png',
              sizes: '1280x800',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Habits, stats and a week of check-ins',
            },
            {
              src: 'screenshots/narrow.png',
              sizes: '786x1702',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'The habit list on a phone',
            },
          ],
        },
        workbox: {
          // 1. App shell: precached at install, served cache-first, and
          //    replaced as a whole when a new build ships.
          // The plugin adds the manifest, its icons and includeAssets on top of
          // these, so the manifest screenshots (install dialog only) stay out.
          globPatterns: ['**/*.{js,css,html}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            // 2. Avatars: a new upload gets a new ?v= URL, so a cached copy is
            //    never stale and can be served without asking the network.
            {
              urlPattern: new RegExp(`^${supabase}/storage/v1/object/public/avatars/`),
              handler: 'CacheFirst',
              options: {
                cacheName: AVATAR_CACHE,
                expiration: { maxEntries: 20, maxAgeSeconds: 30 * DAY },
                // <img> requests are no-cors, so the response may be opaque (status 0).
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // 3. API reads: always try for fresh rows, but fall back to the last
            //    copy after 4 s or when offline. Only GETs are cached; writes and
            //    /auth/v1 always go to the network.
            {
              urlPattern: new RegExp(`^${supabase}/rest/v1/`),
              handler: 'NetworkFirst',
              method: 'GET',
              options: {
                cacheName: API_CACHE,
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 30, maxAgeSeconds: 7 * DAY },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
    ],
  }
})
