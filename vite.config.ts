import { defineConfig, type Connect, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { MARKETING_PATHS, marketingFile } from './src/marketing/paths.ts'

/** The marketplace's old addresses, before it moved under /marketplace (LANDING_PAGE_PLAN.md, step 2). */
const LEGACY_MARKETPLACE = /^\/(product\/|seller\/|cart$|checkout(\/|$)|order-confirmation\/)/

/**
 * Routes the dev and preview servers the way `public/_redirects` routes Netlify, so `npm run dev`
 * and the e2e suites see what production serves: the prerendered landing page at `/`, old
 * marketplace searches and paths moved to /marketplace with their query strings, and the app shell
 * (index.html) for everything else.
 */
function routeLikeNetlify(): Plugin {
  // The marketing pages (/founding, /pricing, /guides/…) are prerendered into dist/<path>.html at
  // build time (scripts/prerender.mjs), which the preview serves. The dev server renders them on
  // each request with the same code (entry-server's renderPath), so `npm run dev` shows the real
  // pages, links and all, not an empty shell.
  const renderInDev = async (server: ViteDevServer, page: string, originalUrl: string): Promise<string | null> => {
    const { renderPath } = await server.ssrLoadModule('/src/marketing/entry-server.tsx')
    const rendered = renderPath(page, { siteUrl: 'http://localhost:5173' })
    if (!rendered) return null
    const template = await server.transformIndexHtml(originalUrl, readFileSync(path.resolve(__dirname, 'landing.html'), 'utf8'))
    return template
      .replace('data-surface="marketing"', rendered.id ? `data-surface="marketing" data-page="${rendered.id}"` : 'data-surface="marketing"')
      .replace('<!--marketing-head-->', rendered.head)
      .replace('<!--marketing-html-->', rendered.html)
  }
  const route = (prerendered: boolean, server?: ViteDevServer): Connect.NextHandleFunction => (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const moveTo = (location: string) => {
      res.statusCode = 301
      res.setHeader('Location', location)
      res.end()
    }
    const page = url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '')
    if (page === '/' && (url.searchParams.has('q') || url.searchParams.has('categoryId'))) return moveTo(`/marketplace${url.search}`)
    if (server && (page === '/' || MARKETING_PATHS.includes(page))) {
      renderInDev(server, page, req.originalUrl ?? req.url ?? '/').then(
        (html) => {
          if (html == null) return next()
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
        },
        (error: Error) => {
          server.ssrFixStacktrace(error)
          next(error)
        },
      )
      return
    }
    if (page === '/') {
      req.url = `/landing.html${url.search}`
    } else if (MARKETING_PATHS.includes(page)) {
      req.url = `${prerendered ? `/${marketingFile(page)}` : '/landing.html'}${url.search}`
    } else if (LEGACY_MARKETPLACE.test(url.pathname)) {
      return moveTo(`/marketplace${url.pathname}${url.search}`)
    }
    next()
  }
  return {
    name: 'route-like-netlify',
    configureServer: (server) => void server.middlewares.use(route(false, server)),
    configurePreviewServer: (server) => void server.middlewares.use(route(true)),
  }
}

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  // Two pages: the app (index.html, also every unknown path's fallback) and the prerendered landing
  // page (landing.html, served at /). The SSR build (`--ssr src/marketing/entry-server.tsx`) brings
  // its own input.
  build: isSsrBuild
    ? {}
    : {
        rollupOptions: {
          input: { app: 'index.html', landing: 'landing.html' },
          output: {
            // React in a chunk of its own. Otherwise the bundler puts it in one chunk with every
            // other module the two pages share (the logo's path data, app components), and the
            // landing page downloads all of it to hydrate a few small islands (its 70 KB budget).
            manualChunks: (id: string) => (/node_modules\/(react|react-dom|scheduler)\//.test(id) ? 'react' : undefined),
          },
        },
      },
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
        globIgnores: ['landing.html', ...MARKETING_PATHS.map(marketingFile), 'icons/og-*.png', 'downloads/**', 'marketing/**'],
        // The precache answers a directory URL with its index file, and checks that BEFORE the
        // denylist below: `/` came back as the precached app shell, not the landing page. Naming
        // the landing page (deliberately not precached) sends `/` to the network instead.
        directoryIndex: 'landing.html',
        // Every in-app navigation, including a cold start with no network, gets the app shell.
        navigateFallback: '/index.html',
        // ...except the marketing pages, which come from the network so they are the real,
        // prerendered page: `/` and `/founding` (with or without a query string) for now; step 7's
        // pages join them.
        navigateFallbackDenylist: [
          /^\/(\?.*)?$/,
          new RegExp(`^(${MARKETING_PATHS.map((page: string) => page.replace(/[/-]/g, '\\$&')).join('|')})\\/?(\\?.*)?$`),
        ],
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
