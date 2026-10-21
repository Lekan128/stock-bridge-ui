// End-to-end checks for selling Phase 2 (SELLING_PRICE_PLAN.md §6.3, §6.9): the optional reason on a
// stock-out, against the production preview (4173) and the real API (8081). The API is also called
// directly from this script to read back what the ledger holds.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const SHOTS = shotsPrefix('reasons')
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')

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
      name: `E2E Reasons ${unique}`,
      adminEmail: `reasons-${unique}@example.com`,
      password: 'correct-horse-battery-staple',
      confirmPassword: 'correct-horse-battery-staple',
    },
  })
).json
const token = signup.tokens.accessToken
async function createProduct(name, opening) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `RS-${name.replace(/\W+/g, '').slice(0, 8)}-${unique}`, unitOfMeasure: 'KG', packagingUnit: 'BAG', packagingSize: 50 })], { type: 'application/json' }))
  const product = (await api('/api/products', { token, method: 'POST', body: form })).json
  if (opening) await api(`/api/products/${product.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: opening } })
  return product
}
/** The product's stock-outs, newest first, as the ledger holds them. */
const outs = async (id) =>
  (await api(`/api/products/${id}/stock/history?size=50&sort=createdAt,desc`, { token })).json.content.filter((m) => m.movementType === 'OUT')

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
const dialog = page.getByRole('dialog')
async function goOnline() {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}

const rice = await createProduct('Rice (rs)', 1000)
const beans = await createProduct('Beans (rs)', 1000)

await page.goto(`${UI}/app/products/${rice.id}`)
await page.getByRole('heading', { name: rice.name, level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })

await check('a stock-out with no reason costs exactly the clicks it always did, and records none', async () => {
  await page.getByRole('button', { name: 'Stock out' }).click()
  // The reason waits behind a link beside "Add a note"; nothing on the sheet asks for it.
  await dialog.getByRole('button', { name: 'Add a reason' }).waitFor()
  await dialog.getByRole('button', { name: 'Add a note' }).waitFor()
  assert((await dialog.getByRole('radio').count()) === 0, 'reasons are on show before anyone asked for them')
  // The same two steps as before Phase 2: a quantity, then Confirm.
  await dialog.getByLabel('Quantity').fill('3')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.locator('[data-receipt="synced"]').waitFor()
  assert((await dialog.getByText('Reason', { exact: true }).count()) === 0, 'the receipt names a reason nobody gave')
  await dialog.getByRole('button', { name: 'Done' }).click()
  const [latest] = await outs(rice.id)
  assert(latest.quantity === 3 && latest.outReason === undefined, `ledger: ${JSON.stringify(latest)}`)
})

await check('a reason is two taps, shows as a chip, can be taken off, and reaches the ledger and the history', async () => {
  await page.getByRole('button', { name: 'Stock out' }).click()
  await dialog.getByRole('button', { name: 'Add a reason' }).click()
  await page.screenshot({ path: SHOTS + '0-sheet-open.png' })
  // The open list, as a screen reader and axe see it (the a11y suite only sees the sheet closed).
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
  await page.addScriptTag({ path: AXE })
  const violations = await page.evaluate(async () =>
    (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }))
      .violations.map((v) => `${v.id} ×${v.nodes.length}`))
  assert(violations.length === 0, `axe on the open reasons: ${violations.join(', ')}`)
  await dialog.getByRole('group', { name: /Why did it go out/ }).waitFor()
  await dialog.getByRole('radio', { name: 'Damaged' }).click()
  // Picking closes the list (so it is clicked, not .check()ed - the radio is gone once it has done its
  // job) and shows the choice, with a way to take it off.
  await dialog.getByRole('button', { name: /Reason: Damaged/ }).waitFor()
  await dialog.getByRole('button', { name: 'Remove the reason' }).click()
  await dialog.getByRole('button', { name: 'Add a reason' }).click()
  await dialog.getByRole('radio', { name: 'Expired' }).click()
  await dialog.getByLabel('Quantity').fill('2')
  await page.screenshot({ path: SHOTS + '1-sheet-reason.png' })
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  const receipt = dialog.locator('[data-receipt="synced"]')
  await receipt.waitFor()
  await receipt.getByText('Expired').waitFor()
  await dialog.getByRole('button', { name: 'Done' }).click()
  const [latest] = await outs(rice.id)
  assert(latest.outReason === 'EXPIRED', `ledger: ${latest.outReason}`)
  await page.locator('section[aria-labelledby="product-history-heading"] table').getByText('Expired').first().waitFor()
})

await check('offline: the reason is kept on the phone and lands with the stock-out', async () => {
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await page.getByRole('button', { name: 'Stock out' }).click()
  await dialog.getByRole('button', { name: 'Add a reason' }).click()
  await dialog.getByRole('radio', { name: 'Used' }).click()
  await dialog.getByLabel('Quantity').fill('1')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.locator('[data-receipt="recorded"]').waitFor()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await goOnline()
  for (let i = 0; i < 40; i++) {
    const [latest] = await outs(rice.id)
    if (latest.outReason === 'USED') return
    await page.waitForTimeout(500)
  }
  throw new Error('the offline stock-out never arrived with its reason')
})

await check('quick mode: the reason stays on for the session, is on every stamp, and goes when quick mode closes', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${UI}/app/quick?mode=out`)
  await page.getByRole('heading', { name: 'Quick mode' }).waitFor()
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Add a reason' }).click()
  await page.getByRole('group', { name: 'Why is it going out?' }).getByRole('button', { name: 'Expired' }).click()
  await page.getByRole('button', { name: /Reason: Expired/ }).waitFor()
  // Glove-sized, like everything else in quick mode.
  for (const name of [/Reason: Expired/, 'Remove the reason']) {
    const box = await page.getByRole('button', { name }).boundingBox()
    assert(box.width >= 44 && box.height >= 44, `${name} is ${box.width}×${box.height}`)
  }
  const keypad = (keys) => (async () => { for (const k of keys) await page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: k, exact: true }).click() })()
  for (const product of [rice, beans]) {
    await page.locator('#quick-search').fill(product.name)
    await page.getByRole('button', { name: new RegExp(product.name.replace(/[()]/g, '\\$&')) }).click()
    await keypad(['4'])
    await page.getByRole('button', { name: /^Stock out 4 kg · Expired/ }).click()
    await page.locator('[role="status"]').getByText(/Expired/).waitFor()
    await page.locator('#quick-search').waitFor({ timeout: 4000 })
  }
  await page.screenshot({ path: SHOTS + '2-quick.png' })
  const session = page.locator('section[aria-labelledby="quick-session-heading"]')
  assert((await session.getByText(/Stock out · 4 kg · Expired/).count()) === 2, 'the session list does not repeat the reason')
  for (const product of [rice, beans]) {
    const [latest] = await outs(product.id)
    assert(latest.outReason === 'EXPIRED' && latest.quantity === 4, `${product.name}: ${JSON.stringify(latest)}`)
  }
  await page.getByRole('button', { name: 'Exit' }).click()
  await page.goto(`${UI}/app/quick?mode=out`)
  await page.getByRole('button', { name: 'Add a reason' }).waitFor()
  assert((await page.getByRole('button', { name: /Reason: Expired/ }).count()) === 0, 'yesterday’s reason is still on')
  await page.getByRole('button', { name: 'Exit' }).click()
  await page.setViewportSize({ width: 1280, height: 900 })
})

await check('the movements report filters stock-outs by reason, and says when none was given', async () => {
  await page.goto(`${UI}/app/stock-movements`)
  await page.getByRole('heading', { name: 'Stock movements', level: 1 }).waitFor()
  assert((await page.getByLabel('Reason').count()) === 0, 'a reason filter beside "Everything"')
  await page.getByLabel('Show').selectOption('OUT')
  await page.getByLabel('Reason').selectOption('EXPIRED')
  const rows = page.locator('table tbody tr')
  await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 3)
  for (const text of await rows.allInnerTexts()) assert(/Expired/.test(text), `a row that is not Expired: ${text}`)
  await page.getByLabel('Reason').selectOption('NONE')
  await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 1)
  await page.screenshot({ path: SHOTS + '3-report.png' })
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
