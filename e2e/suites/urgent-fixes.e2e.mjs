// End-to-end checks for the urgent offline/inventory fixes, against a real API (8081) and the
// Vite dev server (5174). Seeds its own company through the API so it never touches real data.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('urgent-fixes')

const results = []
async function check(name, fn) {
  try {
    await fn()
    results.push(['PASS', name])
    console.log('PASS', name)
  } catch (err) {
    results.push(['FAIL', name, err.message])
    console.log('FAIL', name, '\n   ', err.message.split('\n').slice(0, 3).join(' | '))
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

// ------------------------------------------------------------------------------------ seeding
async function api(path, { token, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null }
}

const unique = randomUUID().slice(0, 8)
const signup = await api('/api/clients/signup', {
  method: 'POST',
  body: {
    name: `E2E Offline ${unique}`,
    adminEmail: `e2e-${unique}@example.com`,
    password: 'correct-horse-battery-staple',
    confirmPassword: 'correct-horse-battery-staple',
  },
})
assert(signup.status === 200, `signup failed: ${signup.status}`)
const token = signup.json.tokens.accessToken
const refreshToken = signup.json.tokens.refreshToken

const units = (await api('/api/products/units-of-measure', { token })).json
const kg = units.find((u) => /kilogram/i.test(u.label))?.code
const bag = units.find((u) => /^bag/i.test(u.label))?.code
assert(kg && bag, 'could not find KG/BAG unit codes')

async function createProduct(name, extra = {}) {
  const form = new FormData()
  form.append(
    'product',
    new Blob([JSON.stringify({ name, sku: 'E2E-' + name.replace(/\W+/g, '').slice(0, 10) + '-' + unique, lowStockThreshold: 10, ...extra })], { type: 'application/json' }),
  )
  const res = await api('/api/products', { token, method: 'POST', body: form })
  assert(res.status === 200 || res.status === 201, `create ${name}: ${res.status} ${JSON.stringify(res.json)}`)
  return res.json
}
const rice = await createProduct('Rice (E2E)', { unitOfMeasure: kg, packagingUnit: bag, packagingSize: 50 })
await api(`/api/products/${rice.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 1000 } })
const beans = await createProduct('Beans (E2E)', { unitOfMeasure: kg })
await api(`/api/products/${beans.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 5 } })
const oldOil = await createProduct('Old palm oil (E2E)', { unitOfMeasure: kg })
await api(`/api/products/${oldOil.id}`, { token, method: 'DELETE' }) // deactivate

// ------------------------------------------------------------------------------------ browser
const browser = await chromium.launch(launchOptions)

/** A fresh browser profile that has signed in once before — refresh token in storage. */
async function signedInContext(viewport = { width: 1280, height: 860 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(
    ([rt]) => {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        sessionStorage.setItem('__seeded', '1')
      }
    },
    [currentRefreshToken],
  )
  return context
}
// Refresh tokens rotate; every context that refreshes hands back a new one, read from storage.
let currentRefreshToken = refreshToken
async function captureRefreshToken(page) {
  currentRefreshToken = await page.evaluate(() => localStorage.getItem('sb.refreshToken'))
}

// 1. Server unreachable at startup must NOT log the user out.
await check('session survives an unreachable server at startup (no logout)', async () => {
  const context = await signedInContext()
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  // The list itself, not just the page: only what the phone has seen can come back offline.
  await page.getByRole('link', { name: 'Rice (E2E)' }).waitFor()
  assert(
    (await page.evaluate(() => localStorage.getItem('sb.sessionProfile.v1'))) != null,
    'session profile was not remembered after a successful start',
  )

  // Reload with every API call failing as if the signal had dropped.
  await page.route(`${API}/**`, (route) => route.abort('internetdisconnected'))
  await page.reload()
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor({ timeout: 10000 })
  assert(page.url().includes('/app/products'), `expected to stay in the workspace, got ${page.url()}`)
  assert(
    (await page.evaluate(() => localStorage.getItem('sb.refreshToken'))) != null,
    'refresh token was wiped by a network failure',
  )
  // Since A2 the list it saw last time is still on screen, marked as a saved copy.
  await page.getByRole('link', { name: 'Rice (E2E)' }).waitFor({ timeout: 10000 })
  await page.getByText(/Couldn't reach the server · showing stock levels as of/).waitFor({ timeout: 10000 })
  await page.screenshot({ path: SHOTS + '1-unreachable-startup.png' })

  // Network comes back: the session resumes on its own and the saved copy is replaced.
  await page.unroute(`${API}/**`)
  // Reconnecting resyncs on its own (A3); "Try again" is only a shortcut if it hasn't yet.
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.getByRole('button', { name: 'Try again' }).click({ timeout: 2000 }).catch(() => {})
  await page.getByText(/showing stock levels as of/).waitFor({ state: 'detached', timeout: 15000 })
  await page.getByRole('link', { name: 'Rice (E2E)' }).waitFor({ timeout: 10000 })
  await captureRefreshToken(page)
  await context.close()
})

// 2. A REFUSED refresh still ends the session (the fix must not keep dead sessions alive).
await check('a refused refresh still logs out', async () => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.setItem('sb.refreshToken', 'not-a-real-token')
      sessionStorage.setItem('__seeded', '1')
    }
  })
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  await page.waitForURL(/\/login/, { timeout: 10000 })
  assert((await page.evaluate(() => localStorage.getItem('sb.refreshToken'))) == null, 'dead refresh token kept')
  await context.close()
})

