// End-to-end checks for B2 (C3: the stock sheets — fields, the stamped receipt, count), against the production preview (4173) and
// the real API (8081). "Another phone" is the API called directly from this script.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('sheets')

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
      name: `E2E Sheets ${unique}`,
      adminEmail: `sheets-${unique}@example.com`,
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

/** Opens a product online, so it is cached for working on it offline. */
async function openProduct(product) {
  await page.goto(`${UI}/app/products/${product.id}`)
  await page.getByRole('heading', { name: product.name, level: 1 }).waitFor()
}
async function goOnline() {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}



const rice = await createProduct('Rice (c3)', 1000, 250)
await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })
const toast = (text) => page.getByRole('status').filter({ hasText: text })
const dialog = page.getByRole('dialog')

await check('stock in: quantity has focus, the conversion is live, the optional fields are folded', async () => {
  await openProduct(rice)
  await page.getByRole('button', { name: 'Stock in' }).click()
  await dialog.waitFor()
  await page.waitForTimeout(250)
  assert(await dialog.getByLabel('Quantity').evaluate((el) => el === document.activeElement), 'quantity not focused')
  await page.keyboard.type('2')
  await dialog.getByText('2 bags (100 kg)').waitFor()
  const more = dialog.getByRole('button', { name: /More details/ })
  assert((await more.getAttribute('aria-expanded')) === 'false', 'More details open by default')
  assert(!(await dialog.getByLabel(/Unit price/).isVisible()), 'price visible while folded')
  await page.screenshot({ path: SHOTS + '1-in-form.png' })
})

await check('"More details" opens by itself when something inside needs fixing', async () => {
  const more = dialog.getByRole('button', { name: /More details/ })
  await more.click()
  await dialog.getByLabel(/Unit price/).fill('-5')
  await more.click()
  assert((await more.getAttribute('aria-expanded')) === 'false', 'did not fold')
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByLabel(/Unit price/).waitFor() // visible again, with its error
  assert((await more.getAttribute('aria-expanded')) === 'true', 'did not reopen on the error')
  await dialog.getByLabel(/Unit price/).fill('')
  await more.click() // folds again now nothing inside is wrong
  await dialog.getByRole('button', { name: /More details · price, note/ }).waitFor()
})

await check('the receipt lands RECORDED the moment Confirm is pressed, then turns SYNCED, numbered', async () => {
  await page.route('**/api/products/*/stock/stock-in', async (route) => {
    await new Promise((r) => setTimeout(r, 1200))
    await route.continue().catch(() => {})
  })
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  const sending = dialog.locator('[data-receipt="sending"]')
  await sending.waitFor({ timeout: 1000 })
  await sending.locator('[data-stamp="recorded"]').waitFor()
  assert(await dialog.getByRole('button', { name: 'Done' }).isDisabled(), 'Done enabled while sending')
  await page.screenshot({ path: SHOTS + '2-sending.png' })
  const synced = dialog.locator('[data-receipt="synced"]')
  await synced.waitFor({ timeout: 10000 })
  await synced.locator('[data-stamp="synced"]').waitFor()
  await synced.getByText('2 bags (100 kg)').waitFor()
  const movements = (await api(`/api/products/${rice.id}/stock/history?size=5`, { token })).json.content
  const number = movements[0].id.replace(/-/g, '').slice(-6).toUpperCase()
  await synced.getByText(`No. ${number}`).waitFor()
  await page.screenshot({ path: SHOTS + '3-synced.png' })
  await page.unroute('**/api/products/*/stock/stock-in', { behavior: 'ignoreErrors' })
  await dialog.getByRole('button', { name: 'Done' }).click()
  await toast(/Stock in recorded · Rice \(c3\) now 1,100 kg/).waitFor()
})

await check('a toast never sits over an open sheet', async () => {
  await page.getByRole('button', { name: 'Stock out' }).click()
  await dialog.waitFor()
  await page.waitForTimeout(250)
  const t = page.getByRole('status').filter({ hasText: /Stock in recorded/ })
  if (await t.count()) {
    const box = await t.boundingBox()
    const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[role="status"]') != null, [box.x + box.width / 2, box.y + box.height / 2])
    assert(!top, 'the toast is drawn over the sheet')
  }
})

