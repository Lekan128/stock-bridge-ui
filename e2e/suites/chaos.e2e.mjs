// Phase H chaos: the ways a real phone loses work, staged on purpose. Against the production
// preview and the real API; "another phone" is a second browser context, or the API called directly.
//
//   1. Zero lost writes: offline, three stock-ins, the tab killed, reopened, back online —
//      exactly three movements on the server, every one stamped SYNCED.
//   2. A lost reply: the server records the write, the answer never arrives — it is sent again and
//      recorded once (Idempotency-Key).
//   3. Two phones: one counts offline, the other sells after the count — the count keeps the sale (D1).
//   4. A permission removed while a phone is offline: its waiting write is refused, not lost.
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'

const SHOTS = shotsPrefix('chaos')
const PASSWORD = 'correct-horse-battery-staple'
const results = []
let browser
async function check(name, fn) {
  try {
    await fn()
    results.push(['PASS', name])
    console.log('PASS', name)
  } catch (err) {
    results.push(['FAIL', name, err.message])
    console.log('FAIL', name, '\n   ', err.message.split('\n').slice(0, 4).join(' | '))
    let i = 0
    for (const ctx of browser.contexts()) for (const pg of ctx.pages()) await pg.screenshot({ path: `${SHOTS}fail-${results.length}-${i++}.png` }).catch(() => {})
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
    body: { name: `E2E Chaos ${unique}`, adminEmail: `chaos-${unique}@example.com`, password: PASSWORD, confirmPassword: PASSWORD },
  })
).json
const token = signup.tokens.accessToken
const ownerName = `chaos-${unique}@example.com`
const me = (await api('/api/me', { token })).json
const clientIdentifier = me.client?.identifier ?? me.tenant?.identifier ?? me.clientIdentifier
/** A fresh session for one phone: each phone signs in on its own, as a real one would. */
async function session(username = ownerName) {
  const login = (await api('/api/auth/login', { method: 'POST', body: { clientIdentifier, username, password: PASSWORD } })).json
  if (!login.tokens) throw new Error(`login failed for ${username}: ${JSON.stringify(login).slice(0, 200)}`)
  return login.tokens.refreshToken
}

