// End-to-end checks for A4 (recording stock offline), against the production preview (4173) and
// the real API (8081). "Another phone" is the API called directly from this script.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('outbox')

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
      name: `E2E Outbox ${unique}`,
      adminEmail: `outbox-${unique}@example.com`,
      password: 'correct-horse-battery-staple',
      confirmPassword: 'correct-horse-battery-staple',
    },
  })
).json
const token = signup.tokens.accessToken
async function createProduct(name, opening) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `OB-${name.replace(/\W+/g, '').slice(0, 8)}-${unique}`, unitOfMeasure: 'KG' })], { type: 'application/json' }))
  const product = (await api('/api/products', { token, method: 'POST', body: form })).json
  if (opening) await api(`/api/products/${product.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: opening } })
  return product
}
const onHand = async (id) => (await api(`/api/products/${id}`, { token })).json.quantityOnHand
/** The server's figure, once it settles on `want` (or whatever it has after 15 s). */
async function settlesAt(id, want) {
  let got
  for (let i = 0; i < 30; i++) {
    got = await onHand(id)
    if (got === want) return got
    await new Promise((r) => setTimeout(r, 500))
  }
  return got
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
async function stockOut(quantity) {
  await page.getByRole('button', { name: 'Stock Out' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill(String(quantity))
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  return dialog
}
async function count(quantity) {
  await page.getByRole('button', { name: 'Count', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/How much is on the shelf now/).fill(String(quantity))
  await dialog.getByRole('button', { name: 'Record count' }).click()
  return dialog
}
async function goOnline() {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}
const indicator = () => page.getByRole('button', { name: /waiting to send|saved on this phone|needs? you|Sending/ })

const rice = await createProduct('Rice (outbox)', 20)
await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })

await check('online: a stock-in is sent at once, nothing waits', async () => {
  await openProduct(rice)
  const dialog = await stockIn(5)
  await dialog.locator('[data-receipt="synced"]').waitFor() // C3: the receipt is stamped SYNCED
  await dialog.getByRole('button', { name: 'Done' }).click()
  assert((await indicator().count()) === 0, 'something is waiting')
  assert((await onHand(rice.id)) === 25, 'not recorded')
})

await check('offline: a stock-in is saved on this phone, shown as waiting, and survives a reload', async () => {
  await context.setOffline(true)
  const dialog = await stockIn(10)
  await dialog.getByText('Saved on this phone').first().waitFor()
  await page.screenshot({ path: SHOTS + '1-queued-receipt.png' })
  await dialog.getByRole('button', { name: 'Done' }).click()
  await indicator().filter({ hasText: '1 saved on this phone' }).waitFor()
  // Beside the figure, never in it (C2: inline on the hero), and stamped RECORDED in the history.
  await page.getByText('+10 kg waiting').first().waitFor()
  await page.locator('[data-stamp="recorded"] >> visible=true').first().waitFor()
  await page.screenshot({ path: SHOTS + '2-pending-note.png' })
  await page.reload()
  await page.getByRole('heading', { name: rice.name, level: 1 }).waitFor()
  await indicator().filter({ hasText: '1 saved on this phone' }).waitFor({ timeout: 10000 })
  assert((await onHand(rice.id)) === 25, 'sent while offline?')
})

await check('back online: it sends itself, once', async () => {
  await goOnline()
  await indicator().waitFor({ state: 'detached', timeout: 30000 })
  assert((await onHand(rice.id)) === 35, `expected 35, server has ${await onHand(rice.id)}`)
  const moves = (await api(`/api/products/${rice.id}/stock/history?size=50`, { token })).json.content
  assert(moves.filter((m) => m.movementType === 'IN' && m.quantity === 10).length === 1, 'recorded more than once')
})

await check("a product's offline writes arrive in the order they were made", async () => {
  const beans = await createProduct('Beans (order)', 20)
  await openProduct(beans)
  await context.setOffline(true)
  const inDialog = await stockIn(10) // 30
  await inDialog.getByRole('button', { name: 'Done' }).click()
  const outDialog = await stockOut(25) // only possible after the 10 arrive
  await outDialog.getByText('Saved on this phone').first().waitFor()
  await outDialog.getByRole('button', { name: 'Done' }).click()
  await indicator().filter({ hasText: '2 saved on this phone' }).waitFor()
  await goOnline()
  await indicator().waitFor({ state: 'detached', timeout: 30000 })
  assert((await onHand(beans.id)) === 5, `expected 5, got ${await onHand(beans.id)}`)
})

await check('oversold by the time it arrives: it waits as "needs you" and can be sent for what was left', async () => {
  const oil = await createProduct('Palm oil (conflict)', 20)
  await openProduct(oil)
  await context.setOffline(true)
  const dialog = await stockOut(15)
  await dialog.getByRole('button', { name: 'Done' }).click()
  // Another phone sells 10 meanwhile.
  await api(`/api/products/${oil.id}/stock/stock-out`, { token, method: 'POST', body: { quantity: 10 } })
  await goOnline()
  await indicator().filter({ hasText: '1 needs you' }).waitFor({ timeout: 30000 })
  await indicator().click()
  const panel = page.getByRole('dialog', { name: 'On this phone' })
  await panel.getByText(/Palm oil \(conflict\)/).waitFor()
  await page.screenshot({ path: SHOTS + '3-needs-you.png' })
  await panel.getByRole('button', { name: 'Send 10 instead' }).click()
  await indicator().waitFor({ state: 'detached', timeout: 30000 })
  await page.keyboard.press('Escape')
  const final = await settlesAt(oil.id, 0)
  assert(final === 0, `expected 0, got ${final}`)
})

await check("a late offline count keeps another phone's later sale", async () => {
  const sugar = await createProduct('Sugar (count)', 20)
  await openProduct(sugar)
  await context.setOffline(true)
  const dialog = await count(15)
  await dialog.getByText('Saved on this phone').first().waitFor()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(1200) // the other phone's sale happens after the count
  await api(`/api/products/${sugar.id}/stock/stock-out`, { token, method: 'POST', body: { quantity: 5 } })
  await goOnline()
  await indicator().waitFor({ state: 'detached', timeout: 30000 })
  assert((await onHand(sugar.id)) === 10, `expected 15 - 5 = 10, got ${await onHand(sugar.id)}`)
})

await check('a late offline sale from before another phone\'s count does not change the count', async () => {
  const salt = await createProduct('Salt (absorb)', 20)
  await openProduct(salt)
  await context.setOffline(true)
  const dialog = await stockOut(5)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(1200)
  // Another phone counts the shelf afterwards: the sale is already gone from it.
  await api(`/api/products/${salt.id}/stock/count`, { token, method: 'POST', body: { countedQuantity: 15 } })
  await goOnline()
  await indicator().waitFor({ state: 'detached', timeout: 30000 })
  assert((await onHand(salt.id)) === 15, `expected the count's 15, got ${await onHand(salt.id)}`)
})

await check('offline: choosing deliveries is not offered for a stock-out', async () => {
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Stock Out' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText(/You're offline: the oldest deliveries will be used/).waitFor()
  assert((await dialog.getByRole('button', { name: /Choose which deliveries/ }).count()) === 0, 'still offered')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

await check('logging out with unsent changes asks first, and only then discards them', async () => {
  const dialog = await stockIn(3)
  await dialog.getByRole('button', { name: 'Done' }).click()
  await indicator().filter({ hasText: '1 saved on this phone' }).waitFor()
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  const guard = page.getByRole('dialog', { name: 'Stock changes not sent yet' })
  await guard.waitFor()
  await page.screenshot({ path: SHOTS + '4-logout-guard.png' })
  await guard.getByRole('button', { name: 'Cancel' }).click()
  await indicator().filter({ hasText: '1 saved on this phone' }).waitFor()
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await page.getByRole('dialog', { name: 'Stock changes not sent yet' }).getByRole('button', { name: 'Log out and discard' }).click()
  await page.waitForTimeout(1500)
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name))
  assert(!dbs.some((n) => n?.startsWith('procurepaddy-outbox:')), `outbox survived: ${dbs.join(', ')}`)
  await context.setOffline(false)
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
