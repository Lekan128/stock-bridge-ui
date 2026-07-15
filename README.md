# Stock Bridge UI

Mobile-first, corporate-facing inventory management SPA — the frontend for Stock Bridge. Talks
to [`stock-bridge-api`](../stock-bridge-api) over a JWT-secured REST API.

See the root [`APP_TOUR.md`](../APP_TOUR.md) for a feature-by-feature walkthrough and demo login
credentials, and [`ENVIRONMENT.md`](../ENVIRONMENT.md) for every environment variable across the
whole system. See [`DESIGN.md`](./DESIGN.md) for the color/typography/spacing tokens.

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