async function createProduct(name, opening) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `CH-${name.replace(/\W+/g, '').slice(0, 8)}-${unique}`, unitOfMeasure: 'KG' })], { type: 'application/json' }))
  const product = (await api('/api/products', { token, method: 'POST', body: form })).json
  if (opening) await api(`/api/products/${product.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: opening } })
  return product
}
const onHand = async (id) => (await api(`/api/products/${id}`, { token })).json.quantityOnHand
const movements = async (id) => (await api(`/api/products/${id}/stock/history?size=100`, { token })).json.content
async function settles(read, want, seconds = 30) {
  let got
  for (let i = 0; i < seconds * 2; i++) {
    got = await read()
    if (got === want) return got
    await new Promise((r) => setTimeout(r, 500))
  }
  return got
}

/** A phone: its own browser context, signed in with its own session. */
async function phone(refreshToken) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.addInitScript(
    ([rt]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('__seeded', '1')
      }
    },
    [refreshToken],
  )
  const page = await context.newPage()
  return { context, page }
}
async function goOffline(context, page) {
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
}
async function goOnline(context, page) {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}
async function ready(page) {
  await page.goto(`${UI}/app/products`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })
}
async function openProduct(page, product) {
  // The heading can be drawn from what the phone already holds before the product's own request
  // answers, so wait for that answer, and then for it to be saved on the phone: a save still
  // committing when the page unloads is lost, and these checks are about what happens after.
  const answered = page.waitForResponse((r) => r.url() === `${API}/api/products/${product.id}` && r.ok())
  await page.goto(`${UI}/app/products/${product.id}`)
  await answered
  await page.getByRole('heading', { name: product.name, level: 1 }).waitFor()
  // (Polled from here: waitForFunction takes a returned Promise itself as "truthy".)
  const saved = () =>
    page.evaluate(async (id) => {
      const name = (await indexedDB.databases()).map((d) => d.name).find((n) => n?.startsWith('procurepaddy-cache'))
      if (!name) return false
      const db = await new Promise((resolve) => {
        const open = indexedDB.open(name)
        open.onsuccess = () => resolve(open.result)
      })
      const raw = await new Promise((resolve) => {
        const get = db.transaction('kv').objectStore('kv').get('query-cache')
        get.onsuccess = () => resolve(get.result)
      })
      db.close()
      return typeof raw === 'string' && raw.includes(`"detail","${id}"`)
    }, product.id)
  for (let waited = 0; !(await saved()); waited += 100) {
    assert(waited < 10000, `${product.name} was never saved on the phone`)
    await page.waitForTimeout(100)
  }
}
/** Stock in through the phone's own bar and sheet; the product here has no pack, so it is in kg. */
async function stockIn(page, quantity) {
  await page.getByRole('region', { name: 'Stock actions' }).getByRole('button', { name: 'Stock in' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill(String(quantity))
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.locator('[data-receipt="synced"], [data-receipt="recorded"]').waitFor()
  await dialog.getByRole('button', { name: 'Done' }).click()
}

browser = await chromium.launch(launchOptions)

// ------------------------------------------------------------------------------------------- 1
await check('zero lost writes: three stock-ins offline, the tab killed, reopened — exactly three arrive, all SYNCED', async () => {
  const rice = await createProduct('Rice (chaos)', 100)
  const { context, page } = await phone(await session())
  await ready(page)
  await openProduct(page, rice)
  await goOffline(context, page)
  await page.reload() // offline, the app still opens (A1)
  await page.getByRole('heading', { name: rice.name, level: 1 }).waitFor()
  for (const quantity of [3, 5, 7]) await stockIn(page, quantity)
  await page.getByRole('button', { name: /Offline · 3 saved on this phone/ }).waitFor()
  await page.close() // the tab is killed with three writes waiting

  const reopened = await context.newPage()
  await reopened.goto(`${UI}/app/products/${rice.id}`).catch(() => {}) // still offline: served by the service worker
  await reopened.getByRole('heading', { name: rice.name, level: 1 }).waitFor()
  await reopened.getByRole('button', { name: /Offline · 3 saved on this phone/ }).waitFor()
  assert((await onHand(rice.id)) === 100, 'something was sent while offline')
  await goOnline(context, reopened)
  assert((await settles(() => onHand(rice.id), 115)) === 115, `server has ${await onHand(rice.id)}`)
  const ins = (await movements(rice.id)).filter((m) => m.movementType === 'IN').map((m) => m.quantity).sort((a, b) => a - b)
  assert(JSON.stringify(ins) === JSON.stringify([3, 5, 7, 100]), `movements: ${ins}`)
  await reopened.getByRole('button', { name: 'All caught up. Open sync details' }).or(reopened.getByRole('button', { name: /All caught up/ })).first().click()
  const centre = reopened.getByRole('dialog', { name: 'On this phone' })
  await centre.waitFor()
  assert((await centre.locator('[data-stamp="synced"]').count()) === 3, 'not every receipt stamped SYNCED')
  await reopened.screenshot({ path: `${SHOTS}1-zero-lost.png` })
  await context.close()
})

// ------------------------------------------------------------------------------------------- 2
await check('a lost reply: the server records it, the answer never comes — sent again, recorded once', async () => {
  const beans = await createProduct('Beans (chaos)', 50)
  const { context, page } = await phone(await session())
  await ready(page)
  await openProduct(page, beans)
  let dropped = 0
  await page.route('**/api/products/*/stock/stock-in', async (route) => {
    if (dropped === 0) {
      dropped++
      await route.fetch() // the server commits…
      return route.abort('connectionreset') // …and the reply is lost on the way back
    }
    return route.continue()
  })
  await stockIn(page, 9)
  assert(dropped === 1, 'the request never reached the server')
  // The phone could not tell it had landed, so it keeps it and sends it again — same key.
  assert((await settles(() => onHand(beans.id), 59)) === 59, `server has ${await onHand(beans.id)}`)
  await page.waitForTimeout(2000)
  const nines = (await movements(beans.id)).filter((m) => m.quantity === 9)
  assert(nines.length === 1, `recorded ${nines.length} times`)
  await page.getByRole('button', { name: /All caught up/ }).first().waitFor({ timeout: 30000 })
  await context.close()
})

// ------------------------------------------------------------------------------------------- 3
await check('two phones: one counts offline, the other sells after — the count keeps the sale', async () => {
  const sugar = await createProduct('Sugar (chaos)', 40)
  const counter = await phone(await session())
  const seller = await phone(await session())
  await ready(counter.page)
  await ready(seller.page)
  await openProduct(counter.page, sugar)
  await openProduct(seller.page, sugar)

  await goOffline(counter.context, counter.page)
  await counter.page.getByRole('region', { name: 'Stock actions' }).getByRole('button', { name: 'Count' }).click()
  const countSheet = counter.page.getByRole('dialog')
  await countSheet.getByLabel(/How much is on the shelf/).fill('30')
  await countSheet.getByRole('button', { name: 'Record count' }).click()
  await countSheet.getByRole('button', { name: 'Done' }).click()
  await counter.page.waitForTimeout(1500) // the sale below happens after the count

  await seller.page.getByRole('region', { name: 'Stock actions' }).getByRole('button', { name: 'Stock out' }).click()
  const outSheet = seller.page.getByRole('dialog')
  await outSheet.getByLabel('Quantity').fill('4')
  await outSheet.getByRole('button', { name: 'Confirm' }).click()
  await outSheet.locator('[data-receipt="synced"]').waitFor()
  assert((await onHand(sugar.id)) === 36, 'the sale did not land')

  await goOnline(counter.context, counter.page)
  // Counted 30 before the sale of 4: the shelf now holds 26, not 30.
  assert((await settles(() => onHand(sugar.id), 26)) === 26, `server has ${await onHand(sugar.id)}`)
  await counter.context.close()
  await seller.context.close()
})

// ------------------------------------------------------------------------------------------- 4
await check('a permission removed while offline: the waiting write is refused and kept, never lost', async () => {
  const oil = await createProduct('Oil (chaos)', 20)
  const permissions = (await api('/api/permissions', { token })).json
  const codes = (Array.isArray(permissions) ? permissions : permissions.content ?? []).map((p) => p.code ?? p)
  assert(codes.includes('STOCK_IN'), `no STOCK_IN in ${JSON.stringify(codes).slice(0, 200)}`)
  const role = (await api('/api/roles', { token, method: 'POST', body: { name: `Storekeeper ${unique}`, permissionCodes: ['VIEW_PRODUCTS', 'STOCK_IN'] } })).json
  const username = `keeper-${unique}`
  const created = await api('/api/users', { token, method: 'POST', body: { username, password: PASSWORD, roleId: role.id } })
  assert(created.status < 300, `user: ${created.status} ${JSON.stringify(created.json)}`)
  const { context, page } = await phone(await session(username))
  await ready(page)
  await openProduct(page, oil)
  await goOffline(context, page)
  await stockIn(page, 6)
  // Meanwhile the owner takes Stock in away from the role.
  const updated = await api(`/api/roles/${role.id}`, { token, method: 'PUT', body: { name: role.name, permissionCodes: ['VIEW_PRODUCTS'] } })
  assert(updated.status < 300, `role update: ${updated.status}`)
  await goOnline(context, page)
  await page
    .getByRole('button', { name: /1 needs you/ })
    .waitFor({ timeout: 40000 })
    .catch(async (err) => {
      throw new Error(`${err.message.split('\n')[0]} — server on hand ${await onHand(oil.id)} (20 means not recorded)`)
    })
  await page.getByRole('button', { name: /1 needs you/ }).click()
  const centre = page.getByRole('dialog', { name: 'On this phone' })
  await centre.getByText(/no longer allowed/).waitFor()
  await centre.locator('[data-stamp="check"]').waitFor()
  await page.screenshot({ path: `${SHOTS}4-revoked.png` })
  assert((await onHand(oil.id)) === 20, 'recorded without the permission')
  await context.close()
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
