# Procure Paddy UI

Mobile-first, corporate-facing inventory management SPA — the frontend for Procure Paddy. Talks
to [`stock-bridge-api`](../stock-bridge-api) over a JWT-secured REST API.

See the root [`APP_TOUR.md`](../APP_TOUR.md) for a feature-by-feature walkthrough and demo login
credentials, and [`ENVIRONMENT.md`](../ENVIRONMENT.md) for every environment variable across the
whole system. See [`DESIGN.md`](./DESIGN.md) for the color/typography/spacing tokens, and
[`DEPLOYMENT.md`](./DEPLOYMENT.md) for how this gets built and hosted on Netlify.

## Tech stack

- React 19 + TypeScript, built with Vite
- Tailwind CSS v4
- React Router v7
- react-hook-form + zod for forms/validation
- axios for API calls
- recharts for the analytics dashboard
- oxlint for linting

## Prerequisites

- Node.js (a current LTS release)
- A running instance of `stock-bridge-api` to point at — see that project's README for how to
  start it (fastest path: `docker compose up --build` from the repo root)

## Getting started

```bash
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if the backend isn't on localhost:8080
npm run dev
```

## Environment variables

Only one, required for anything beyond the default local setup:

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API. | `http://localhost:8080` |

See [`../ENVIRONMENT.md`](../ENVIRONMENT.md) for the full picture, including every backend env
var this frontend's CORS access depends on (`FRONTEND_ORIGIN`). Vite only reads `.env` at build
time — restart `npm run dev` (or rebuild) after changing it.

## Building for production

```bash
npm run build
```

Type-checks the project (`tsc -b`) and produces a static build in `dist/`, ready to be served by
any static file server (e.g. nginx) or static hosting provider. Set `VITE_API_BASE_URL` to the
deployed backend's URL before building — it's baked into the build output, not read at runtime.

`npm run preview` serves that `dist/` build locally, useful for a final sanity check before
deploying.

### Two pages: the app and the landing page

The build makes two HTML entries (LANDING_PAGE_PLAN.md, step 2):

- **`index.html`** is the app: the workspace, the marketplace (`/marketplace/…`) and every unknown
  path's fallback. The service worker caches it for offline use.
- **`landing.html`** is the Procurepaddy home page at `/`: its own small bundle
  (`src/marketing/`), rendered to real HTML at build time by `scripts/prerender.mjs` so search
  engines read it without running JavaScript. The same step writes `sitemap.xml` and `robots.txt`.

Netlify serves `landing.html` at `/` and moves the marketplace's old addresses (`/product/…`,
`/cart`, `/checkout/return?…`) to `/marketplace` with their query strings (`public/_redirects`).
`npm run dev` and `npm run preview` route the same way.

With `VITE_FOUNDING_OFFER=true` the home page is the full founding-offer page (step 3): static HTML
with small interactive islands (`src/marketing/islands/`: the setup form, the live counts, the hero
receipt, the sticky phone button), calling the API's public `/api/public/founding-offer` and
`/api/public/setup-requests`. Staging builds it; production keeps the early-access page until the
owners switch it on, and the build refuses that until `src/marketing/founders.ts` is filled in.
`/founding` (`founding.html`) is the same offer with no navigation, for ads and outreach: always
noindex and canonical to `/`; with the offer off it redirects to `/`. After "Book my setup", sign-up
needs only a password (`/signup?setup=…&business=…&whatsapp=…`), the owner logs in with their
WhatsApp number, and super admins answer the request from `/admin/setup-requests` (step 4). An
owner's dashboard then shows the setup checklist with "Send us your list" (`src/features/onboarding/`);
the team loads the list from inside the shop as Procurepaddy support and follows each shop's first
week at `/admin/first-week` (step 5).
`VITE_POSTHOG_KEY` (and optionally `VITE_POSTHOG_HOST`) turns on the funnel events. Build settings
for the landing page, all optional: `SITE_URL` (canonical origin, default `https://procurepaddy.com`), `SITE_NOINDEX=true`
(staging and previews set it), `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` (the
search consoles' HTML-tag codes).

Hosted builds run this same command on Netlify — `main` for production, `staging` for the
staging branch deploy, each built against its own `VITE_API_BASE_URL`. See
[`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Folder structure

```
src/
  api/         API client (axios instance + interceptors) and per-resource API modules
               (authApi.ts, and later productsApi.ts, inventoryApi.ts, etc.)
  auth/        AuthContext/AuthProvider, useAuth hook, RequireAuth/RequireSuperAdmin route guards
  components/  Shared, reusable UI components (Logo, buttons, inputs, ...) — not tied to
               a single feature
  features/    One folder per business domain: products, inventory, analytics, users, admin.
               Each holds its own components/hooks/api calls.
  layouts/     Page shells (AppLayout for the tenant app, AdminLayout for /admin/*)
  pages/       Route-level components — thin wrappers that compose layouts + feature components
  routes/      Router configuration (route tree, guards wiring)
  types/       Shared TypeScript types used across features (api.ts, auth.ts)
  utils/       Small framework-agnostic helpers (storage.ts, jwt.ts)
```

The split between `pages/` and `features/` keeps route wiring separate from business logic:
a page is "which URL renders what," a feature is "how that domain actually works." Shared,
generic UI goes in `components/`; anything specific to one business domain goes in that
domain's `features/<name>/` folder instead.

## Auth model

Two independent auth flows against the backend, distinguished by JWT audience — not a single
merged "user" type:

- **Tenant users** log in with a client identifier + username + password (`/api/auth/*`).
- **Super admins** log in with just username + password (`/api/superadmin/auth/*`), and only
  ever see `/admin/*` routes.

The access token is kept in memory only (never localStorage) and attached to requests by an
axios request interceptor; only the refresh token and the last-used client identifier are
persisted, so a page reload silently re-authenticates via `/refresh` while a stolen
`localStorage` dump alone can't be replayed as a live session. See `src/auth/AuthContext.tsx`
and `src/api/client.ts` for the full flow, including the single-retry-on-401 refresh logic.
