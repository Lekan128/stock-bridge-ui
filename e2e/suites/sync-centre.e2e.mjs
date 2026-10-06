// End-to-end checks for A6 (the sync pill and sync centre), against the production preview (4173) and
// the real API (8081). "Another phone" is the API called directly from this script.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('sync-centre')

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
      name: `E2E Sync ${unique}`,
      adminEmail: `sync-${unique}@example.com`,
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
async function goOnline() {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}


const pill = () => page.getByRole('button', { name: /Open sync details/ })
const centre = () => page.getByRole('dialog', { name: 'On this phone' })
async function openCentre() {
  await pill().click()
  await centre().waitFor()
  await page.waitForTimeout(350) // let the dialog's entrance animation settle before screenshots
}
async function closeCentre() {
  await page.keyboard.press('Escape')
  await centre().waitFor({ state: 'detached' })
}

const rice = await createProduct('Rice (sync)', 50)
const beans = await createProduct('Beans (sync)', 50)
await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })

await check('idle: a quiet "All caught up" icon that still opens the centre, with the catalogue status', async () => {
  await pill().waitFor()
  assert((await pill().getAttribute('aria-label')) === 'All caught up. Open sync details', await pill().getAttribute('aria-label'))
  assert((await pill().innerText()).trim() === '', 'idle pill shows text')
  await openCentre()
  await centre().getByText('All caught up. Everything recorded on this phone has been sent.').waitFor()
  await centre().getByText(/\d+ products on this phone, up to date as of/).waitFor({ timeout: 20000 })
  assert((await centre().getByText('Stock changes').count()) === 0, 'empty stock list shown')
  await page.screenshot({ path: SHOTS + '1-idle.png' })
  await closeCentre()
})

await check('offline: "Offline · 2 saved on this phone", each stamped RECORDED', async () => {
  await openProduct(rice)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Offline. Open sync details' }).waitFor()
  await (await stockIn(4)).getByRole('button', { name: 'Done' }).click()
  await (await stockOut(3)).getByRole('button', { name: 'Done' }).click()
  await pill().filter({ hasText: 'Offline · 2 saved on this phone' }).waitFor()
  await openCentre()
  await centre().getByText(/You're offline\. 2 stock changes are saved on this phone/).waitFor()
  const lines = centre().getByRole('listitem').filter({ hasText: 'Rice (sync)' })
  assert((await lines.count()) === 2, `listed ${await lines.count()}`)
  assert((await lines.locator('[data-stamp="recorded"]').count()) === 2, 'not stamped RECORDED')
  assert((await centre().getByRole('button', { name: 'Check now' }).isDisabled()), 'Check now enabled offline')
  await page.screenshot({ path: SHOTS + '2-offline.png' })
  await closeCentre()
})

await check('server unreachable while online: "2 waiting to send" with Send now', async () => {
  // The phone has a network, the API doesn't answer.
  await page.route('**/api/products/*/stock/**', (route) => route.abort('connectionrefused').catch(() => {}))
  await goOnline()
  await pill().filter({ hasText: '2 waiting to send' }).waitFor({ timeout: 15000 })
  await openCentre()
  await centre().getByText(/2 stock changes waiting to send\. The server couldn't be reached/).waitFor()
  await centre().getByRole('button', { name: 'Send now' }).waitFor()
  await page.screenshot({ path: SHOTS + '3-waiting.png' })
})

await check('Send now: "Sending 1 of 2", then "All caught up", lines stamped SYNCED, then the pill goes quiet', async () => {
  await page.unroute('**/api/products/*/stock/**')
  // Slow each send down enough to see the count go by.
  await page.route('**/api/products/*/stock/**', async (route) => {
    if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 1200))
    await route.continue().catch(() => {})
  })
  await centre().getByRole('button', { name: 'Send now' }).click()
  // With the centre open the page behind it is inert (B2), so out of the accessibility tree: the
  // pill is found by its element here, not by its role.
  const pillBehind = () => page.locator('header button[aria-label$="Open sync details"]')
  await pillBehind().filter({ hasText: 'Sending 1 of 2' }).waitFor({ timeout: 5000 })
  await pillBehind().filter({ hasText: 'Sending 2 of 2' }).waitFor({ timeout: 5000 })
  await pillBehind().filter({ hasText: 'All caught up' }).waitFor({ timeout: 10000 })
  await centre().getByText('All caught up. Everything recorded on this phone has been sent.').waitFor()
  const sent = centre().getByRole('listitem').filter({ has: page.locator('[data-stamp="synced"]') })
  assert((await sent.count()) === 2, `sent receipts ${await sent.count()}`)
  await page.screenshot({ path: SHOTS + '4-sent.png' })
  await page.unroute('**/api/products/*/stock/**', { behavior: 'ignoreErrors' })
  assert((await onHand(rice.id)) === 51, `server has ${await onHand(rice.id)}`)
  await closeCentre()
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find((el) => el.getAttribute('aria-label')?.endsWith('Open sync details'))
    return b && b.innerText.trim() === ''
  }, null, { timeout: 8000 })
})

