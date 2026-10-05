// End-to-end checks for A1 (installable, offline-opening app shell), against a production build
// served by `vite preview` (4173) and the real API (8081). Seeds its own company.
import { chromium, devices } from 'playwright'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'

// The app itself: this suite rebuilds it to stage a "new deploy".
const UI_DIR = fileURLToPath(new URL('../../', import.meta.url))
const SHOTS = shotsPrefix('pwa-shell')

const results = []
async function check(name, fn) {
  try {
    await fn()
    results.push(['PASS', name])
    console.log('PASS', name)
  } catch (err) {
    results.push(['FAIL', name, err.message])
    console.log('FAIL', name, '\n   ', err.message.split('\n')[0])
    let i = 0
    for (const ctx of browser.contexts()) for (const pg of ctx.pages()) {
      const heads = await pg.locator('h1').allInnerTexts().catch(() => [])
      console.log('    page:', pg.url(), 'h1:', JSON.stringify(heads))
      await pg.screenshot({ path: SHOTS + `fail-${results.length}-${i++}.png` }).catch(() => {})
    }
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// Start every run from the same baseline build, so the "new deploy" in the update check below
// always differs from what the browser has installed.
execSync('npm run build', {
  cwd: UI_DIR,
  env: { ...process.env, VITE_API_BASE_URL: API },
  stdio: 'ignore',
})

// ---------------------------------------------------------------------------------- seeding
const unique = randomUUID().slice(0, 8)
const signup = await fetch(`${API}/api/clients/signup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: `E2E PWA ${unique}`,
    adminEmail: `pwa-${unique}@example.com`,
    password: 'correct-horse-battery-staple',
    confirmPassword: 'correct-horse-battery-staple',
  }),
}).then((r) => r.json())
let refreshToken = signup.tokens.refreshToken

const browser = await chromium.launch(launchOptions)

async function signedInContext(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...options })
  // Seed once per browser profile, not once per tab: sessionStorage is per tab, so keying on it
  // re-wrote the run's FIRST (long since rotated) token into every new tab of a shared profile.
  await context.addInitScript(
    ([rt]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('__seeded', '1')
      }
    },
    [refreshToken],
  )
  return context
}
async function keepRefreshToken(page) {
  refreshToken = await page.evaluate(() => localStorage.getItem('sb.refreshToken'))
}
/**
 * Back online, the restored session refreshes its token. Closing the tab mid-refresh loses the
 * reply and, with today's single-use refresh tokens, the session (reported separately). Wait for
 * that refresh to land, so these checks test the shell rather than that bug.
 */
/** An online page load, waiting for its startup token refresh to land before moving on. */
async function open(page, url) {
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'), { timeout: 15000 })
  await page.goto(url)
  await refreshed
  await page.waitForTimeout(300)
  await keepRefreshToken(page)
}

async function reconnect(page) {
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'), { timeout: 15000 })
  await context.setOffline(false)
  await refreshed
  await page.waitForTimeout(300)
  await keepRefreshToken(page)
}
const swControlled = (page) =>
  page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })

// 1. Anonymous shoppers never get the workspace's service worker.
await check('storefront visitor gets no service worker', async () => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${UI}/`)
  await page.waitForTimeout(2500)
  const registered = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))
  assert(!registered, 'a service worker was registered for an anonymous storefront visit')
  await context.close()
})

// 2-5 share one signed-in browser profile, like one phone over a day.
const context = await signedInContext()

