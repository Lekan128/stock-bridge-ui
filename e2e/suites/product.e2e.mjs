// End-to-end checks for B2 (C2: the product page — hero first, actions, details, history), against the production preview (4173) and
// the real API (8081). "Another phone" is the API called directly from this script.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('product')

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
      name: `E2E Product ${unique}`,
      adminEmail: `product-${unique}@example.com`,
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
async function stockIn(quantity) {
  await page.getByRole('button', { name: 'Stock In' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill(String(quantity))
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  return dialog
}
async function goOnline() {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}



const rice = await createProduct('Rice (c2)', 1000, 250)
// A delivery recorded as having arrived on 1 October: history says when it happened, not when it was typed.
await api(`/api/products/${rice.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 50, occurredAt: '2026-10-01T10:00:00Z' } })

await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })
const heroFigure = () => page.locator('[data-stock-figure]').first() // the hero comes before the history

await check('laptop: a thumbnail beside the name, Edit and Deactivate in "⋯", the hero right under the header', async () => {
  await openProduct(rice)
  const h1 = await page.getByRole('heading', { level: 1 }).boundingBox()
  const thumb = await page.locator('main').getByRole('img', { name: rice.name }).or(page.locator('main [aria-label="' + rice.name + '"]')).first().boundingBox().catch(() => null)
  if (thumb) assert(thumb.x + thumb.width <= h1.x && thumb.height <= 56, `thumbnail ${JSON.stringify(thumb)}`)
  assert((await page.getByRole('link', { name: 'Edit' }).count()) === 0, 'Edit still on the header')
  await page.getByRole('button', { name: `More actions for ${rice.name}` }).click()
  await page.getByRole('menuitem', { name: 'Deactivate' }).waitFor()
  await page.getByRole('menuitem', { name: 'Edit product' }).click()
  await page.waitForURL(/\/edit$/)
  await openProduct(rice)
  // Measured from the page heading: banners above it (email verification) are not the page's doing.
  const figure = await heroFigure().boundingBox()
  const heading = await page.getByRole('heading', { level: 1 }).boundingBox()
  assert(figure.y - (heading.y + heading.height) < 140, `hero figure ${figure.y - heading.y}px below the heading`)
  assert((await page.getByText('Nothing on its way').count()) === 0, 'empty incoming block still shown')
  await page.getByText(/Received 50 kg · /).waitFor()
  await page.screenshot({ path: SHOTS + '1-laptop.png' })
})

await check('details sit below in a quiet ruled list; history says when a movement happened', async () => {
  const details = page.getByRole('region', { name: 'Details' }).or(page.locator('section[aria-labelledby="product-details-heading"]')).first()
  await details.getByText('Cost price').waitFor()
  await details.getByText('Bag of 50 kg').waitFor()
  const history = page.locator('section[aria-labelledby="product-history-heading"]')
  await history.locator('table').getByText(/Oct 1, 2026/).waitFor()
})

await check('offline: the waiting stock-in shows beside the figure and as a RECORDED row; it lands when back online', async () => {
  await context.setOffline(true)
  const dialog = await stockIn(2)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await page.getByText('+100 kg waiting').first().waitFor()
  const history = page.locator('section[aria-labelledby="product-history-heading"] table')
  const waitingRow = history.locator('tr').filter({ has: page.locator('[data-stamp="recorded"]') })
  await waitingRow.getByText('Saved on this phone', { exact: true }).waitFor()
  await page.screenshot({ path: SHOTS + '2-pending.png' })
  await goOnline()
  await waitingRow.waitFor({ state: 'detached', timeout: 30000 })
  await page.getByText(/Received 100 kg · today/).waitFor({ timeout: 15000 })
})

await check('phone: the stock comes first, the actions sit in a bar at the bottom, history is ledger rows', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProduct(rice)
  const figure = await heroFigure().boundingBox()
  const heading = await page.getByRole('heading', { level: 1 }).boundingBox()
  assert(figure.y - (heading.y + heading.height) < 160, `hero figure ${figure.y - heading.y}px below the heading on a phone`)
  const bar = page.getByRole('region', { name: 'Stock actions' })
  for (const name of ['Stock in', 'Stock out', 'Count']) {
    const box = await bar.getByRole('button', { name }).boundingBox()
    assert(box.height < 48, `${name} wraps: ${box.height}px`)
  }
  const barBox = await bar.boundingBox()
  assert(Math.abs(barBox.y + barBox.height - 844) < 2, `bar not at the bottom: ${JSON.stringify(barBox)}`)
  const history = page.locator('section[aria-labelledby="product-history-heading"]')
  assert(await history.locator('ul').isVisible(), 'no ledger rows on a phone')
  assert(!(await history.locator('table').isVisible()), 'table still shown on a phone')
  await page.screenshot({ path: SHOTS + '3-phone.png' })
  await page.setViewportSize({ width: 1280, height: 900 })
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
