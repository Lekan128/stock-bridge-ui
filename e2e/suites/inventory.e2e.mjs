// End-to-end checks for B2 (C1: the Inventory list — one bar, quick +/−, keys, phone selection), against the production preview (4173) and
// the real API (8081). "Another phone" is the API called directly from this script.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('inventory')

const results = []
let browser
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
      name: `E2E Inventory ${unique}`,
      adminEmail: `inventory-${unique}@example.com`,
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
const onHand = async (id) => (await api(`/api/products/${id}`, { token })).json.quantityOnHand

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




const rice = await createProduct('Rice (c1)', 1000, 250)
await createProduct('Beans (c1)', 100, 250)
const oil = await createProduct('Palm oil (c1)', 500, 100)
// No stock unit: the data-issues check flags it, so there is something to "look at".
{
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name: 'Mystery item (c1)', sku: `C1-MYST-${unique}` })], { type: 'application/json' }))
  await api('/api/products', { token, method: 'POST', body: form })
}

await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })
const toast = (text) => page.getByRole('status').filter({ hasText: text })
const row = (name) => page.locator('tr[data-product-row]').filter({ hasText: name })

await check('one compact bar: search, Filters, chips with counts, the daily action, Add product, ⋯ — on one row', async () => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload()
  await row('Rice (c1)').waitFor()
  const search = page.getByRole('searchbox', { name: 'Search products' })
  const filters = page.getByRole('button', { name: /^Filters/ })
  const chips = page.getByRole('group', { name: 'Stock level' })
  const record = page.getByRole('button', { name: 'Record a delivery' }).first()
  const add = page.getByRole('button', { name: 'Add product' }).first()
  const more = page.getByRole('button', { name: 'More inventory actions' }).first()
  const tops = await Promise.all([search, filters, chips, record, add, more].map(async (l) => (await l.boundingBox()).y))
  assert(Math.max(...tops) - Math.min(...tops) < 12, `not one row: ${tops}`)
  await chips.getByRole('button', { name: /^All\s*4$/ }).waitFor()
  await chips.getByRole('button', { name: /^Low\s*1$/ }).waitFor()
  assert((await record.getAttribute('class')).includes('bg-action'), 'Record a delivery is not the action')
  assert(!(await add.getAttribute('class')).includes('bg-action'), 'two action buttons')
  await more.click()
  for (const item of ['Expected deliveries', 'Bulk upload', 'Manage categories', 'SKU settings', 'Download my products']) {
    await page.getByRole('menuitem', { name: item }).waitFor()
  }
  await page.keyboard.press('Escape')
  await page.screenshot({ path: SHOTS + '1-bar.png' })
})

await check('Filters: status and category behind one button, counted, and cleared in one step', async () => {
  await page.getByRole('button', { name: /^Filters/ }).click()
  await page.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: 'Inactive' }).click()
  await page.waitForURL(/status=inactive/)
  await page.getByRole('button', { name: /^Filters · 1/ }).waitFor()
  await page.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: /Clear filters/ }).click()
  await page.waitForFunction(() => !location.search.includes('status='))
  await page.getByRole('button', { name: /^Filters$/ }).waitFor()
  await page.keyboard.press('Escape')
})

await check('the notices fold into one "need a look" line that opens in place', async () => {
  const line = page.getByRole('button', { name: /1 thing needs a look/ })
  await line.waitFor({ timeout: 20000 })
  assert((await line.getAttribute('aria-expanded')) === 'false', 'opened by default')
  await line.getByText(/1 product needs a quick fix/).waitFor()
  await line.click()
  await page.getByRole('link', { name: 'Fix them' }).waitFor()
  await page.screenshot({ path: SHOTS + '2-attention-open.png' })
  await page.getByRole('button', { name: 'Not now' }).click()
  await line.waitFor({ state: 'detached' })
})

