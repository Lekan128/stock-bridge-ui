// Phase H metrics, measured rather than claimed: taps to record a stock-in from the list (target
// ≤ 4) and time to the first product row, cold (< 1.5 s) and warm (< 300 ms). Cold is a first
// visit with nothing on the phone; warm is reopening the app, everything on the phone. Each runs twice: as
// a laptop would, and as a mid-range phone (CPU throttled 4×, optionally Fast 3G with NET=3g).
// Search latency at 100k lives in the catalogue suite's scale run (E2E_SCALE=1).
//
// "First product row" is performance.now() when the first [data-product-row] enters the page,
// which counts from the navigation's start - so it includes the service worker, the token refresh
// and whatever the list waits on, exactly what the storekeeper waits through.
import { chromium } from 'playwright'
import { API, UI, launchOptions, psqlCommand } from '../config.mjs'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const TARGET = { taps: 4, coldMs: 1500, warmMs: 300 }
const results = []
const metrics = {}
function record(name, ok, detail) {
  results.push([ok ? 'PASS' : 'FAIL', name])
  console.log(ok ? 'PASS' : 'FAIL', name, detail ? `— ${detail}` : '')
}
const psql = (sql) => execSync(psqlCommand, { input: sql }).toString().trim()
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

// A company with 500 products, about what a shop on its first month would have.
const unique = randomUUID().slice(0, 8)
const signup = await fetch(`${API}/api/clients/signup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: `E2E Metrics ${unique}`,
    adminEmail: `metrics-${unique}@example.com`,
    password: 'correct-horse-battery-staple',
    confirmPassword: 'correct-horse-battery-staple',
  }),
}).then((r) => r.json())
const clientId = psql(`SELECT id FROM clients WHERE name LIKE 'E2E Metrics ${unique}%' LIMIT 1;`)
psql(`
  INSERT INTO products (client_id, name, sku, quantity_on_hand, low_stock_threshold, unit_of_measure, packaging_unit, packaging_size, is_active)
  SELECT '${clientId}',
         (array['Rice','Beans','Garri','Palm oil','Sugar','Salt','Flour','Milk'])[1 + g % 8] || ' ' || lpad(g::text, 3, '0'),
         'MX-' || lpad(g::text, 4, '0'), (g * 37) % 500, 20, 'KG', 'BAG', 50, true
  FROM generate_series(1, 500) g;`)

const browser = await chromium.launch(launchOptions)
let refreshToken = signup.tokens.refreshToken

async function phoneProfile({ throttle }) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })
  await context.addInitScript(
    ([rt]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('__seeded', '1')
      }
      const mark = () => {
        if (window.__firstRow === undefined && document.querySelector('[data-product-row]')) {
          window.__firstRow = performance.now()
        }
        return window.__firstRow !== undefined
      }
      new MutationObserver((_, observer) => mark() && observer.disconnect()).observe(document, {
        subtree: true,
        childList: true,
      })
    },
    [refreshToken],
  )
  const page = await context.newPage()
  if (throttle) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    if (process.env.NET === '3g') {
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      })
    }
  }
  return { context, page }
}
async function firstRowMs(page) {
  await page.waitForFunction(() => window.__firstRow !== undefined, null, { timeout: 30000 })
  return Math.round(await page.evaluate(() => window.__firstRow))
}
/** The next profile must start from the token this one rotated to (D7). */
async function keepToken(page) {
  refreshToken = (await page.evaluate(() => localStorage.getItem('sb.refreshToken'))) ?? refreshToken
}

for (const profile of [
  { name: 'laptop-class', throttle: false },
  { name: process.env.NET === '3g' ? 'mid-range phone, Fast 3G' : 'mid-range phone (4× CPU)', throttle: true },
]) {
  const { context, page } = await phoneProfile(profile)
  const m = (metrics[profile.name] = {})

  // Cold: a profile that has never opened the app. No service worker, nothing on the device.
  await page.goto(`${UI}/app/products`)
  m.coldFirstRowMs = await firstRowMs(page)
  await keepToken(page)
  // Let it finish installing and copying the catalogue, as it would after the first visit.
  await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 30000 })
  await page.getByRole('button', { name: /^All\s*[\d,]+$/ }).waitFor({ timeout: 60000 })
  await page.waitForTimeout(1000)

  // Warm: the same phone opening the app again. Median of five.
  const warm = []
  for (let i = 0; i < 5; i++) {
    await page.reload()
    warm.push(await firstRowMs(page))
    await keepToken(page)
    await page.waitForTimeout(500)
  }
  m.warmFirstRowMs = warm
  m.warmFirstRowMedianMs = median(warm)

  // Taps to record a stock-in, from the list. Typing the quantity is not a tap.
  let taps = 0
  const tap = async (locator) => {
    taps += 1
    await locator.tap()
  }
  const row = page.locator('[data-product-row]').first()
  const name = (await row.getByRole('link').first().innerText()).split('\n')[0].trim()
  await tap(row.getByRole('button', { name: `Stock in ${name}` }))
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill('2')
  await tap(dialog.getByRole('button', { name: 'Continue' }))
  await tap(dialog.getByRole('button', { name: 'Confirm' }))
  await dialog.locator('[data-receipt]').waitFor()
  m.tapsToRecord = taps
  await tap(dialog.getByRole('button', { name: 'Done' }))
  m.tapsBackToList = taps
  await keepToken(page)
  await context.close()

  record(`${profile.name}: stock-in recorded in ${m.tapsToRecord} taps, back on the list in ${m.tapsBackToList}`, m.tapsBackToList <= TARGET.taps, `target ≤ ${TARGET.taps}`)
  record(`${profile.name}: first visit (nothing on the phone yet), first row ${m.coldFirstRowMs} ms`, m.coldFirstRowMs < TARGET.coldMs, `target < ${TARGET.coldMs} ms`)
  record(`${profile.name}: reopening the app, first row ${m.warmFirstRowMedianMs} ms (median of ${warm.join(', ')})`, m.warmFirstRowMedianMs < TARGET.warmMs, `target < ${TARGET.warmMs} ms`)
}

await browser.close()
console.log('\nmetrics:', JSON.stringify(metrics))
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
