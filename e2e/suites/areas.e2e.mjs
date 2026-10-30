// End-to-end checks for areas inside a branch, Part 1 (STOCK_AREAS_PART_1.md), against the production
// preview (4173) and the real API (8081).
//   1. The owner adds Kitchen, Bar and Housekeeping (uses what it's given) from Branches; the steps say
//      what they should, and everything the branch held stays in the Store.
//   2. The product page and Inventory show "Store 10 · ...", zeros left out.
//   3. A stock-in sheet asks which area, and records into the Kitchen.
//   4. A stock-out from the Kitchen is judged against the Kitchen: asking for more than it has is refused.
//   5. The Bar closes (empty), and the Store, where deliveries arrive, can't.
//   6. A company without areas sees no area word on its sheets or its product page (rule 1).
//   7. axe on Branches with areas, and on the add-areas steps (phone).
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
await check('the owner adds Kitchen, Bar and Housekeeping; everything stays in the Store', async () => {
  await page.goto(`${UI}/app/company/branches`)
  await page.getByRole('heading', { name: 'Branches', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Add areas' }).click()
  await page.getByRole('heading', { name: 'What do you call the place your stock is kept now?' }).waitFor()
  assert((await page.getByLabel('Area name').inputValue()) === 'Store', 'the current area is not pre-filled "Store"')
  await page.getByText('All your current stock stays here.').waitFor()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('heading', { name: 'Add the other areas.' }).waitFor()
  for (const name of ['Kitchen', 'Bar', 'Housekeeping']) await page.getByRole('button', { name: `+ ${name}` }).click()
  await page.getByRole('list', { name: 'Areas to add' }).getByText('Housekeeping').waitFor()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('heading', { name: 'Does each area keep stock you want to count?' }).waitFor()
  await page.getByRole('group', { name: 'Housekeeping' }).getByLabel('No, what goes there is used').check()
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByRole('heading', { name: 'Where do deliveries arrive?' }).waitFor()
  assert(await page.getByLabel('Store').isChecked(), 'the Store is not where deliveries arrive by default')
  await page.getByRole('button', { name: 'Add 3 areas' }).click()
  await page.getByRole('heading', { name: `${branchName} now has 4 areas.` }).waitFor()
  await page.getByText('Everything you have is in the Store.').waitFor()
  await page.getByRole('button', { name: 'Done' }).click()

  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  await areas.waitFor()
  await areas.locator('[data-area="Housekeeping"]').getByText("Uses what it's given").waitFor()
  await areas.locator('[data-area="Store"]').getByText('Deliveries arrive here').waitFor()
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
await check('the empty Bar closes and reopens; the Store, where deliveries arrive, offers no Close', async () => {
  await page.goto(`${UI}/app/company/branches`)
  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  const bar = areas.locator('[data-area="Bar"]')
  await bar.getByRole('button', { name: 'Close' }).click()
  await bar.getByText('Closed').waitFor()
  await bar.getByRole('button', { name: 'Reopen' }).click()
  await bar.getByRole('button', { name: 'Close' }).waitFor()
  assert((await areas.locator('[data-area="Store"]').getByRole('button', { name: 'Close' }).count()) === 0, 'the Store offers Close')
  // The Kitchen holds 1: the server refuses, in its own words.
  await areas.locator('[data-area="Kitchen"]').getByRole('button', { name: 'Close' }).click()
  await areas.locator('[data-area="Kitchen"]').getByRole('alert').getByText('Kitchen still has 1 item.').waitFor()
})

// ------------------------------------------------------------------------------------------ 6
await check('a company without areas sees no area word on its sheets or product page', async () => {
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
  await phonePage.getByRole('button', { name: 'Add an area' }).click()
  await phonePage.getByRole('heading', { name: `Add an area to ${branchName}.` }).waitFor()
  found.push(...(await axe(phonePage)).map((v) => `Add: ${v}`))
  await phonePage.getByRole('button', { name: '+ Front desk' }).click()
  await phonePage.getByRole('button', { name: 'Next' }).click()
  await phonePage.getByRole('heading', { name: 'Does the Front desk keep stock you want to count?' }).waitFor()
  found.push(...(await axe(phonePage)).map((v) => `Kind: ${v}`))
  assert(found.length === 0, found.join('\n    '))
  await phone.close()
})

await context.close()
await browser.close()
const failed = results.filter(([status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
