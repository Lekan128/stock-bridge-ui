// End-to-end checks for B2 (C5: the dashboard as "today"), against the production preview (4173) and
// the real API (8081). "Another phone" is the API called directly from this script.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('dashboard')

const results = []
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
const signup = (
  await api('/api/clients/signup', {
    method: 'POST',
    body: {
      name: `E2E Today ${unique}`,
      adminEmail: `today-${unique}@example.com`,
      password: 'correct-horse-battery-staple',
      confirmPassword: 'correct-horse-battery-staple',
    },
  })
).json
const token = signup.tokens.accessToken
async function createProduct(name, opening, low = null) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `FD-${name.replace(/\W+/g, '').slice(0, 8)}-${unique}`, unitOfMeasure: 'KG', packagingUnit: 'BAG', packagingSize: 50, lowStockThreshold: low })], { type: 'application/json' }))
  const product = (await api('/api/products', { token, method: 'POST', body: form })).json
  if (opening) await api(`/api/products/${product.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: opening } })
  return product
}

browser = await chromium.launch(launchOptions)
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await context.addInitScript(
  ([rt]) => {
    if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('sb.refreshToken', rt)
      localStorage.setItem('__seeded', '1')
    }
  },
  [signup.tokens.refreshToken],
)
const page = await context.newPage()

/** Opens a product online, so it is cached for working on it offline. */
async function openProduct(product) {
  await page.goto(`${UI}/app/products/${product.id}`)
  await page.getByRole('heading', { name: product.name, level: 1 }).waitFor()
}
async function stockOut(quantity) {
  await page.getByRole('button', { name: 'Stock Out' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill(String(quantity))
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  return dialog
}
async function goOnline() {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}



const rice = await createProduct('Rice (c5)', 1000, 250)
await createProduct('Beans (c5)', 100, 250)
await createProduct('Salt (c5)', 0, 50)
const oil = await createProduct('Oil (c5)', 30, 10)
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const expected = await api('/api/expected-deliveries', { token, method: 'POST', body: { expectedDate: today, reference: 'WB-C5', lines: [{ productId: rice.id, unit: 'KG', quantity: 100 }] } })
assert(expected.status < 300, `expected delivery: ${expected.status} ${JSON.stringify(expected.json)}`)

await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })
const needs = () => page.locator('section[aria-labelledby="needs-you-heading"]')
const needRow = (text) => needs().locator('li[data-need]').filter({ hasText: text })
const toast = (text) => page.getByRole('status').filter({ hasText: text })

await check('stock health: one bar, well / low / out counts that open the list on that chip', async () => {
  await page.goto(`${UI}/app`)
  const health = page.locator('section[aria-labelledby="stock-health-heading"]')
  await health.getByText('4 active products').waitFor({ timeout: 20000 })
  for (const [key, n] of [['OK', 2], ['LOW', 1], ['OUT', 1]]) {
    await health.locator(`a[data-health="${key}"]`).getByText(String(n), { exact: true }).waitFor()
  }
  await health.locator('a[data-health="LOW"]').click()
  await page.waitForURL(/\/app\/products\?stockStatus=LOW/)
  await page.goto(`${UI}/app`)
})

await check('needs you today: the delivery due, out and low stock, each with its action inline', async () => {
  await needRow('WB-C5').or(needRow('Due today')).first().waitFor({ timeout: 20000 })
  const delivery = needs().locator('li[data-need]').filter({ hasText: 'Due today' })
  await delivery.getByRole('link', { name: 'Receive' }).waitFor()
  assert((await delivery.getByRole('link', { name: 'Receive' }).getAttribute('href')).includes('expected='), 'Receive does not open the delivery')
  await needRow('Salt (c5)').getByText('Out of stock').waitFor()
  await needRow('Beans (c5)').getByText('Running low').waitFor()
  assert((await needRow('Rice (c5)').filter({ hasText: 'Running low' }).count()) === 0, 'a well-stocked product is listed')
  await page.screenshot({ path: SHOTS + '1-today.png', fullPage: true })
})

await check('Stock in from the list: the sheet, the toast, and the row moves from out to low', async () => {
  await needRow('Salt (c5)').getByRole('button', { name: 'Stock in Salt (c5)' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill('1')
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await toast('Stock in recorded · Salt (c5) now 50 kg').waitFor()
  await needRow('Salt (c5)').getByText('Running low').waitFor({ timeout: 15000 })
})

await check('a change the server refused shows here, and Review opens the sync centre', async () => {
  await openProduct(oil)
  await context.setOffline(true)
  const dialog = await stockOut(30)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await api(`/api/products/${oil.id}/stock/stock-out`, { token, method: 'POST', body: { quantity: 20 } }) // another phone
  await goOnline()
  await page.getByRole('button', { name: /1 needs you/ }).waitFor({ timeout: 30000 })
  await page.goto(`${UI}/app`)
  const refused = needRow('the server refused')
  await refused.locator('[data-stamp="check"]').waitFor({ timeout: 20000 })
  await refused.getByRole('button', { name: 'Review' }).click()
  await page.getByRole('dialog', { name: 'On this phone' }).getByRole('button', { name: /Send 10 instead/ }).click()
  await page.keyboard.press('Escape')
  await refused.waitFor({ state: 'detached', timeout: 20000 })
})

await check('an unfinished form on this phone is listed with Continue', async () => {
  await page.goto(`${UI}/app/products/receive`)
  await page.getByLabel(/Beans \(c5\).*how many arrived/).first().fill('4') // loose kg and the 50 kg bag are two lines
  await page.getByText(/Draft saved on this phone at/).waitFor()
  await page.goto(`${UI}/app`)
  const draft = needRow('Unfinished: delivery')
  await draft.waitFor({ timeout: 20000 })
  await draft.getByRole('link', { name: 'Continue' }).click()
  await page.getByText(/Picked up your draft/).waitFor()
  await page.getByRole('button', { name: 'Discard draft' }).click()
  await page.waitForTimeout(300)
})

await check('the movements chart: In and Out totals in its legend, and when they were true', async () => {
  await page.goto(`${UI}/app`)
  const legend = page.locator('[data-legend]')
  await legend.getByText('In', { exact: true }).waitFor({ timeout: 20000 })
  await legend.getByText(/units$/).first().waitFor()
  await page.locator('[data-as-of]').getByText(/as of /).waitFor()
  assert((await page.getByText('Stock In Value').count()) === 0, 'the old stat cards are still there')
})

await check('offline: health and the to-do list still answer from the phone; the chart says it is the saved copy', async () => {
  await context.setOffline(true)
  await page.reload()
  await page.locator('section[aria-labelledby="stock-health-heading"]').getByText('4 active products').waitFor({ timeout: 20000 })
  await needRow('Beans (c5)').waitFor()
  await page.locator('[data-as-of]').getByText(/Offline · as of/).waitFor({ timeout: 15000 })
  await page.screenshot({ path: SHOTS + '2-offline.png', fullPage: true })
  await goOnline()
})

await check('phone: names keep their room — Stock in is the "+" alone', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  const button = needRow('Beans (c5)').getByRole('button', { name: 'Stock in Beans (c5)' })
  await button.waitFor({ timeout: 20000 })
  const box = await button.boundingBox()
  assert(box.width < 60, `Stock in button ${box.width}px wide on a phone`)
  await page.screenshot({ path: SHOTS + '3-phone.png' })
  await page.setViewportSize({ width: 1280, height: 900 })
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
