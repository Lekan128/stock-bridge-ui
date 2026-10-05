import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

/** The marketplace's old addresses, before it moved under /marketplace (LANDING_PAGE_PLAN.md, step 2). */
const LEGACY_MARKETPLACE = /^\/(product\/|seller\/|cart$|checkout(\/|$)|order-confirmation\/)/

/**
 * Routes the dev and preview servers the way `public/_redirects` routes Netlify, so `npm run dev`
 * and the e2e suites see what production serves: the prerendered landing page at `/`, old
 * marketplace searches and paths moved to /marketplace with their query strings, and the app shell
 * (index.html) for everything else.
 */
function routeLikeNetlify(): Plugin {
  const route: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const moveTo = (location: string) => {
      res.statusCode = 301
      res.setHeader('Location', location)
      res.end()
    }
    if (url.pathname === '/') {
      if (url.searchParams.has('q') || url.searchParams.has('categoryId')) return moveTo(`/marketplace${url.search}`)
      req.url = `/landing.html${url.search}`
    } else if (LEGACY_MARKETPLACE.test(url.pathname)) {
      return moveTo(`/marketplace${url.pathname}${url.search}`)
    }
    next()
  }
  return {
    name: 'route-like-netlify',
    configureServer: (server) => void server.middlewares.use(route),
    configurePreviewServer: (server) => void server.middlewares.use(route),
  }
}

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  // Two pages: the app (index.html, also every unknown path's fallback) and the prerendered landing
  // page (landing.html, served at /). The SSR build (`--ssr src/marketing/entry-server.tsx`) brings
  // its own input.
  build: isSsrBuild ? {} : { rollupOptions: { input: { app: 'index.html', landing: 'landing.html' } } },
  plugins: [
    react(),
    tailwindcss(),
    routeLikeNetlify(),
    /**
     * The installable, offline-capable shell (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, A1).
     *
     * Builds `sw.js` and `manifest.webmanifest`; it deliberately does NOT register the worker.
     * `src/pwa/serviceWorker.ts` does that, and only from inside the signed-in workspace — so an
     * anonymous visitor browsing the storefront never downloads the workspace's ~2 MB precache.
     */
    !isSsrBuild &&
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/app',
        name: 'Procurepaddy',
        short_name: 'Procurepaddy',
        description: 'Your stock, on hand and on the way — even without a connection.',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        // The current brand navy and app background (DESIGN.md). Revisit with the colour review.
        theme_color: '#08205B',
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
        // The landing page isn't the app and needn't be held offline.
        globIgnores: ['landing.html', 'icons/og-*.png'],
        // The precache answers a directory URL with its index file, and checks that BEFORE the
        // denylist below: `/` came back as the precached app shell, not the landing page. Naming
        // the landing page (deliberately not precached) sends `/` to the network instead.
        directoryIndex: 'landing.html',
        // Every in-app navigation, including a cold start with no network, gets the app shell.
        navigateFallback: '/index.html',
        // ...except the marketing pages, which come from the network so they are the real,
        // prerendered page: `/` (with or without a query string) for now; step 7's pages join it.
        navigateFallbackDenylist: [/^\/(\?.*)?$/],
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
}))
