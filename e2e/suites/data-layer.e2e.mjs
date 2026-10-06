// End-to-end checks for A2 (cached data layer), against the production preview (4173, with the
// A1 service worker) and the real API (8081). Seeds its own company.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('data-layer')

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
      console.log('    page:', pg.url())
      await pg.screenshot({ path: SHOTS + `fail-${results.length}-${i++}.png` }).catch(() => {})
    }
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// ---------------------------------------------------------------------------------- seeding
async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : null }
}
const unique = randomUUID().slice(0, 8)
const signup = await api('/api/clients/signup', {
  method: 'POST',
  body: {
    name: `E2E Cache ${unique}`,
    adminEmail: `cache-${unique}@example.com`,
    password: 'correct-horse-battery-staple',
    confirmPassword: 'correct-horse-battery-staple',
  },
})
const token = signup.json.tokens.accessToken
const units = (await api('/api/products/units-of-measure', { token })).json
const kg = units.find((u) => /kilogram/i.test(u.label)).code
const bag = units.find((u) => /^bag/i.test(u.label)).code
async function createProduct(name, extra = {}) {
  const form = new FormData()
  form.append(
    'product',
    new Blob([JSON.stringify({ name, sku: `C-${name.replace(/\W+/g, '').slice(0, 8)}-${unique}`, lowStockThreshold: 10, ...extra })], {
      type: 'application/json',
    }),
  )
  const res = await api('/api/products', { token, method: 'POST', body: form })
  assert(res.status < 300, `create ${name}: ${res.status}`)
  return res.json
}
const rice = await createProduct('Rice (cache)', { unitOfMeasure: kg, packagingUnit: bag, packagingSize: 50 })
await api(`/api/products/${rice.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 1000 } })
const beans = await createProduct('Beans (cache)', { unitOfMeasure: kg })
await api(`/api/products/${beans.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 5 } })
const garri = await createProduct('Garri (never opened)', { unitOfMeasure: kg })

// ---------------------------------------------------------------------------------- browser
const browser = await chromium.launch(launchOptions)
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } })
await context.addInitScript(
  ([rt]) => {
    if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('sb.refreshToken', rt)
      localStorage.setItem('__seeded', '1')
    }
  },
  [signup.json.tokens.refreshToken],
)
/** An online page load that waits for its startup token refresh to land. */
async function open(page, url) {
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'), { timeout: 15000 })
  await page.goto(url)
  await refreshed
}
async function goOnline(page) {
  const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'), { timeout: 15000 }).catch(() => null)
  await context.setOffline(false)
  await refreshed
  await page.waitForTimeout(500)
}
const swControlled = (page) =>
  page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })
/** Waits for the throttled (1 s) cache write to reach IndexedDB. */
const persisted = (page) => page.waitForTimeout(2000)

const page = await context.newPage()

await check('online visit fills the cache on the device', async () => {
  await open(page, `${UI}/app/products`)
  await page.getByRole('link', { name: 'Rice (cache)' }).waitFor()
  await swControlled(page)
  await persisted(page) // a person looks at the list before moving on
  await open(page, `${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice (cache)', level: 1 }).waitFor()
  await persisted(page)
  const stored = await page.evaluate(async () => {
    const name = (await indexedDB.databases()).map((d) => d.name).find((n) => n?.startsWith('procurepaddy-cache:'))
    if (!name) return 'no db'
    const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = rej })
    const all = await new Promise((res) => { const r = db.transaction('kv').objectStore('kv').getAll(); r.onsuccess = () => res(r.result) })
    db.close()
    return all.map((blob) => JSON.parse(blob).clientState.queries.map((q) => JSON.stringify(q.queryKey) + ':' + q.state.status)).flat()
  })
  console.log('    stored queries:', JSON.stringify(stored))
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))
  assert(dbs.some((n) => n?.startsWith('procurepaddy-cache:')), `no cache database: ${dbs.join(', ')}`)
})

await check('offline: the Inventory list opens with the saved stock and says it is saved', async () => {
  await context.setOffline(true)
  await page.goto(`${UI}/app/products`)
  await page.getByRole('link', { name: 'Rice (cache)' }).waitFor({ timeout: 10000 })
  await page.getByRole('link', { name: 'Beans (cache)' }).waitFor()
  await page.getByText(/Offline · showing stock levels as of/).waitFor({ timeout: 10000 })
  await page.screenshot({ path: SHOTS + '2-offline-list.png' })
})

await check('offline: a product opened before shows its saved figures', async () => {
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice (cache)', level: 1 }).waitFor({ timeout: 10000 })
  await page.getByText(/Offline · showing this product as of/).waitFor()
  const body = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  assert(/1,000/.test(body), 'saved on-hand figure not shown')
  await page.screenshot({ path: SHOTS + '3-offline-detail.png' })
})

await check('offline: a product never opened says so plainly, no blank page', async () => {
  await page.goto(`${UI}/app/products/${garri.id}`)
  await page.getByText(/You're offline/).first().waitFor({ timeout: 10000 })
})

await check('offline: the edit form refuses to fill from a saved copy', async () => {
  await page.goto(`${UI}/app/products/${rice.id}/edit`)
  await page.getByText("Couldn't open this product for editing").waitFor({ timeout: 10000 })
  assert((await page.getByLabel(/^Name/).count()) === 0, 'an edit form rendered with no fresh product behind it')
  await page.screenshot({ path: SHOTS + '5-offline-edit.png' })
})

await check('back online: the note goes away and figures refresh', async () => {
  await page.goto(`${UI}/app/products`).catch(() => {})
  await goOnline(page)
  await page.reload()
  await page.getByRole('link', { name: 'Rice (cache)' }).waitFor()
  await page.waitForTimeout(1000)
  assert((await page.getByText(/showing stock levels as of/).count()) === 0, 'saved-data note still shown online')
})

await check('revisiting a screen shows the cached rows at once, while the refresh is slow', async () => {
  await open(page, `${UI}/app/products`)
  await page.getByRole('link', { name: 'Beans (cache)' }).waitFor()
  await page.getByRole('link', { name: 'Beans (cache)' }).click()
  await page.getByRole('heading', { name: 'Beans (cache)', level: 1 }).waitFor()
  // Every list request now takes 3 s.
  await page.route(`${API}/api/products?**`, async (route) => {
    await new Promise((r) => setTimeout(r, 3000))
    await route.continue()
  })
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('link', { name: 'Rice (cache)' }).waitFor({ timeout: 1000 })
  await page.unroute(`${API}/api/products?**`)
})

await check('after a stock-in, the list already shows the new quantity on Back', async () => {
  await page.getByRole('link', { name: 'Beans (cache)' }).click()
  await page.getByRole('heading', { name: 'Beans (cache)', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Stock In' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill('20')
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  // Hold the list's refresh, so what shows is the cache.
  await page.route(`${API}/api/products?**`, async (route) => {
    await new Promise((r) => setTimeout(r, 4000))
    await route.continue()
  })
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  const row = page.getByRole('row', { name: /Beans \(cache\)/ })
  await row.waitFor({ timeout: 1500 })
  const text = (await row.innerText()).replace(/\s+/g, ' ')
  assert(/\b25\b/.test(text), `list row still shows the old quantity: "${text}"`)
  await page.unroute(`${API}/api/products?**`)
})

await check('logging out deletes the saved cache from the device', async () => {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await page.waitForURL(`${UI}/`)
  await page.waitForTimeout(1500)
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))
  assert(!dbs.some((n) => n?.startsWith('procurepaddy-cache:')), `cache survived logout: ${dbs.join(', ')}`)
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