await check('quick + on a row opens Stock in for that product, without leaving the list; Undo works', async () => {
  await row('Rice (c1)').hover()
  await row('Rice (c1)').getByRole('button', { name: 'Stock in Rice (c1)' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill('2')
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  assert(page.url().endsWith('/app/products'), `left the list: ${page.url()}`)
  const recorded = toast('Stock in recorded · Rice (c1) now 1,100 kg')
  await recorded.waitFor()
  await row('Rice (c1)').getByText('1,100', { exact: true }).waitFor()
  await recorded.getByRole('button', { name: 'Undo' }).click()
  await toast('Undone · Rice (c1) is back to 1,000 kg').waitFor()
  await row('Rice (c1)').getByText('1,000', { exact: true }).waitFor()
  assert((await onHand(rice.id)) === 1000, 'server not restored')
})

await check('keys: / searches, j and k move between rows, i and o open stock in and out', async () => {
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('/')
  assert(await page.evaluate(() => document.activeElement?.id === 'product-search'), '/ did not focus search')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('j')
  const focusedName = () => page.evaluate(() => document.activeElement?.textContent)
  const first = await focusedName()
  await page.keyboard.press('j')
  const second = await focusedName()
  assert(first && second && first !== second, `j did not move: ${first} → ${second}`)
  await page.keyboard.press('k')
  assert((await focusedName()) === first, 'k did not move back')
  await page.keyboard.press('i')
  await page.getByRole('dialog', { name: 'Stock in' }).waitFor()
  await page.keyboard.press('Escape')
  await page.keyboard.press('o')
  await page.getByRole('dialog', { name: 'Stock out' }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByText('Keys:').waitFor()
})

await check('phone: cards with quick +/−, no "Active" noise, actions in a bottom bar, toasts above it', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  const card = page.locator('div[data-product-row]').filter({ hasText: 'Beans (c1)' })
  await card.waitFor()
  assert((await card.getByText('Active', { exact: true }).count()) === 0, 'active badge on a card')
  await card.getByText('Bag of 50 kg').waitFor()
  const bar = page.getByRole('region', { name: 'Inventory actions' })
  await bar.getByRole('button', { name: 'Record a delivery' }).waitFor()
  await card.getByRole('button', { name: 'Stock out Beans (c1)' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill('1')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  const recorded = toast(/Stock out recorded · Beans \(c1\) now 99 kg/)
  await recorded.waitFor()
  console.log('    toast:', (await recorded.innerText()).split('\n')[0])
  const t = await recorded.boundingBox()
  const b = await bar.boundingBox()
  assert(t.y + t.height <= b.y + 1, `toast ${JSON.stringify(t)} under the bar ${JSON.stringify(b)}`)
  await page.screenshot({ path: SHOTS + '3-phone.png' })
})

await check('phone: a long press starts selecting; taps add to it; the bar offers Stock in for the selection', async () => {
  const longPress = async (name) => {
    const card = page.locator('div[data-product-row]').filter({ hasText: name })
    const box = await card.boundingBox()
    await card.evaluate((el, [x, y]) => {
      el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: x, clientY: y, bubbles: true }))
    }, [box.x + 60, box.y + 20])
    await page.waitForTimeout(650)
    await card.evaluate((el) => el.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true })))
    await card.getByRole('link').click()
  }
  await longPress('Rice (c1)')
  const bar = page.getByRole('region', { name: 'Selected products' })
  await bar.getByText('1 selected').waitFor()
  assert(page.url().endsWith('/app/products'), 'long press opened the product')
  await page.locator('div[data-product-row]').filter({ hasText: 'Palm oil (c1)' }).getByRole('link').click()
  await bar.getByText('2 selected').waitFor()
  await page.screenshot({ path: SHOTS + '4-phone-selecting.png' })
  await bar.getByRole('button', { name: 'Stock in' }).click()
  await page.waitForURL(/import\/new\?kind=STOCK_IN&productIds=/)
  assert(page.url().includes(rice.id) && page.url().includes(oil.id), page.url())
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
