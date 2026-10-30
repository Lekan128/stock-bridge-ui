// End-to-end checks for areas inside a branch, Part 1 (STOCK_AREAS_PART_1.md), against the production
// preview (4173) and the real API (8081).
//   1. The Store is shown before any area is added; the owner adds Kitchen, Bar and Housekeeping (uses
//      what it's given) from Branches; everything the branch held stays in the Store.
//   2. The product page and Inventory show "Store 10 · ...", zeros left out.
//   3. A stock-in sheet asks which area, and records into the Kitchen.
//   4. A stock-out from the Kitchen is judged against the Kitchen: asking for more than it has is refused.
//   5. Deliveries move from their own setting and back; from an area's "⋯" the Bar closes (empty) and
//      reopens; the Store, where deliveries arrive, can't close.
//   6. A company without areas sees no area word on its sheets or its product page (rule 1), and can
//      rename its Store from Branches.
//   7. axe on Branches with areas, and on the Add areas sheet (phone).
import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('areas')
const PASSWORD = 'correct-horse-battery-staple'
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')

async function axe(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return result.violations.map((v) => `${v.id} ×${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)
  })
}

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

async function signup(label) {
  const unique = randomUUID().slice(0, 8)
  const email = `${label}-${unique}@example.com`
  const response = await api('/api/clients/signup', {
    method: 'POST',
    body: { name: `E2E ${label} ${unique}`, adminEmail: email, password: PASSWORD, confirmPassword: PASSWORD },
  })
  return { ...response.json, unique, email }
}

async function login(clientIdentifier, username) {
  return (await api('/api/auth/login', { method: 'POST', body: { clientIdentifier, username, password: PASSWORD } })).json
}

async function createProduct(token, unique, name) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `AR-${name.slice(0, 4)}-${unique}`, unitOfMeasure: 'PIECE' })], { type: 'application/json' }))
  return (await api('/api/products', { token, method: 'POST', body: form })).json
}

async function contextFor(session, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(
    ([rt]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('__seeded', '1')
      }
    },
    [session.tokens.refreshToken],
  )
  return context
}

/** The product's figure in each area, by area name. */
async function areaFigures(token, productId) {
  const detail = (await api(`/api/products/${productId}`, { token })).json
  const branch = (await api('/api/branches', { token })).json.branches[0]
  const names = Object.fromEntries((branch.areas ?? []).map((area) => [area.id, area.name]))
  return Object.fromEntries((detail.areaStock ?? []).map((figure) => [names[figure.areaId], figure.quantityOnHand]))
}

async function waitFor(predicate, what, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`timed out waiting for ${what}`)
}

browser = await chromium.launch(launchOptions)

// --------------------------------------------------------------------------------------- setup
const owner = await signup('areas')
const ownerToken = owner.tokens.accessToken
const rice = await createProduct(ownerToken, owner.unique, 'Rice')
await api(`/api/products/${rice.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 10 } })
const branchName = (await api('/api/branches', { token: ownerToken })).json.branches[0].name

const session = await login(owner.user.clientIdentifier, owner.email)
const context = await contextFor(session)
const page = await context.newPage()
const dialog = page.getByRole('dialog')

// ------------------------------------------------------------------------------------------ 1
await check('the owner adds Kitchen, Bar and Housekeeping in one sheet; everything stays in the Store', async () => {
  await page.goto(`${UI}/app/company/branches`)
  await page.getByRole('heading', { name: 'Branches', level: 1 }).waitFor()
  // The Store is there before anything is added, holding everything (owner, 2026-10-30).
  await page.locator('[data-area="Store"]').getByText('where all your stock is now').waitFor()
  await page.screenshot({ path: SHOTS + '1-branches-store-only.png' })
  await page.getByRole('button', { name: 'Add areas' }).click()

  // A task flow is a Sheet (DESIGN.md), the branch still in view beside it.
  await dialog.getByRole('heading', { name: `Add areas to ${branchName}` }).waitFor()
  await dialog.getByText(/Your stock is in the Store\./).waitFor()
  for (const name of ['Kitchen', 'Bar', 'Housekeeping']) await dialog.getByRole('button', { name, exact: true }).click()
  await dialog.getByRole('radiogroup', { name: 'What Housekeeping does with stock' }).getByRole('radio', { name: "Uses what it's given" }).click()
  // The two kinds are explained once, not under every row (owner's comment).
  assert((await dialog.getByText('has its own figure').count()) === 1, 'the explanation is repeated')
  await dialog.screenshot({ path: SHOTS + '2-add-areas-sheet.png' })
  await dialog.getByRole('button', { name: 'Add 3 areas' }).click()
  await page.getByRole('status').filter({ hasText: `${branchName} now has 4 areas. Everything you have is in the Store.` }).waitFor()

  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  await areas.locator('[data-area="Housekeeping"]').getByText("Uses what it's given").waitFor()
  // Where deliveries arrive is a setting of its own, by the heading - said once (owner's comment).
  const deliveries = areas.getByLabel('Deliveries arrive in')
  assert((await deliveries.locator('option:checked').innerText()) === 'Store', 'deliveries do not arrive in the Store')
  assert((await areas.getByText('deliveries arrive here').count()) === 0, 'the delivery area is also noted on its row')
  await page.screenshot({ path: SHOTS + '3-branches-with-areas.png' })
  const at = await areaFigures(ownerToken, rice.id)
  assert(at.Store === 10 && at.Kitchen === 0 && at.Bar === 0, `figures ${JSON.stringify(at)}`)
  assert(!('Housekeeping' in at), 'a used area carries a figure')
})

