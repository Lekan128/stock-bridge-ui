// End-to-end checks for B2 (foundation: type, buttons, sheets, figures, stamps, states, toast + Undo), against the production preview (4173) and
// the real API (8081). "Another phone" is the API called directly from this script.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('foundation')

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
      name: `E2E Foundation ${unique}`,
      adminEmail: `foundation-${unique}@example.com`,
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


const history = async (id) => (await api(`/api/products/${id}/stock/history?size=50`, { token })).json.content
const rice = await createProduct('Rice (foundation)', 1000, 250)
const beans = await createProduct('Beans (foundation)', 100, 250)
const salt = await createProduct('Salt (foundation)', 0, 50)
if (salt) await api(`/api/products/${salt.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 50 } })
if (salt) await api(`/api/products/${salt.id}/stock/stock-out`, { token, method: 'POST', body: { quantity: 50 } })

await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })

const toast = (text) => page.getByRole('status').filter({ hasText: text })

await check('the workspace is set in IBM Plex Sans, stored for offline use; the storefront keeps Inter', async () => {
  const workspace = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  assert(workspace.startsWith('"IBM Plex Sans Variable"'), workspace)
  assert(await page.evaluate(() => document.fonts.check('600 16px "IBM Plex Sans Variable"')), 'Plex not loaded')
  const cached = await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const keys = await (await caches.open(name)).keys()
      if (keys.some((r) => r.url.includes('ibm-plex-sans-latin-standard-normal'))) return true
    }
    return false
  })
  assert(cached, 'Plex not precached')
  await page.goto(`${UI}/`)
  await page.waitForLoadState('networkidle')
  const storefront = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  assert(storefront.startsWith('Inter'), storefront)
})

await check('Inventory: one figure component and a bar against the alert level; no stripes', async () => {
  await page.goto(`${UI}/app/products`)
  await page.getByText('Rice (foundation)').first().waitFor()
  const row = (name) => page.locator('tr').filter({ hasText: name })
  assert((await row('Rice (foundation)').locator('[data-stock-bar="ok"]').count()) === 1, 'rice bar')
  assert((await row('Beans (foundation)').locator('[data-stock-bar="low"]').count()) === 1, 'beans not low')
  await row('Beans (foundation)').getByText('Low', { exact: true }).waitFor()
  assert((await row('Salt (foundation)').locator('[data-stock-bar="out"]').count()) === 1, 'salt not out')
  await row('Rice (foundation)').getByText('= 20 bags').waitFor()
  const stripes = await page.evaluate(() => [...document.querySelectorAll('tr, a')].filter((el) => getComputedStyle(el).boxShadow.includes('inset') || parseFloat(getComputedStyle(el).borderLeftWidth) >= 2).length)
  assert(stripes === 0, `${stripes} stripes`)
  // On Inventory the daily action is Record a delivery (C1); Add product sits beside it, secondary.
  const action = page.getByRole('button', { name: 'Record a delivery' }).first()
  assert((await action.getAttribute('class')).includes('bg-action'), 'Record a delivery is not the action button')
  const active = page.getByRole('link', { name: 'Inventory' }).first()
  assert((await active.getAttribute('class')).includes('bg-primary-50'), 'sidebar active is not a pill')
  await page.screenshot({ path: SHOTS + '1-inventory.png' })
})

await check('product page: Deactivate lives in "⋯", keyboard-operable, behind its confirmation', async () => {
  await openProduct(rice)
  assert((await page.getByRole('button', { name: 'Deactivate' }).count()) === 0, 'Deactivate on the header')
  const more = page.getByRole('button', { name: `More actions for ${rice.name}` })
  await more.focus()
  await page.keyboard.press('ArrowDown')
  // Since C2 the menu opens on "Edit product"; Deactivate is next.
  await page.getByRole('menuitem', { name: 'Edit product' }).waitFor()
  assert(await page.getByRole('menuitem', { name: 'Edit product' }).evaluate((el) => el === document.activeElement), 'focus not on the first item')
  await page.keyboard.press('ArrowDown')
  const item = page.getByRole('menuitem', { name: 'Deactivate' })
  assert(await item.evaluate((el) => el === document.activeElement), 'ArrowDown did not reach Deactivate')
  assert((await item.getAttribute('class')).includes('text-danger-700'), 'not set as danger text')
  await page.keyboard.press('Escape')
  await item.waitFor({ state: 'detached' })
  assert(await more.evaluate((el) => el === document.activeElement), 'focus not back on ⋯')
  await more.click()
  await item.click()
  await page.getByRole('dialog').getByText(/Deactivate/).first().waitFor()
  await page.keyboard.press('Escape')
})

await check('Stock in opens as a side panel on a laptop: focus in Quantity, trapped, page behind inert, returned on close', async () => {
  await openProduct(rice)
  const opener = page.getByRole('button', { name: 'Stock In' })
  assert((await opener.getAttribute('class')).includes('bg-action'), 'Stock In is not the action button')
  await opener.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await page.waitForTimeout(300)
  const box = await dialog.boundingBox()
  assert(Math.abs(box.x + box.width - 1280) < 2 && box.height > 880, `panel at ${JSON.stringify(box)}`)
  assert(await page.evaluate(() => document.activeElement?.getAttribute('name') === 'quantity' || document.activeElement?.id?.includes('quantity') || document.activeElement?.closest('label')?.textContent?.includes('Quantity') || document.activeElement?.getAttribute('aria-label')?.includes('uantity') || document.activeElement?.tagName === 'INPUT'), 'focus not in a field')
  assert(await page.evaluate(() => document.getElementById('root').inert === true), 'page behind not inert')
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    assert(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), `focus escaped at tab ${i}`)
  }
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  assert(await opener.evaluate((el) => el === document.activeElement), 'focus not returned to Stock In')
  assert(await page.evaluate(() => document.getElementById('root').inert === false), 'page left inert')
})

await check('…and as a bottom sheet on a phone', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Stock In' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await page.waitForTimeout(350)
  const box = await dialog.boundingBox()
  assert(Math.abs(box.y + box.height - 844) < 2 && box.width >= 389, `sheet at ${JSON.stringify(box)}`)
  await page.screenshot({ path: SHOTS + '2-sheet-phone.png' })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 900 })
})

await check('the product hero: the large figure, its packs, and a bar with the alert level spelled out', async () => {
  await openProduct(rice)
  await page.getByText('Alert at 250 kg', { exact: true }).waitFor()
  const hero = page.locator('[data-stock-figure]').filter({ hasText: '1,000' }).first()
  const size = await hero.locator('span').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  assert(size >= 40, `hero figure ${size}px`)
  await page.getByText('= 20 bags').first().waitFor()
})

// The sheet enters in the product's pack by default: 7 bags of 50 kg is 350 kg.
await check('Undo online: the toast carries the new figure, and Undo voids the stock-in on the server', async () => {
  await openProduct(rice)
  const dialog = await stockIn(7)
  await dialog.getByText('Recorded', { exact: false }).first().waitFor()
  await dialog.getByRole('button', { name: 'Done' }).click()
  const recorded = toast('Stock in recorded · Rice (foundation) now 1,350 kg')
  await recorded.waitFor()
  const box = await recorded.boundingBox()
  assert(box.x < 60 && box.y > 700, `toast at ${JSON.stringify(box)}`)
  await page.screenshot({ path: SHOTS + '3-toast-undo.png' })
  assert((await onHand(rice.id)) === 1350, 'not recorded')
  await recorded.getByRole('button', { name: 'Undo' }).click()
  await toast('Undone · Rice (foundation) is back to 1,000 kg').waitFor()
  assert((await onHand(rice.id)) === 1000, `server has ${await onHand(rice.id)}`)
  assert(!(await history(rice.id)).some((m) => m.quantity === 350), 'movement still in history')
  await page.getByText('1,000').first().waitFor()
})

await check('Undo refused: something else was recorded since — the reason is shown, nothing changes', async () => {
  await openProduct(beans)
  const dialog = await stockIn(5)
  await dialog.getByRole('button', { name: 'Done' }).click()
  const recorded = toast(/Stock in recorded · Beans/)
  await recorded.waitFor()
  await api(`/api/products/${beans.id}/stock/stock-out`, { token, method: 'POST', body: { quantity: 1 } }) // another phone
  await recorded.getByRole('button', { name: 'Undo' }).click()
  await toast(/Something else has been recorded for this product since/).waitFor()
  assert((await onHand(beans.id)) === 349, `server has ${await onHand(beans.id)}`) // 100 + 5 bags − 1
})

await check('Undo offline: a write waiting on this phone is taken back and never sent', async () => {
  await openProduct(rice)
  await page.getByRole('status').filter({ hasText: /recorded|Undone|Something else/ }).first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
  await context.setOffline(true)
  const dialog = await stockIn(9)
  await dialog.getByRole('button', { name: 'Done' }).click()
  const saved = toast(/Saved on this phone/).last()
  await saved.getByRole('button', { name: 'Undo' }).click()
  await toast('Taken back. Nothing was sent.').waitFor()
  await goOnline()
  await page.waitForTimeout(2500)
  assert((await onHand(rice.id)) === 1000, `server has ${await onHand(rice.id)}`)
  assert((await page.getByRole('button', { name: /waiting to send|saved on this phone/ }).count()) === 0, 'still waiting')
})

await check('the RECORDED stamp lands on the "Saved on this phone" receipt', async () => {
  await context.setOffline(true)
  const dialog = await stockIn(3)
  await dialog.locator('[data-stamp="recorded"]').waitFor()
  await page.screenshot({ path: SHOTS + '4-recorded-stamp.png' })
  await dialog.getByRole('button', { name: 'Done' }).click()
  await toast(/Saved on this phone/).last().getByRole('button', { name: 'Undo' }).click()
  await toast('Taken back. Nothing was sent.').last().waitFor()
  await goOnline()
})

await check('a page that cannot reach the server says so calmly, not "Something went wrong"', async () => {
  await page.route('**/api/products/sku-settings**', (route) => route.abort('connectionrefused'))
  await page.goto(`${UI}/app/products/sku-settings`)
  // The page keeps its own title; a failure to reach the server is set calm — a cloud, a neutral
  // border, no red — and never called "Something went wrong" (U8).
  const alert = page.getByRole('alert').filter({ hasText: "Couldn't reach Procure Paddy" })
  await alert.waitFor({ timeout: 20000 })
  assert((await alert.locator('.lucide-cloud-off').count()) === 1, 'no cloud icon')
  const cls = await alert.getAttribute('class')
  assert(cls.includes('border-neutral-200') && !cls.includes('danger'), cls)
  assert((await page.getByText('Something went wrong').count()) === 0, 'still says something went wrong')
  await page.screenshot({ path: SHOTS + '5-network-error.png' })
  await page.unroute('**/api/products/sku-settings**')
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
