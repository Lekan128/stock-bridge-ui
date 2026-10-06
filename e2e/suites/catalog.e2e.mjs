// End-to-end checks for A3 (the on-device catalogue), against the production preview (4173) and
// the real API (8081). Part 1 checks behaviour on a small company; part 2 measures a 100,000-
// product company with the CPU throttled 4x to stand in for a mid-range phone.
import { chromium } from 'playwright'
import { API, UI, launchOptions, psqlCommand, shotsPrefix } from '../config.mjs'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('catalog')
const ONLY = process.env.ONLY // 'small' | 'scale'

const results = []
const metrics = {}
let browser
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
const psql = (sql) =>
  execSync(psqlCommand, { input: sql }).toString().trim()

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
async function signup(label) {
  const unique = randomUUID().slice(0, 8)
  const res = await api('/api/clients/signup', {
    method: 'POST',
    body: {
      name: `${label} ${unique}`,
      adminEmail: `${label.toLowerCase().replace(/\W/g, '')}-${unique}@example.com`,
      password: 'correct-horse-battery-staple',
      confirmPassword: 'correct-horse-battery-staple',
    },
  })
  return { ...res.json, unique }
}
async function createProduct(token, unique, name, extra = {}) {
  const form = new FormData()
  form.append(
    'product',
    new Blob([JSON.stringify({ name, sku: `A3-${name.replace(/\W+/g, '').slice(0, 8)}-${unique}`, lowStockThreshold: 10, unitOfMeasure: 'KG', ...extra })], {
      type: 'application/json',
    }),
  )
  const res = await api('/api/products', { token, method: 'POST', body: form })
  assert(res.status < 300, `create ${name}: ${res.status}`)
  return res.json
}
async function contextFor(session, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...options })
  await context.addInitScript(
    ([rt]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('__seeded', '1')
      }
    },
    [session.tokens.refreshToken],
  )
  return context
}
/** The list is on the device once the stock chips carry counts. */
const onDevice = (page, timeout = 30000) =>
  page.getByRole('button', { name: /^All\s*[\d,]+$/ }).waitFor({ timeout })

browser = await chromium.launch(launchOptions)

