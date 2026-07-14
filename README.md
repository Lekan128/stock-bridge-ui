# Stock Bridge UI

Mobile-first, corporate-facing inventory management SPA. React + TypeScript + Vite, Tailwind
CSS v4. See [`DESIGN.md`](./DESIGN.md) for the color/typography/spacing tokens.

## Getting started

```bash
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if the backend isn't on localhost:8080
npm run dev
```

## Folder structure

```
src/
  api/         API client (axios instance + interceptors) and per-resource API modules
               (authApi.ts, and later productsApi.ts, inventoryApi.ts, etc.)
  auth/        AuthContext/AuthProvider, useAuth hook, RequireAuth/RequireSuperAdmin route guards
  components/  Shared, reusable UI components (Logo, buttons, inputs, ...) — not tied to
               a single feature
  features/    One folder per business domain: products, inventory, analytics, users, admin.
               Each will hold its own components/hooks/api calls as they're built; empty for now.
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