await check('stock out: an oversell sends you back to the form with the reason, and no receipt', async () => {
  await dialog.getByLabel('Quantity').fill('5000')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByText('Not enough in stock').waitFor()
  assert((await dialog.locator('[data-receipt]').count()) === 0, 'a receipt for a refused write')
  await dialog.getByRole('button', { name: 'Add a note' }).click()
  await dialog.getByLabel(/Note/).waitFor()
  await page.keyboard.press('Escape')
})

await check('offline: the receipt stays RECORDED and says plainly where the write is', async () => {
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await page.getByRole('button', { name: 'Stock out' }).click()
  await dialog.getByLabel('Quantity').fill('5')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  const recorded = dialog.locator('[data-receipt="recorded"]')
  await recorded.waitFor()
  await recorded.getByText(/Saved on this phone — the server can't be reached right now/).waitFor()
  await page.screenshot({ path: SHOTS + '4-recorded.png' })
  await dialog.getByRole('button', { name: 'Done' }).click()
  await toast(/Saved on this phone/).last().getByRole('button', { name: 'Undo' }).click()
  await toast('Taken back. Nothing was sent.').waitFor()
  await goOnline()
})

// Reported 2026-10-05: a line added at "1 bag" kept asking for 50 kg after the quantity became 2 kg,
// and the sheet refused with "Allocated amounts must add up to 2 kg" — a mismatch it made itself.
await check('stock out: a suggested delivery line follows the quantity until you type in it', async () => {
  await page.getByRole('button', { name: 'Stock out' }).click()
  const units = dialog.getByRole('group', { name: /counted in/i })
  await units.getByRole('button', { name: 'Bag of 50 kg' }).click()
  await dialog.getByLabel('Quantity').fill('1')
  await dialog.getByRole('button', { name: /Choose which deliveries/ }).click()
  await dialog.getByRole('button', { name: 'Add a line' }).click()
  const amount = dialog.getByLabel('Amount (kg)')
  assert((await amount.inputValue()) === '50', `suggested ${await amount.inputValue()}, not 50`)

  const kg = units.getByRole('button', { name: 'kg', exact: true })
  await kg.click()
  assert((await kg.getAttribute('aria-pressed')) === 'true' && (await kg.getAttribute('class')).includes('bg-primary-600'), 'the chosen unit is not plainly selected')
  await dialog.getByLabel('Quantity').fill('2')
  await page.waitForFunction(() => document.querySelector('[id^="stock-out-lot-qty-"]')?.value === '2')
  assert((await dialog.getByRole('alert').count()) === 0, 'a mismatch the sheet made itself')

  // Typed by hand, the line is the user's: it stays, and the sheet says how to make them agree.
  await amount.fill('5')
  await dialog.getByLabel('Quantity').fill('3')
  await dialog.getByRole('alert').getByText("These deliveries add up to 5 kg, but you're taking out 3 kg. Change the quantity or an amount so they match.").waitFor()
  assert((await amount.inputValue()) === '5', 'a typed amount was overwritten')
  await page.screenshot({ path: SHOTS + '5-allocation.png' })
  await page.keyboard.press('Escape')
})

await check('count: the difference from what the app says is shown before anything is recorded', async () => {
  await page.getByRole('button', { name: 'Count', exact: true }).click()
  await dialog.getByLabel(/How much is on the shelf/).fill('1096')
  await dialog.getByText('vs what the app says').waitFor()
  await dialog.locator('[data-stock-figure]').getByText('−4').waitFor()
  await dialog.getByLabel(/How much is on the shelf/).fill('1100')
  await dialog.getByText('Matches what the app says.').waitFor()
  await page.screenshot({ path: SHOTS + '5-count.png' })
  await page.keyboard.press('Escape')
  assert((await onHand(rice.id)) === 1100, `server has ${await onHand(rice.id)}`)
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