// ------------------------------------------------------------------------------------------ 2
await check('the product page and Inventory say where it is, zeros left out', async () => {
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  const line = page.locator('[data-area-breakdown]').first()
  await waitFor(async () => /Store\s*10/.test((await line.innerText().catch(() => '')) ?? ''), 'the area line to read Store 10')
  const text = await line.innerText()
  assert(!/Kitchen|Bar/.test(text), `an empty area is shown: "${text}"`)
})

// ------------------------------------------------------------------------------------------ 3
await check('a stock-in sheet asks which area, and records into the Kitchen', async () => {
  await page.getByRole('button', { name: 'Stock in' }).first().click()
  await dialog.waitFor()
  await dialog.getByText('Which area?').waitFor()
  assert(
    (await dialog.getByRole('radio', { name: 'Store' }).getAttribute('aria-checked')) === 'true',
    'the sheet does not start at the delivery area',
  )
  await dialog.getByRole('radio', { name: 'Kitchen' }).click()
  await dialog.getByRole('heading', { name: /Stock in · Kitchen/ }).waitFor()
  await dialog.getByLabel('Quantity').fill('3')
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === 3, 'the Kitchen to hold 3')
  const at = await areaFigures(ownerToken, rice.id)
  assert(at.Store === 10, `the Store holds ${at.Store}, expected 10`)
  await waitFor(async () => /Kitchen\s*3/.test(await page.locator('[data-area-breakdown]').first().innerText()), 'the line to show Kitchen 3')

  await page.goto(`${UI}/app/products`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  const row = page.locator(`[data-product-row="${rice.id}"]`).locator('visible=true').first()
  await waitFor(async () => /Store 10 · Kitchen 3/.test(await row.innerText().catch(() => '')), 'the Inventory row to read Store 10 · Kitchen 3')
})

// ------------------------------------------------------------------------------------------ 4
await check('a stock-out from the Kitchen is judged against the Kitchen, and the sheet remembers it', async () => {
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Stock out' }).first().click()
  await dialog.waitFor()
  assert(
    (await dialog.getByRole('radio', { name: 'Kitchen' }).getAttribute('aria-checked')) === 'true',
    'the sheet did not remember the Kitchen',
  )
  await dialog.getByText(/In the Kitchen: 3/).waitFor()
  await dialog.getByLabel('Quantity').fill('5')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByText('Not enough in stock').waitFor()
  await dialog.getByText(/Only 3/).waitFor()
  await dialog.getByLabel('Quantity').fill('2')
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === 1, 'the Kitchen to hold 1')
  const at = await areaFigures(ownerToken, rice.id)
  assert(at.Store === 10, `the Store holds ${at.Store}, expected 10`)
})

