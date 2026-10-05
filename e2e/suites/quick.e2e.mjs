// End-to-end checks for B2 (C4: quick mode — receive, issue, count at the gate), against the production preview (4173) and
// the real API (8081). "Another phone" is the API called directly from this script.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('quick')

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
      name: `E2E Quick ${unique}`,
      adminEmail: `quick-${unique}@example.com`,
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

async function goOnline() {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}



const rice = await createProduct('Rice (c4)', 1000, 250)
const BARCODE = `615${String(Date.now()).slice(-9)}`
let soap
{
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name: 'Bar soap (c4)', sku: `C4-SOAP-${unique}`, barcode: BARCODE, unitOfMeasure: 'PIECE' })], { type: 'application/json' }))
  soap = (await api('/api/products', { token, method: 'POST', body: form })).json
  await api(`/api/products/${soap.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 40 } })
}

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })
// Let the device catalogue take the new products, so search is answered on the phone.
await page.waitForTimeout(2500)
const search = () => page.getByPlaceholder('Scan, or type a name or code')
const keypad = (keys) => (async () => { for (const k of keys) await page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: k, exact: true }).click() })()
const session = () => page.locator('section[aria-labelledby="quick-session-heading"]')

await check('from Inventory on a phone, one tap opens quick mode, full screen, with big targets', async () => {
  await page.getByRole('button', { name: 'Quick mode' }).click()
  await page.waitForURL(/\/app\/quick/)
  await search().waitFor()
  assert(await search().evaluate((el) => el === document.activeElement), 'the search box is not ready for a scan')
  const box = await page.locator('.fixed.inset-0').first().boundingBox()
  assert(box.width >= 389 && box.height >= 843, 'not full screen')
})

await check('receive: find, a keypad amount in bags, the stamp, and straight back to the scan box', async () => {
  await search().fill('rice (c4)')
  await page.getByRole('button', { name: /Rice \(c4\)/ }).click()
  const key = await page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: '5', exact: true }).boundingBox()
  assert(key.height >= 56, `keypad key ${key.height}px`)
  await keypad(['2'])
  await page.getByText('2 bags (100 kg)').first().waitFor()
  await page.getByRole('button', { name: 'Receive 2 bags (100 kg)' }).click()
  await page.locator('[role="status"] [data-stamp="synced"]').first().waitFor()
  await page.screenshot({ path: SHOTS + '1-stamp.png' })
  await search().waitFor({ timeout: 3000 })
  await page.waitForFunction(() => document.activeElement?.id === 'quick-search')
  await session().getByText('Received · 2 bags (100 kg)').waitFor()
  assert((await onHand(rice.id)) === 1100, `server has ${await onHand(rice.id)}`)
})

await check('Undo takes the last one back', async () => {
  await session().getByRole('button', { name: 'Undo' }).click()
  await session().getByText('Undone', { exact: true }).waitFor()
  assert((await onHand(rice.id)) === 1000, `server has ${await onHand(rice.id)}`)
})

await check('nothing typed: says so instead of recording', async () => {
  await page.getByRole('button', { name: 'Issue', exact: true }).click()
  await search().fill('rice (c4)')
  await page.getByRole('button', { name: /Rice \(c4\)/ }).click()
  await page.getByRole('button', { name: 'Record' }).click()
  await page.getByText('Type how many.').waitFor()
  await page.getByRole('button', { name: 'Change' }).click()
})

await check('offline: a scanned barcode finds the product on the phone; the issue is RECORDED, then SYNCED', async () => {
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await search().fill(BARCODE)
  await page.keyboard.press('Enter')
  await page.getByText('Bar soap (c4)').first().waitFor()
  await keypad(['5'])
  await page.getByRole('button', { name: /^Issue 5 pieces/ }).click()
  await search().waitFor({ timeout: 4000 })
  const row = session().locator('li').filter({ hasText: 'Bar soap (c4)' })
  await row.locator('[data-stamp="recorded"]').waitFor()
  await page.screenshot({ path: SHOTS + '2-offline.png' })
  assert((await onHand(soap.id)) === 40, 'sent while offline?')
  await goOnline()
  await row.locator('[data-stamp="synced"]').waitFor({ timeout: 30000 })
  assert((await onHand(soap.id)) === 35, `server has ${await onHand(soap.id)}`)
})

await check('count: the shelf figure and its difference from the book, then recorded', async () => {
  await page.getByRole('button', { name: 'Count', exact: true }).click()
  await search().fill('rice (c4)')
  await page.getByRole('button', { name: /Rice \(c4\)/ }).click()
  await keypad(['9', '9', '6'])
  await page.getByText('vs the book').waitFor()
  await page.locator('[data-stock-figure]').getByText('−4').waitFor()
  await page.screenshot({ path: SHOTS + '3-count.png' })
  await page.getByRole('button', { name: /^Count 996 kg/ }).click()
  await search().waitFor({ timeout: 4000 })
  assert((await onHand(rice.id)) === 996, `server has ${await onHand(rice.id)}`)
})

await check('Exit goes back to Inventory', async () => {
  await page.getByRole('button', { name: 'Exit' }).click()
  await page.waitForURL(/\/app\/products$/)
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
