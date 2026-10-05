# End-to-end suites

Plain Node scripts that drive a real Chromium against a **production build** of this app and the
**real API**. They exist to prove the offline-first promises (`INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md`,
Phase H): nothing recorded on a phone is ever lost, the app opens with no signal, and the numbers
the plan sets are met. Each suite signs up its own company, so they can run against a shared
database and in any order.

## Running them

You need three things running:

1. **Postgres**, from the API repo: `docker compose up -d` (container `stock-bridge-postgres`).
2. **The API on 8081**, from `stock-bridge-api`, with JDK 25:

   ```sh
   FRONTEND_ORIGIN='http://localhost:4173' ./mvnw spring-boot:run \
     -Dspring-boot.run.profiles=local -Dspring-boot.run.arguments=--server.port=8081
   ```

3. **A production build on 4173**, from this repo. Not `npm run dev`: the service worker, the
   precache and code splitting only exist in a build.

   ```sh
   VITE_API_BASE_URL=http://localhost:8081 npm run build
   npx vite preview --port 4173
   ```

Then:

```sh
npm run e2e                     # every suite, in order, with a summary
npm run e2e -- chaos metrics    # just these
node e2e/suites/chaos.e2e.mjs   # one suite on its own
```

A browser: `npx playwright install chromium`. If that download is blocked, any headless Chromium
already in the Playwright cache is used, or point `E2E_CHROMIUM` at one.

Screenshots — the ones suites take on purpose, and one per page whenever a check fails — land in
`e2e/shots/` (git-ignored).

## Settings

| Variable | Default | |
|---|---|---|
| `E2E_API` | `http://localhost:8081` | the API |
| `E2E_UI` | `http://localhost:4173` | the preview build |
| `E2E_CHROMIUM` | Playwright's own | a Chromium binary |
| `E2E_PSQL` | `docker exec -i stock-bridge-postgres psql …` | used to seed large catalogues fast |
| `E2E_SCALE=1` | off | adds the 100,000-product run to `catalog` (a few minutes) |
| `NET=3g` | off | `metrics` on Chrome's Fast 3G as well as a 4× slower CPU |
| `A11Y_REPORT=1` | off | `a11y` prints axe findings without failing |

## The suites

| Suite | What it proves |
|---|---|
| `urgent-fixes` | The session survives an unreachable server at startup; only a refused refresh logs out. |
| `pwa-shell` | Installable; opens offline straight into the workspace; updates wait for the user. |
| `lost-refresh` | A token refresh whose reply is lost doesn't log the user out (D7). |
| `data-layer` | Screens open from the saved copy, marked as such, and refresh behind it. |
| `catalog` | The on-device catalogue: search and filters offline, deletes, logout wipes it; at 100k, sync time, search latency, rows rendered, memory. |
| `outbox` | Stock writes offline are kept, ordered, sent once (Idempotency-Key), and reconciled. |
| `drafts` | Half-filled forms survive a closed tab, and are cleared when finished. |
| `sync-centre` | The pill and the centre: what is waiting, what was sent, what needs you. |
| `foundation` | Buttons, sheets, stock figures, stamps, toasts with Undo. |
| `inventory` | The list: one bar, quick +/−, keys, phone selection. |
| `product` | The product page, its ledger, pending rows. |
| `sheets` | Stock in / out / count sheets and the receipt. |
| `quick` | Quick mode: scan, keypad, stamp, offline, Undo. |
| `dashboard` | Stock health, Needs you today, the chart, offline. |
| `chaos` | Zero lost writes with the tab killed; a lost reply recorded once; two phones counting and selling; a permission removed while offline. |
| `metrics` | Taps to record a stock-in, time to first product row cold and warm (targets in the plan). |
| `a11y` | axe on the key screens at phone and laptop size; sheet focus; announcements; 44 px targets in quick mode. |

## Writing one

Copy the shape of an existing suite: `check(name, fn)` records PASS/FAIL and screenshots every
page on failure; the last line prints `N/M passed` (the runner reads it) and the exit code is the
verdict. Seed through the API as the owner of a fresh company; reach for `psql` only for volume.

Wait for what the user would wait for — a heading, a row, a stamp — never a fixed sleep. And wait
for the thing you mean: a heading can be drawn from what the phone already holds before the
request behind it answers, so a check that goes offline next waits for that response and its save
(see `openProduct` in `chaos`).
