// End-to-end checks for A5 (drafts on the phone), against the production preview (4173) and the
// real API (8081).
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('drafts')

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
      await pg.screenshot({ path: SHOTS + `fail-${results.length}-${i++}.png`, fullPage: true }).catch(() => {})
    }
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
      name: `E2E Drafts ${unique}`,
      adminEmail: `drafts-${unique}@example.com`,
      password: 'correct-horse-battery-staple',
      confirmPassword: 'correct-horse-battery-staple',
    },
  })
).json
const token = signup.tokens.accessToken
async function createProduct(name) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `DR-${name.replace(/\W+/g, '').slice(0, 8)}-${unique}`, unitOfMeasure: 'KG' })], { type: 'application/json' }))
  return (await api('/api/products', { token, method: 'POST', body: form })).json
}
const onHand = async (id) => (await api(`/api/products/${id}`, { token })).json.quantityOnHand
const productsNamed = async (name) =>
  ((await api(`/api/products?search=${encodeURIComponent(name)}&size=50`, { token })).json.content ?? []).filter((p) => p.name === name)

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

async function goOnline() {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}
async function goOffline() {
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
}

const yam = await createProduct('Yam flour (draft)')
await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })

const quantityBox = () => page.getByLabel(/Yam flour \(draft\).*how many arrived/)
const invoiceBox = () => page.getByLabel('Invoice or waybill number')
async function openDelivery() {
  await page.goto(`${UI}/app/products/receive`)
  await page.getByRole('heading', { name: 'Record a delivery', level: 1 }).waitFor()
  await quantityBox().waitFor()
}

// ------------------------------------------------------------------------------------ delivery

await check('delivery: typing is saved on the phone and picked up again after a reload', async () => {
  await openDelivery()
  assert((await page.getByText(/Draft saved on this phone|Picked up your draft/).count()) === 0, 'a note before anything was typed')
  await quantityBox().fill('7')
  await invoiceBox().fill('INV-A5')
  await page.getByText(/Draft saved on this phone at/).waitFor()
  await page.reload()
  await page.getByText(/Picked up your draft from/).waitFor()
  await quantityBox().waitFor()
  assert((await quantityBox().inputValue()) === '7', `quantity is ${await quantityBox().inputValue()}`)
  assert((await invoiceBox().inputValue()) === 'INV-A5', 'invoice not restored')
})