// ------------------------------------------------------------------------------------------ 5
await check('the empty Bar closes and reopens from its menu; the Store, where deliveries arrive, offers no Close', async () => {
  await page.goto(`${UI}/app/company/branches`)
  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  // Deliveries move from the setting, and back.
  const deliveries = areas.getByLabel('Deliveries arrive in')
  await deliveries.selectOption({ label: 'Bar' })
  await waitFor(async () => (await api('/api/branches', { token: ownerToken })).json.branches[0].areas.find((a) => a.delivery)?.name === 'Bar', 'deliveries to arrive in the Bar')
  await deliveries.selectOption({ label: 'Store' })
  await waitFor(async () => (await api('/api/branches', { token: ownerToken })).json.branches[0].areas.find((a) => a.delivery)?.name === 'Store', 'deliveries to arrive in the Store again')
  const bar = areas.locator('[data-area="Bar"]')
  await bar.getByRole('button', { name: 'Change Bar' }).click()
  await page.screenshot({ path: SHOTS + '4-area-menu.png' })
  await page.getByRole('menuitem', { name: 'Close' }).click()
  await bar.getByText('Closed').waitFor()
  await bar.getByRole('button', { name: 'Change Bar' }).click()
  await page.getByRole('menuitem', { name: 'Reopen' }).click()
  await bar.getByText('0 products').waitFor()
  await areas.locator('[data-area="Store"]').getByRole('button', { name: 'Change Store' }).click()
  assert((await page.getByRole('menuitem', { name: 'Close' }).count()) === 0, 'the Store offers Close')
  await page.keyboard.press('Escape')
  // The Kitchen holds 1: the server refuses, in its own words.
  const kitchen = areas.locator('[data-area="Kitchen"]')
  await kitchen.getByRole('button', { name: 'Change Kitchen' }).click()
  await page.getByRole('menuitem', { name: 'Close' }).click()
  await kitchen.getByRole('alert').getByText('Kitchen still has 1 item.').waitFor()
})

// ------------------------------------------------------------------------------------------ 6
await check('a company without areas sees no area word on its sheets or product page, and renames its Store', async () => {
  const shop = await signup('noareas')
  const beans = await createProduct(shop.tokens.accessToken, shop.unique, 'Beans')
  await api(`/api/products/${beans.id}/stock/stock-in`, { token: shop.tokens.accessToken, method: 'POST', body: { quantity: 4 } })
  const shopSession = await login(shop.user.clientIdentifier, shop.email)
  const shopContext = await contextFor(shopSession)
  const shopPage = await shopContext.newPage()
  await shopPage.goto(`${UI}/app/products/${beans.id}`)
  await shopPage.getByRole('heading', { name: 'Beans', level: 1 }).waitFor()
  await shopPage.getByRole('button', { name: 'Stock out' }).first().click()
  await shopPage.getByRole('dialog').getByLabel('Quantity').waitFor()
  assert((await shopPage.getByText('Which area?').count()) === 0, 'a sheet asks which area')
  assert((await shopPage.locator('[data-area-breakdown]').count()) === 0, 'an area line on the product page')
  await shopPage.keyboard.press('Escape')
  await shopPage.goto(`${UI}/app/company/branches`)
  const store = shopPage.locator('[data-area="Store"]')
  await store.getByRole('button', { name: 'Change Store' }).click()
  await shopPage.getByRole('menuitem', { name: 'Rename' }).click()
  await shopPage.getByLabel('Area name').fill('Shop floor')
  await shopPage.getByRole('button', { name: 'Save' }).click()
  await shopPage.locator('[data-area="Shop floor"]').getByText('where all your stock is now').waitFor()
  await shopContext.close()
})

// ------------------------------------------------------------------------------------------ 7
await check('axe: Branches with areas and the add-areas steps have no WCAG 2.2 A/AA violations (phone)', async () => {
  const phone = await contextFor(await login(owner.user.clientIdentifier, owner.email), { width: 390, height: 844 })
  const phonePage = await phone.newPage()
  const found = []
  await phonePage.goto(`${UI}/app/company/branches`)
  await phonePage.getByRole('region', { name: `Areas at ${branchName}` }).waitFor()
  found.push(...(await axe(phonePage)).map((v) => `Branches: ${v}`))
  await phonePage.screenshot({ path: SHOTS + '5-phone-branches.png', fullPage: true })
  await phonePage.getByRole('button', { name: 'Add an area' }).click()
  const sheet = phonePage.getByRole('dialog')
  await sheet.getByRole('heading', { name: `Add areas to ${branchName}` }).waitFor()
  await sheet.getByRole('button', { name: 'Front desk', exact: true }).click()
  await sheet.getByRole('radiogroup', { name: 'What Front desk does with stock' }).waitFor()
  await phonePage.waitForTimeout(300)
  await phonePage.screenshot({ path: SHOTS + '6-phone-add-sheet.png' })
  found.push(...(await axe(phonePage)).map((v) => `Add sheet: ${v}`))
  assert(found.length === 0, found.join('\n    '))
  await phone.close()
})

await context.close()
await browser.close()
const failed = results.filter(([status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
