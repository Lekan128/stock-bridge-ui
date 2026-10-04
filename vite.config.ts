import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /**
     * The installable, offline-capable shell (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, A1).
     *
     * Builds `sw.js` and `manifest.webmanifest`; it deliberately does NOT register the worker.
     * `src/pwa/serviceWorker.ts` does that, and only from inside the signed-in workspace — so an
     * anonymous visitor browsing the storefront never downloads the workspace's ~2 MB precache.
     */
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/app',
        name: 'Procure Paddy',
        short_name: 'Procure Paddy',
        description: 'Your stock, on hand and on the way — even without a connection.',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        // The current brand navy and app background (DESIGN.md). Revisit with the colour review.
        theme_color: '#1E3A8A',
        background_color: '#F7F8FA',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press on the home-screen icon. The two things a storekeeper opens the app to do.
        shortcuts: [
          { name: 'Inventory', short_name: 'Inventory', url: '/app/products' },
          { name: 'Record a delivery', short_name: 'Receive', url: '/app/products/receive' },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png,webmanifest}',
          // Inter ships 28 font files across scripts this app never renders (Cyrillic, Greek,
          // Vietnamese). Only the Latin subsets are worth holding offline; the browser fetches
          // any other subset on demand, exactly as it does today.
          'assets/inter-latin-*.woff2',
          // The workspace face (D4): one variable file, Latin only, kept for offline use.
          'assets/ibm-plex-sans-latin-standard-normal-*.woff2',
        ],
        // Every in-app navigation, including a cold start with no network, gets the app shell.
        navigateFallback: '/index.html',
        // The recharts chunk is ~370 kB; the default 2 MiB cap is fine, but keep headroom so a
        // larger chunk fails the build loudly instead of silently dropping out of the precache.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // A first install takes control of the open page straight away, so the very first visit
        // is already enough to open offline next time. Updates still wait for the user (below).
        clientsClaim: true,
        // Never swap a new version in under someone mid-entry: a waiting worker activates only
        // when the user taps "Reload" on the update prompt (`messageSkipWaiting`).
        skipWaiting: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