await check('delivery: offline, the draft is still there and the button waits for a connection', async () => {
  await goOffline()
  await page.reload()
  await page.getByText(/Picked up your draft from/).waitFor()
  await quantityBox().waitFor()
  assert((await quantityBox().inputValue()) === '7', 'quantity lost offline')
  const button = page.getByRole('button', { name: 'Submit when online' })
  await button.waitFor()
  assert(await button.isDisabled(), 'submit enabled offline')
  await page.getByText(/You're offline\. This delivery is saved on this phone/).waitFor()
  await page.screenshot({ path: SHOTS + 'delivery-offline.png' })
})

await check('delivery: back online it submits, and the draft is gone afterwards', async () => {
  await goOnline()
  const button = page.getByRole('button', { name: /^Add 1 item/ })
  await button.waitFor()
  await button.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await dialog.getByRole('button').last().click()
  await page.waitForURL(/\/app\/products\/import\/.+\/result/, { timeout: 20000 })
  assert(Number(await onHand(yam.id)) === 7, `on hand ${await onHand(yam.id)}`)
  await openDelivery()
  await sleep(600)
  assert((await page.getByText(/Draft saved on this phone|Picked up your draft/).count()) === 0, 'draft note still shown')
  assert((await quantityBox().inputValue()) === '', 'quantity still filled')
})

await check('delivery: "Discard draft" empties the form, and nothing comes back after a reload', async () => {
  await quantityBox().fill('3')
  await page.getByText(/Draft saved on this phone at/).waitFor()
  await page.getByRole('button', { name: 'Discard draft' }).click()
  assert((await quantityBox().inputValue()) === '', 'quantity kept after discard')
  await sleep(300) // the delete is a moment's IndexedDB write; a person can't reload faster
  await page.reload()
  await quantityBox().waitFor()
  await sleep(600)
  assert((await page.getByText(/Picked up your draft/).count()) === 0, 'discarded draft came back')
  assert((await quantityBox().inputValue()) === '', 'quantity came back')
})

// ------------------------------------------------------------------------------------ product

const nameBox = () => page.getByLabel('Name', { exact: true })
const skuBox = () => page.getByLabel('SKU', { exact: true })
const descriptionBox = () => page.getByLabel('Description', { exact: true })
const productName = `Ofada rice ${unique}`
async function openNewProduct() {
  await page.goto(`${UI}/app/products/new`)
  await nameBox().waitFor()
}

await check('new product: nothing is saved until something is typed', async () => {
  await openNewProduct()
  await sleep(800)
  assert((await page.getByText(/Draft saved on this phone/).count()) === 0, 'saved with nothing typed')
})

await check('new product: typing is saved and picked up after a reload, with the photo caveat', async () => {
  await nameBox().fill(productName)
  await skuBox().fill(`OFADA-${unique}`)
  await descriptionBox().fill('Abakaliki, 50 kg bags')
  await page.getByText(/Draft saved on this phone at/).waitFor()
  await page.reload()
  await page.getByText(/Picked up your draft from .*Add the photo again if it had one\./).waitFor()
  assert((await nameBox().inputValue()) === productName, `name is ${await nameBox().inputValue()}`)
  assert((await skuBox().inputValue()) === `OFADA-${unique}`, 'sku not restored')
  assert((await descriptionBox().inputValue()) === 'Abakaliki, 50 kg bags', 'description not restored')
})

await check('new product: offline the button reads "Create when online" and is disabled', async () => {
  await goOffline()
  await page.reload()
  await page.getByText(/Picked up your draft from/).waitFor()
  const button = page.getByRole('button', { name: 'Create when online' })
  await button.waitFor()
  assert(await button.isDisabled(), 'create enabled offline')
  await page.screenshot({ path: SHOTS + 'product-offline.png', fullPage: true })
  await goOnline()
})

await check('new product: a different name arriving from search offers the draft instead of replacing it', async () => {
  // As the "Add “…”" link from a search would: navigate with the typed name in router state.
  await page.goto(`${UI}/app/products`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  await page.evaluate(() => {
    window.history.pushState({ usr: { name: 'Garri' }, key: 'e2e', idx: 1 }, '', '/app/products/new')
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
  })
  await nameBox().waitFor()
  await page.getByText(/You have an unsent draft for/).waitFor()
  assert((await nameBox().inputValue()) === 'Garri', `name is ${await nameBox().inputValue()}`)
  await page.getByRole('button', { name: 'Open the draft' }).click()
  assert((await nameBox().inputValue()) === productName, 'draft not applied')
  await page.getByText(/Picked up your draft from/).waitFor()
})

await check('new product: creating it clears the draft', async () => {
  await page.getByRole('button', { name: 'Create product' }).click()
  await page.waitForURL(/\/app\/products\/[0-9a-f-]{36}$/, { timeout: 20000 })
  assert((await productsNamed(productName)).length === 1, 'product not created once')
  await openNewProduct()
  await sleep(800)
  assert((await page.getByText(/Picked up your draft|unsent draft/).count()) === 0, 'draft still there')
  assert((await nameBox().inputValue()) === '', 'name still filled')
})

await check('new product: Cancel throws the draft away', async () => {
  await nameBox().fill('Cancelled thing')
  await page.getByText(/Draft saved on this phone at/).waitFor()
  // The form was opened directly, so going back leaves the page: the delete must finish first.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForURL(/\/app\/products\/[0-9a-f-]{36}$/)
  await openNewProduct()
  await sleep(800)
  assert((await nameBox().inputValue()) === '', 'cancelled draft came back')
})

// ------------------------------------------------------------------------------------ logout

await check('logout: unfinished forms are named, and deleted from the phone when confirmed', async () => {
  await openDelivery()
  await quantityBox().fill('2')
  await page.getByText(/Draft saved on this phone at/).waitFor()
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('Unfinished forms on this phone').waitFor()
  await dialog.getByText(/1 unfinished form \(a delivery or a new product\) saved on this phone will be deleted/).waitFor()
  await page.screenshot({ path: SHOTS + 'logout-guard.png' })
  await dialog.getByRole('button', { name: 'Log out and discard' }).click()
  await page.waitForURL(`${UI}/`)
  const left = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).filter((n) => n.startsWith('procurepaddy-drafts')))
  assert(left.length === 0, `drafts DB left: ${left}`)
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