await check('unfinished forms are listed with a Continue link that picks the draft up', async () => {
  await page.goto(`${UI}/app/products/receive`)
  const qty = page.getByLabel(/Beans \(sync\).*how many arrived/)
  await qty.fill('6')
  await page.getByLabel('Invoice or waybill number').fill('WB-77')
  await page.getByText(/Draft saved on this phone at/).waitFor()
  await page.goto(`${UI}/app/products`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  await openCentre()
  const row = centre().getByRole('listitem').filter({ hasText: 'Delivery' })
  await row.getByText(/1 item · WB-77 · saved/).waitFor()
  await page.screenshot({ path: SHOTS + '5-drafts.png' })
  await row.getByRole('link', { name: 'Continue' }).click()
  await page.getByText(/Picked up your draft from/).waitFor()
  assert((await qty.inputValue()) === '6', 'draft not picked up')
  await page.getByRole('button', { name: 'Discard draft' }).click()
})

await check('a change that has waited 4 days turns the pill red and says so', async () => {
  await openProduct(beans)
  await context.setOffline(true)
  await (await stockIn(2)).getByRole('button', { name: 'Done' }).click()
  await pill().filter({ hasText: 'Offline · 1 saved on this phone' }).waitFor()
  // Age it: rewrite its entry time in the phone's outbox, then reopen the app.
  await page.evaluate(async () => {
    const name = (await indexedDB.databases()).map((d) => d.name).find((n) => n.startsWith('procurepaddy-outbox:'))
    await new Promise((resolve, reject) => {
      const open = indexedDB.open(name)
      open.onsuccess = () => {
        const tx = open.result.transaction('ops', 'readwrite')
        const store = tx.objectStore('ops')
        const all = store.getAll()
        all.onsuccess = () => {
          for (const op of all.result) store.put({ ...op, createdAt: op.createdAt - 4 * 24 * 3600 * 1000 })
        }
        tx.oncomplete = () => { open.result.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
  })
  await page.reload()
  const aged = pill().filter({ hasText: 'Offline · 1 saved on this phone · 4 days' })
  await aged.waitFor({ timeout: 10000 })
  assert((await aged.getAttribute('class')).includes('bg-danger-50'), 'not red')
  await openCentre()
  await centre().getByText(/The oldest has waited 4 days/).waitFor()
  await page.screenshot({ path: SHOTS + '6-aged.png' })
  await closeCentre()
})

await check('phone width: the pill shortens to "Offline · 1"', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  const short = pill().filter({ hasText: 'Offline · 1' })
  await short.waitFor()
  const visible = (await short.innerText()).trim()
  assert(visible === 'Offline · 1', `shows "${visible}"`)
  await page.screenshot({ path: SHOTS + '7-phone.png' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await goOnline()
  await pill().filter({ hasText: 'All caught up' }).waitFor({ timeout: 30000 })
  assert((await onHand(beans.id)) === 52, `server has ${await onHand(beans.id)}`)
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