await check('workspace installs the shell and says it now works offline', async () => {
  const page = await context.newPage()
  await open(page, `${UI}/app/products`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  await swControlled(page)
  await page.getByText('Procure Paddy will now open on this device, even without a connection.').waitFor({ timeout: 10000 })
  await page.screenshot({ path: SHOTS + '2-offline-ready.png' })
  await page.close()
})

await check('manifest is installable (name, start_url, standalone, 192/512/maskable icons)', async () => {
  const manifest = await fetch(`${UI}/manifest.webmanifest`).then((r) => r.json())
  assert(manifest.start_url === '/app' && manifest.display === 'standalone', 'start_url/display wrong')
  const sizes = manifest.icons.map((i) => `${i.sizes}:${i.purpose}`)
  for (const want of ['192x192:any', '512x512:any', '512x512:maskable']) assert(sizes.includes(want), `missing ${want}`)
  for (const icon of [...manifest.icons, { src: '/icons/apple-touch-icon-180.png' }]) {
    const res = await fetch(UI + icon.src)
    assert(res.ok && res.headers.get('content-type')?.includes('png'), `${icon.src} not served as png`)
  }
})

await check('offline: a reload opens straight into the workspace, still signed in', async () => {
  const page = await context.newPage()
  await open(page, `${UI}/app`)
  await swControlled(page)
  await context.setOffline(true)
  await page.goto(`${UI}/app/products`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor({ timeout: 10000 })
  assert(page.url().endsWith('/app/products'), `ended on ${page.url()}`)
  // The top-bar badge (exact text), and — since A2 — the saved-data note, or the offline error
  // for a screen with nothing saved.
  await page.getByRole('status').filter({ hasText: /^Offline$/ }).waitFor()
  await page.getByText(/You're offline|Couldn't reach|Offline · showing/).first().waitFor({ timeout: 10000 })
  await page.screenshot({ path: SHOTS + '4-offline-reload.png' })
  await reconnect(page)
  await page.close()
})

await check('offline: a screen never opened before still loads (its code is precached)', async () => {
  const page = await context.newPage()
  await open(page, `${UI}/app`)
  await swControlled(page)
  await context.setOffline(true)
  // A fresh tab straight onto deep links whose code-split chunks this profile never fetched.
  for (const [path, heading] of [
    ['/app/products/receive', /delivery/i],
    ['/app/stock-movements', /stock movements/i],
  ]) {
    await page.goto(UI + path)
    await page.getByRole('heading', { level: 1, name: heading }).waitFor({ timeout: 10000 })
  }
  await reconnect(page)
  await page.close()
})

await check('update waits for the user, then Reload switches to the new version', async () => {
  const page = await context.newPage()
  await open(page, `${UI}/app/products`)
  await swControlled(page)
  const oldEntry = await page.evaluate(() => document.querySelector('script[type="module"]')?.getAttribute('src'))

  // Ship a "new deploy": same code, different baked-in base URL, so the entry chunk's hash moves.
  execSync('npm run build', {
    cwd: UI_DIR,
    env: { ...process.env, VITE_API_BASE_URL: `${API}/` },
    stdio: 'ignore',
  })

  // Type into the search box first: an update must never throw this away on its own.
  await page.getByLabel('Search products').fill('half-typed')
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update())
  await page.getByText('A new version of Procure Paddy is ready').waitFor({ timeout: 20000 })
  await page.waitForTimeout(1500)
  assert(
    (await page.getByLabel('Search products').inputValue()) === 'half-typed',
    'the page reloaded on its own and lost what was typed',
  )
  await page.screenshot({ path: SHOTS + '5-update-ready.png' })

  // "Later" hides it; the next load offers it again.
  await page.getByRole('button', { name: 'Later' }).click()
  assert((await page.getByText('A new version of Procure Paddy is ready').count()) === 0, 'Later did not hide it')
  const reloaded = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'))
  await page.reload()
  await reloaded
  await keepRefreshToken(page)
  await page.getByText('A new version of Procure Paddy is ready').waitFor({ timeout: 15000 })

  const afterUpdate = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'))
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Reload' }).click()])
  await afterUpdate
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  const newEntry = await page.evaluate(() => document.querySelector('script[type="module"]')?.getAttribute('src'))
  assert(newEntry && newEntry !== oldEntry, `still on the old version (${oldEntry})`)
  assert((await page.getByText('A new version of Procure Paddy is ready').count()) === 0, 'prompt still shown')
  await keepRefreshToken(page)
  await page.close()
})

await check('account menu offers "Install Procure Paddy" only when the browser can install', async () => {
  const page = await context.newPage()
  await open(page, `${UI}/app`)
  await page.getByRole('button', { name: 'Account menu' }).click()
  assert((await page.getByRole('menuitem', { name: 'Install Procure Paddy' }).count()) === 0, 'shown with no prompt')
  await page.getByRole('button', { name: 'Account menu' }).click()

  // Simulate Chromium offering installation.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = () => {
      window.__installPrompted = true
      return Promise.resolve()
    }
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)
  })
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Install Procure Paddy' }).click()
  assert(await page.evaluate(() => window.__installPrompted === true), 'browser install dialog not requested')
  await page.close()
})
await context.close()

await check('iPhone: Add to Home Screen hint shows, and stays dismissed', async () => {
  const iphone = await signedInContext({ ...devices['iPhone 13'] })
  const page = await iphone.newPage()
  await open(page, `${UI}/app`)
  const hint = page.getByText(/Add Procure Paddy to your Home Screen/)
  await hint.waitFor({ timeout: 10000 })
  await keepRefreshToken(page)
  await page.screenshot({ path: SHOTS + '7-ios-hint.png' })
  await page.getByRole('button', { name: 'Dismiss the Home Screen tip' }).click()
  const r2 = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'))
  await page.reload()
  await r2
  await keepRefreshToken(page)
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  assert((await hint.count()) === 0, 'hint came back after dismissing')
  await iphone.close()

  const desktop = await signedInContext()
  const p2 = await desktop.newPage()
  await open(p2, `${UI}/app`)
  await p2.getByRole('heading', { level: 1 }).first().waitFor()
  await keepRefreshToken(p2)
  assert((await p2.getByText(/Add Procure Paddy to your Home Screen/).count()) === 0, 'hint shown on desktop')
  await desktop.close()
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
