# Deployment

The frontend is a static build hosted on Netlify. Netlify watches this repo directly - there is
no GitHub Actions workflow on this side - and builds whatever branch it is configured to deploy:

```
push to main     →  Netlify builds  →  production site (procurepaddy.com)
push to staging  →  Netlify builds  →  branch deploy   (staging--<site-name>.netlify.app)
```

Build settings live in [`netlify.toml`](./netlify.toml) rather than the Netlify UI, so they
change through review like any other code. SPA routing comes from `public/_redirects`, which
Vite copies into `dist/` at build time.

## The one thing that makes staging non-trivial

`VITE_API_BASE_URL` is **baked into the JavaScript bundle at build time**, not read at runtime.
A staging site is therefore not "the same build pointed somewhere else" - it is a genuinely
different build, and the only thing that decides which backend it talks to is the value of that
variable at the moment Netlify ran `npm run build`. That is why `netlify.toml` sets it per deploy
context instead of once globally.

Two consequences worth internalising:

- Changing the variable in Netlify does nothing to an already-deployed site. You have to
  redeploy for a new value to take effect.
- A staging build that silently used production's value would be indistinguishable from a
  working staging site - right up until it writes to the production database. Check what a
  deploy actually points at (Network tab, or search `onrender` in the built assets) the first
  time you set this up.

## One-time setup

1. **Enable branch deploys for `staging`.** Netlify UI > Site configuration > Build & deploy >
   Branches and deploy contexts. Either "Deploy all branches" or, better, add `staging` to
   "Let me add individual branches". Without this, pushes to `staging` are ignored entirely and
   nothing in `netlify.toml` matters. Production stays whatever branch is set as the production
   branch (`main`).

2. **Replace the placeholder in `netlify.toml`.** `[context.staging.environment]` and
   `[context.deploy-preview.environment]` both point at
   `https://REPLACE-WITH-STAGING-API.onrender.com`. Set both to the staging Render service's
   real URL - see [`../stock-bridge-api/DEPLOYMENT.md`](../stock-bridge-api/DEPLOYMENT.md) for
   creating that service. Until this is done the staging site builds fine and fails every API
   call.

3. **Leave production's `VITE_API_BASE_URL` in the Netlify UI.** There is deliberately no
   `[context.production.environment]` block in `netlify.toml`: variables declared there override
   the UI ones, so adding production to the file would repoint the live site the moment the value
   drifted from what the UI has. Production keeps reading from Site configuration >
   Environment variables.

4. **Allow the staging site's origin on the staging API.** Set `FRONTEND_ORIGIN` on the *staging*
   Render service to the branch deploy's URL (`https://staging--<site-name>.netlify.app`).
   The backend has no wildcard fallback in `prod`, so a mismatch here fails every request from
   the staging site with a CORS error rather than an obvious 4xx. See
   [`../ENVIRONMENT.md`](../ENVIRONMENT.md).

   Deploy previews get a different URL per PR (`deploy-preview-<n>--<site-name>.netlify.app`),
   so if you want previews working against staging, that pattern has to be allowed too -
   `FRONTEND_ORIGIN` is a comma-separated list, but it matches exact origins, not wildcards.
   Skipping this just means previews can't call the API.

## Promoting staging to production

Nothing automatic. `staging` and `main` are ordinary branches: merge `staging` into `main` (via
PR) and Netlify's production build runs on the merge commit. The backend is promoted separately -
merging `staging` into `main` in `stock-bridge-api` is what ships the API.

Because the two repos deploy independently, a change that spans both (a new endpoint plus the UI
that calls it) is live on staging only once *both* staging deploys finish, and in production only
once both merges land. Merge the API first when the UI depends on new endpoints.

## Checking what is deployed

Netlify UI > Deploys shows the branch and commit for every deploy, and lets you roll back by
publishing an earlier one. The staging branch deploy has its own permanent URL
(`staging--<site-name>.netlify.app`) that always serves the latest `staging` build.