// ====================================================================== part 1: behaviour
if (ONLY !== 'scale') {
  const s = await signup('A3 Small')
  const token = s.tokens.accessToken
  const rice = await createProduct(token, s.unique, 'Rice (device)', { packagingUnit: 'BAG', packagingSize: 50 })
  await api(`/api/products/${rice.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 1000 } })
  const beans = await createProduct(token, s.unique, 'Beans (device)')
  await api(`/api/products/${beans.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 5 } })
  const doomed = await createProduct(token, s.unique, 'Doomed (device)')

  const context = await contextFor(s)
  const page = await context.newPage()
  const listRequests = []
  page.on('request', (r) => {
    if (r.url().startsWith(`${API}/api/products?`)) listRequests.push(r.url())
  })

  await check('the list switches to the device copy once it has synced', async () => {
    await page.goto(`${UI}/app/products`)
    await onDevice(page)
    await page.getByRole('link', { name: 'Rice (device)' }).waitFor()
    // Beans (5 kg, alert at 10) is low; Doomed (0 kg) counts as out, not low.
    await page.getByRole('button', { name: /^Low\s*1$/ }).waitFor()
    await page.getByRole('button', { name: /^Out\s*1$/ }).waitFor()
  })

  await check('search and filters are answered on the device, with no server request', async () => {
    listRequests.length = 0
    await page.getByLabel('Search products').fill('bean')
    await page.waitForURL(/q=bean/)
    await page.getByRole('link', { name: 'Beans (device)' }).waitFor()
    assert((await page.getByRole('link', { name: 'Rice (device)' }).count()) === 0, 'search not applied')
    await page.getByRole('button', { name: /^Low\s*\d*$/ }).click()
    await page.getByRole('link', { name: 'Beans (device)' }).waitFor()
    assert(listRequests.length === 0, `list asked the server: ${listRequests.join(' ')}`)
    await page.getByLabel('Search products').fill('')
    await page.getByRole('button', { name: /^All\s*\d*$/ }).click()
    await page.getByRole('link', { name: 'Rice (device)' }).waitFor()
  })

  await check('a change made on another device arrives on its own', async () => {
    await api(`/api/products/${beans.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 40 } })
    await page.evaluate(() => window.dispatchEvent(new Event('online'))) // a sync trigger, as on reconnect
    const row = page.getByRole('row', { name: /Beans \(device\)/ })
    await page.waitForFunction(
      () => [...document.querySelectorAll('tr')].some((tr) => /Beans \(device\)/.test(tr.innerText) && /\b45\b/.test(tr.innerText)),
      null,
      { timeout: 10000 },
    )
    assert(/\b45\b/.test(await row.innerText()), 'quantity not updated')
  })

  await check('a deleted product disappears', async () => {
    psql(`DELETE FROM products WHERE id = '${doomed.id}';`)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.getByRole('link', { name: 'Doomed (device)' }).waitFor({ state: 'detached', timeout: 10000 })
  })

  await check('offline: search, filters and every product work from the device copy', async () => {
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })
    await page.waitForTimeout(800)
    await context.setOffline(true)
    await page.reload()
    await onDevice(page, 15000)
    await page.getByText(/Offline · showing stock levels as of/).waitFor()
    await page.getByLabel('Search products').fill('ric')
    await page.getByRole('link', { name: 'Beans (device)' }).waitFor({ state: 'detached', timeout: 5000 })
    await page.getByRole('link', { name: 'Rice (device)' }).waitFor()
    await page.screenshot({ path: SHOTS + '1-offline-search.png' })
    await page.getByLabel('Search products').fill('')
    await context.setOffline(false)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.getByText(/showing stock levels as of/).waitFor({ state: 'detached', timeout: 15000 })
  })

  await check('logging out deletes the device copy', async () => {
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()
    await page.waitForTimeout(2000)
    const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))
    assert(!dbs.some((n) => n?.startsWith('procurepaddy-catalog:')), `catalogue survived logout: ${dbs.join(', ')}`)
  })
  await context.close()
}

// ====================================================================== part 2: 100k products
if (ONLY !== 'small') {
  const N = 100_000
  const s = await signup('A3 Scale')
  const clientId = (await api('/api/products/sync/snapshot?limit=1', { token: s.tokens.accessToken })) && psql(
    `SELECT id FROM clients WHERE name LIKE 'A3 Scale ${s.unique}%' LIMIT 1;`,
  )
  const t0 = Date.now()
  psql(`
    INSERT INTO products (client_id, name, sku, quantity_on_hand, low_stock_threshold, unit_of_measure, is_active)
    SELECT '${clientId}',
           (array['Rice','Beans','Garri','Palm oil','Sugar','Salt','Flour','Milk'])[1 + g % 8] || ' ' || lpad(g::text, 6, '0'),
           'SC-' || lpad(g::text, 6, '0'),
           (g * 37) % 500, 20, 'KG', g % 10 <> 0
    FROM generate_series(1, ${N}) g;`)
  metrics.seedSeconds = (Date.now() - t0) / 1000

  const context = await contextFor(s, { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  if (process.env.NET === '3g') {
    // Chrome's "Fast 3G": 1.6 Mbps down, 750 kbps up, 150 ms latency, on compressed bytes.
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    metrics.network = 'fast-3g'
  }

  await check(`100k: the first full sync completes and the list moves to the device`, async () => {
    const start = Date.now()
    await page.goto(`${UI}/app/products`)
    await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
    metrics.firstPaintMs = Date.now() - start
    await onDevice(page, 300000)
    metrics.firstSyncSeconds = (Date.now() - start) / 1000
    const allChip = await page.getByRole('button', { name: /^All\s*[\d,]*$/ }).innerText()
    assert(/90,000/.test(allChip.replace(/\s+/g, ' ')), `active count chip: ${allChip}`)
  })

  await check('100k: search answers in well under a second on a throttled CPU', async () => {
    const timings = []
    for (const term of ['palm oil 0042', 'sc-09', 'garri 1']) {
      // From the keystroke to new rows on screen: the on-device search answers as you type (the
      // URL only takes the term once typing pauses), so this is the whole wait - the search in the
      // worker plus the render, which is what the plan's < 50 ms is about.
      const ms = await page.evaluate(async (t) => {
        const input = document.querySelector('#product-search')
        const rows = () => [...document.querySelectorAll('[data-product-row]')].map((row) => row.textContent).join('|')
        const before = rows()
        const typedAt = performance.now()
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(input, t)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return await new Promise((resolve) => {
          const deadline = typedAt + 5000
          const tick = () => {
            const now = performance.now()
            if (rows() !== before) return resolve(now - typedAt)
            if (now > deadline) return resolve(Infinity)
            requestAnimationFrame(tick)
          }
          tick()
        })
      }, term)
      timings.push(Math.round(ms))
    }
    metrics.searchMs = timings
    assert(Math.max(...timings) < 800, `search took ${timings.join(', ')} ms`)
    await page.getByLabel('Search products').fill('')
    await page.getByRole('link', { name: /Beans 000001/ }).waitFor({ timeout: 10000 }).catch(() => {})
  })

  await check('100k: only the rows near the screen are rendered, and the end of the list is reachable', async () => {
    const rendered = await page.locator('[data-index]').count()
    metrics.renderedRows = rendered
    assert(rendered > 0 && rendered < 80, `rendered ${rendered} rows`)
    await page.evaluate(() => {
      const el = document.querySelector('[data-scroll-container]')
      el.scrollTop = el.scrollHeight
    })
    await page.waitForTimeout(1500)
    await page.evaluate(() => {
      const el = document.querySelector('[data-scroll-container]')
      el.scrollTop = el.scrollHeight
    })
    await page.getByRole('link', { name: /Sugar 09998\d|Salt 09999\d|Rice 1000000|Palm oil 09999\d|Garri 09999\d|Milk 09999\d|Flour 09999\d|Beans 09999\d/ }).first().waitFor({ timeout: 10000 })
    metrics.mainHeapMB = Math.round((await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)) / 1e6)
    await page.screenshot({ path: SHOTS + '2-scale-bottom.png' })
  })

  await check('100k: a reload opens from the device without downloading the catalogue again', async () => {
    let snapshotCalls = 0
    page.on('request', (r) => {
      if (r.url().includes('/api/products/sync/snapshot')) snapshotCalls += 1
    })
    const start = Date.now()
    await page.reload()
    await onDevice(page, 60000)
    metrics.warmOpenSeconds = (Date.now() - start) / 1000
    assert(snapshotCalls === 0, `downloaded again: ${snapshotCalls} snapshot calls`)
  })
  await context.close()
  psql(`DELETE FROM products WHERE client_id = '${clientId}';`)
}

await browser.close()
console.log('\nmetrics:', JSON.stringify(metrics))
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