// 3. Expired access token + refresh that gets no answer: no logout, no redirect.
await check('401 followed by an unanswered refresh does not log out', async () => {
  const context = await signedInContext()
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  await page.getByRole('link', { name: 'Rice (E2E)' }).waitFor()
  await captureRefreshToken(page)
  // The next request for stock (the list, or since A3 the catalogue's change feed) comes back 401
  // — the access token "expired" — and the refresh it triggers dies.
  await page.route(`${API}/api/products**`, (route) => route.fulfill({ status: 401, body: '' }))
  await page.route(`${API}/api/auth/refresh`, (route) => route.abort('internetdisconnected'))
  await page.evaluate(() => window.dispatchEvent(new Event('online'))) // triggers a catalogue sync
  await page.getByRole('button', { name: /^Low\s*\d*$/ }).click()
  await page.getByText(/Couldn't reach Procure Paddy|Couldn't reach the server · showing/).first().waitFor({ timeout: 15000 })
  assert(page.url().includes('/app/products'), `redirected to ${page.url()}`)
  assert((await page.evaluate(() => localStorage.getItem('sb.refreshToken'))) != null, 'session wiped')
  await context.close()
})

// 4. Offline indicator.
await check('offline pill appears when the device goes offline', async () => {
  const context = await signedInContext()
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  await page.getByRole('link', { name: 'Rice (E2E)' }).waitFor()
  await captureRefreshToken(page)
  await context.setOffline(true)
  await page.getByRole('status').filter({ hasText: /^Offline$/ }).waitFor({ timeout: 5000 })
  await page.screenshot({ path: SHOTS + '4-offline-pill.png' })
  await context.setOffline(false)
  await page.getByRole('status').filter({ hasText: /^Offline$/ }).waitFor({ state: 'detached', timeout: 5000 })
  await context.close()
})

// 5-8. Inventory list: one h1, default active, URL state + Back, real row links, no skeleton flash.
await check('inventory list: one h1, URL state survives Back, row is a real link', async () => {
  const context = await signedInContext()
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  await page.getByRole('link', { name: 'Rice (E2E)' }).waitFor()
  await captureRefreshToken(page)

  assert((await page.locator('h1').count()) === 1, `expected one h1, found ${await page.locator('h1').count()}`)
  assert(
    (await page.getByRole('link', { name: 'Old palm oil (E2E)' }).count()) === 0,
    'deactivated product shown by default',
  )
  assert(
    (await page.getByRole('link', { name: 'Rice (E2E)' }).getAttribute('href')) === `/app/products/${rice.id}`,
    'row name is not a link to the product',
  )

  await page.getByLabel('Search products').fill('e2e')
  await page.waitForURL(/q=e2e/, { timeout: 5000 })
  await page.getByRole('button', { name: /^Low\s*\d*$/ }).click()
  await page.waitForURL(/stockStatus=LOW/)
  await page.getByRole('button', { name: /^Low\s*\d*$/, pressed: true }).waitFor({ timeout: 5000 })
  // From the server or (A3) the device copy: wait for the filtered answer either way.
  await page.getByRole('link', { name: 'Rice (E2E)' }).waitFor({ state: 'detached', timeout: 10000 })
  await page.getByRole('link', { name: 'Beans (E2E)' }).waitFor()
  if ((await page.getByRole('link', { name: 'Rice (E2E)' }).count()) !== 0) {
    await page.screenshot({ path: SHOTS + 'debug-lowstock.png', fullPage: true })
    const hits = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/api/products?')))
    throw new Error('low-stock filter not applied; url=' + page.url() + ' requests=' + JSON.stringify(hits.slice(-4)))
  }
  const listUrl = page.url()

  console.log('   step: click non-name cell')
  // Click a non-name cell: the stretched link must still open the product.
  // A real pointer click at the SKU cell's centre. (Playwright's locator.click refuses here, and
  // rightly: the stretched link covers the cell, which is exactly the point.)
  const box = await page.getByRole('row', { name: /Beans \(E2E\)/ }).locator('td').nth(2).boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForURL(new RegExp(`/app/products/${beans.id}$`))
  console.log('   step: back')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.waitForURL(listUrl, { timeout: 5000 }).catch(() => {
    throw new Error(`Back went to ${page.url()} instead of ${listUrl}`)
  })
  assert((await page.getByLabel('Search products').inputValue()) === 'e2e', 'search box lost its text')
  await page.getByRole('link', { name: 'Beans (E2E)' }).waitFor()

  console.log('   step: tick')
  // Ticking a row selects it and does not navigate.
  await page.getByLabel('Select Beans (E2E)').check()
  assert(page.url() === listUrl, 'ticking a checkbox navigated')
  await page.getByText('1 product selected').waitFor()

  console.log('   step: status all')
  // Status filter "All" brings deactivated products back, and lives in the URL too.
  await page.getByRole('button', { name: /^All\s*\d*$/ }).click()
  // Status lives behind Filters since C1.
  await page.getByRole('button', { name: /^Filters/ }).click()
  await page.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: 'All', exact: true }).click()
  await page.waitForURL(/status=all/)
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Old palm oil (E2E)' }).waitFor()
  await page.screenshot({ path: SHOTS + '5-inventory-desktop.png', fullPage: true })
  await context.close()
})

