// Where the end-to-end suites point, and how they run (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md,
// Phase H). Everything machine-specific lives here, read from the environment with local defaults:
//
//   E2E_API       the API                       default http://localhost:8081
//   E2E_UI        the production preview        default http://localhost:4173
//   E2E_CHROMIUM  a Chromium binary to use      default: Playwright's own (npx playwright install chromium)
//   E2E_PSQL      a psql command for the 100k   default: docker exec into stock-bridge-postgres
//                 scale seed (catalog suite)
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

export const API = process.env.E2E_API ?? 'http://localhost:8081'
export const UI = process.env.E2E_UI ?? 'http://localhost:4173'
export const launchOptions = { executablePath: chromiumPath() }
export const psqlCommand =
  process.env.E2E_PSQL ?? 'docker exec -i stock-bridge-postgres psql -U stock_bridge -d stock_bridge -tAq'

const shotsDir = fileURLToPath(new URL('./shots/', import.meta.url))

/** Where a suite writes its screenshots (failures, and the ones it takes on purpose). Git-ignored. */
export function shotsPrefix(suite) {
  mkdirSync(shotsDir, { recursive: true })
  return `${shotsDir}${suite}-`
}

/**
 * The browser: E2E_CHROMIUM if set; else the one this Playwright expects (`npx playwright install
 * chromium`); else the newest headless Chromium already in the Playwright cache — so a machine that
 * has some Playwright browser installed, but not this exact build, still runs the suites.
 */
function chromiumPath() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM
  const own = chromium.executablePath()
  if (existsSync(own)) return own
  const cache =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    (platform() === 'darwin' ? join(homedir(), 'Library/Caches/ms-playwright') : join(homedir(), '.cache/ms-playwright'))
  const builds = existsSync(cache)
    ? readdirSync(cache)
        .filter((name) => name.startsWith('chromium_headless_shell-'))
        .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    : []
  for (const build of builds) {
    const dir = join(cache, build)
    for (const sub of readdirSync(dir)) {
      const binary = join(dir, sub, 'chrome-headless-shell')
      if (existsSync(binary)) return binary
    }
  }
  return own // missing: Playwright's own error then says to run `npx playwright install chromium`
}