await check('changing a filter never blanks the list', async () => {
  const context = await signedInContext()
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  await page.getByRole('link', { name: 'Rice (E2E)' }).waitFor()
  await captureRefreshToken(page)
  // Server list (rows dimmed while the next page loads) or device copy (instant): either way the
  // table never unmounts into a skeleton between answers.
  await page.route(`${API}/api/products?**`, async (route) => {
    await new Promise((r) => setTimeout(r, 1200))
    await route.continue()
  })
  await page.getByRole('button', { name: /^Out\s*\d*$/ }).click()
  await page.waitForTimeout(150)
  assert((await page.locator('.animate-pulse.rounded-md').count()) === 0 || (await page.getByRole('table').count()) > 0, 'list replaced by a skeleton')
  await page.getByText(/No products match your search\./).waitFor({ timeout: 5000 })
  await context.close()
})

// 9. Mobile card states the unit and the pack.
await check('mobile card shows unit and pack equivalent', async () => {
  const context = await signedInContext({ width: 390, height: 844 })
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  // Since C1 the card is a block with a stretched link, not one big link.
  const card = page.locator('div[data-product-row]').filter({ hasText: 'Rice (E2E)' }).first()
  await card.waitFor()
  await captureRefreshToken(page)
  const text = (await card.innerText()).replace(/\s+/g, ' ')
  assert(/1,000 kg usable/.test(text), `card text: ${text}`)
  assert(/20 bags/.test(text), `no pack line on card: ${text}`)
  await page.screenshot({ path: SHOTS + '9-inventory-mobile.png' })
  await context.close()
})

// 10. The headline fix: response lost after the server recorded a stock-in; user retries.
await check('stock-in retried after a lost response is recorded once', async () => {
  const context = await signedInContext()
  const page = await context.newPage()
  await page.goto(`${UI}/app/products/${beans.id}`)
  await page.getByRole('button', { name: 'Stock In' }).waitFor()
  await captureRefreshToken(page)
  const before = (await api(`/api/products/${beans.id}`, { token })).json.quantityOnHand

  let attempts = 0
  const keys = []
  await page.route(`${API}/api/products/${beans.id}/stock/stock-in`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    attempts += 1
    keys.push(route.request().headers()['idempotency-key'])
    if (attempts === 1) {
      await route.fetch() // the server really records it...
      return route.abort('connectionreset') // ...and the answer never arrives
    }
    return route.continue()
  })

  await page.getByRole('button', { name: 'Stock In' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill('7')
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await page.waitForTimeout(500)
  assert(attempts === 1, `expected the first write to have been sent, attempts=${attempts}`)
  // Since A4 nobody has to tap Confirm again: the write is kept on the phone and the outbox
  // resends it — with the SAME key, so the server answers with the stored result.
  await dialog.getByText('Saved on this phone').first().waitFor({ timeout: 5000 })
  await page.screenshot({ path: SHOTS + '10-lost-response.png' })
  await dialog.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(6000) // past the first back-off
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.getByRole('button', { name: /waiting to send|Sending/ }).waitFor({ state: 'detached', timeout: 30000 })
  assert(attempts === 2, `expected exactly one resend, attempts=${attempts}`)
  assert(keys[0] && keys[0] === keys[1], `resend did not reuse the key: ${keys.join(' / ')}`)

  const after = (await api(`/api/products/${beans.id}`, { token })).json.quantityOnHand
  assert(after - before === 7, `expected +7 once, got ${before} -> ${after}`)
  await page.screenshot({ path: SHOTS + '10-retried-once.png' })
  await context.close()
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
