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
//  5b. Move stock: before → after, the route kept and last time’s items, a give to Housekeeping and Undo, too much, offline,
//      and the Moves list in Stock movements (STOCK_AREAS_PART_2.md).
//   7. axe on Branches with areas, and on the Add areas sheet (phone).
import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { API, UI, launchOptions, psqlCommand, shotsPrefix } from '../config.mjs'
import { createECDH, randomBytes, randomUUID } from 'node:crypto'

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

/** Records the sheet in `name`, changed on the line under its title (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 1). */
async function sheetArea(sheet, name) {
  const chooser = sheet.getByRole('button', { name: /^Recording in the .+\. Change area$/ })
  if ((await chooser.getAttribute('aria-label')) === `Recording in the ${name}. Change area`) return
  await chooser.click()
  await sheet.getByRole('menuitemradio', { name }).click()
  await sheet.getByRole('button', { name: `Recording in the ${name}. Change area` }).waitFor()
}

async function createProduct(token, unique, name, extra = { unitOfMeasure: 'PIECE' }) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `AR-${name.slice(0, 4)}-${unique}`, ...extra })], { type: 'application/json' }))
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

/** The name chosen in a select. */
async function chosenIn(page, selector) {
  return page.locator(selector).evaluate((select) => select.options[select.selectedIndex]?.text ?? '')
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
  // Each area is a card, and the cards are what gets added (owner, 2026-11-01): the first pick fills the empty card.
  const card = (name) => dialog.locator(`[data-area-card="${name}"]`)
  const answers = (name) => card(name).locator('[data-area-answers]')
  assert((await dialog.locator('[data-area-card]').count()) === 3, `${await dialog.locator('[data-area-card]').count()} cards for 3 picks`)
  // Its two answers in a line each, words that say it alone; the picks start sensibly.
  await answers('Kitchen').getByText('Stock is used here, bit by bit').waitFor()
  await answers('Kitchen').getByText('It arrives straight away').waitFor()
  await answers('Housekeeping').getByText('Stock is used up as soon as it arrives').waitFor()
  // A typed one, on a card of its own.
  await dialog.getByRole('button', { name: 'Another area' }).click()
  await dialog.locator('[data-area-card=""]').getByLabel('Area name').fill('Pantry')
  await answers('Pantry').getByText('Stock is stored here').waitFor()
  // The Bar's people confirm what reaches them: Change opens the Bar's card in place - the questions Edit asks.
  await card('Bar').getByRole('button', { name: 'Change what happens at Bar' }).click()
  await card('Bar').getByRole('group', { name: 'When stock is moved here' }).getByLabel(/^Someone here confirms it/).check()
  await card('Bar').getByText('It waits until someone in the Bar says they got it.').waitFor()
  await dialog.screenshot({ path: SHOTS + '2a-add-areas-change.png' })
  await card('Bar').getByRole('button', { name: 'Done' }).click()
  await answers('Bar').getByText('Someone here confirms it').waitFor()
  // Not wanted after all.
  await card('Pantry').getByRole('button', { name: 'Remove Pantry' }).click()
  await dialog.screenshot({ path: SHOTS + '2-add-areas-sheet.png' })
  await dialog.getByRole('button', { name: 'Add 3 areas' }).click()
  await page.getByRole('status').filter({ hasText: `${branchName} now has 4 areas. Everything you have is in the Store.` }).waitFor()

  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  // Each row says the area in words: what happens there (owner, 2026-10-31).
  await areas.locator('[data-area="Housekeeping"]').getByText('used up as soon as it arrives').waitFor()
  await areas.locator('[data-area="Kitchen"]').getByText('stock is used here bit by bit').waitFor()
  await areas.locator('[data-area="Store"]').getByText('stock is stored here').waitFor()
  const bar = (await api('/api/branches', { token: ownerToken })).json.branches[0].areas.find((area) => area.name === 'Bar')
  assert(bar.confirms === true, 'the Bar was added without confirming what reaches it')
  // Back as it was for the checks that follow: moves to the Bar arrive straight away.
  await api(`/api/areas/${bar.id}`, { token: ownerToken, method: 'PATCH', body: { confirms: false } })
  // Where deliveries arrive is the branch's default, set by the areas on this page.
  assert((await areas.getByLabel('Deliveries arrive in').locator('option:checked').innerText()) === 'Store', 'deliveries do not arrive in the Store')
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
  // What and where on the sheet itself (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 1): the product in the title,
  // the area on the line under it - starting where deliveries arrive, changed right there.
  await dialog.getByRole('heading', { name: 'Stock in · Rice' }).waitFor()
  await dialog.getByRole('button', { name: 'Recording in the Store. Change area' }).click()
  await dialog.getByRole('menuitemradio', { name: 'Kitchen' }).click()
  await dialog.getByRole('button', { name: 'Recording in the Kitchen. Change area' }).waitFor()
  await dialog.locator('[data-sheet-place]').getByText(/here/).waitFor()
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
  await dialog.getByRole('button', { name: 'Recording in the Kitchen. Change area' }).waitFor()
  await dialog.locator('[data-sheet-place]').getByText(/^3 pieces here/).waitFor()
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
await check('deliveries move from their setting; the empty Bar closes and reopens from its Edit; the Store offers no Close', async () => {
  await page.goto(`${UI}/app/company/branches`)
  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  // Where deliveries arrive: the branch's default, set by the areas, and back.
  const deliveries = areas.getByLabel('Deliveries arrive in')
  const deliveryArea = async () => (await api('/api/branches', { token: ownerToken })).json.branches[0].areas.find((a) => a.delivery)?.name
  await deliveries.selectOption({ label: 'Bar' })
  await waitFor(async () => (await deliveryArea()) === 'Bar', 'deliveries to arrive in the Bar')
  await deliveries.selectOption({ label: 'Store' })
  await waitFor(async () => (await deliveryArea()) === 'Store', 'deliveries to arrive in the Store again')

  // One way to change an area: tap its row, and everything about it is in one Edit panel.
  const edit = page.getByRole('dialog', { name: 'Edit Bar' })
  await areas.getByRole('button', { name: 'Edit Bar' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: SHOTS + '4-area-edit.png' })
  await edit.getByRole('button', { name: 'Close Bar' }).click()
  await edit.waitFor({ state: 'hidden' })
  await areas.locator('[data-area="Bar"]').getByText('Closed').waitFor()
  await areas.getByRole('button', { name: 'Edit Bar' }).click()
  await edit.getByRole('button', { name: 'Reopen Bar' }).click()
  await edit.waitFor({ state: 'hidden' })
  await areas.locator('[data-area="Bar"]').getByText('0 products').waitFor()
  await areas.getByRole('button', { name: 'Edit Store' }).click()
  const store = page.getByRole('dialog', { name: 'Edit Store' })
  await store.getByLabel('Name').waitFor()
  assert((await store.getByRole('button', { name: /^Close Store/ }).count()) === 0, 'the Store offers Close')
  await page.keyboard.press('Escape')
  // The Kitchen holds 1: the server refuses, in its own words, in the panel.
  await areas.getByRole('button', { name: 'Edit Kitchen' }).click()
  const kitchen = page.getByRole('dialog', { name: 'Edit Kitchen' })
  await kitchen.getByRole('button', { name: 'Close Kitchen' }).click()
  await kitchen.getByRole('alert').getByText('Kitchen still has 1 item.').waitFor()
  await page.keyboard.press('Escape')
})

// ----------------------------------------------------------------------------------------- 5b
/** The Move panel: a Sheet, like Stock in and Stock out. */
const moveSheet = page.getByRole('dialog', { name: /Move stock/ })

await check('Move stock opens in a panel like the other actions: before → after, then the route kept and last time’s items', async () => {
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await moveSheet.waitFor()
  assert((await chosenIn(page, '#move-from')) === 'Store', 'does not start from the Store')
  await page.locator('#move-to').selectOption({ label: 'Kitchen' })
  await page.getByLabel('How many Rice').fill('4')
  const line = page.locator('[data-before-after]').first()
  await waitFor(async () => /Store\s+10 → 6\b[\s\S]*Kitchen\s+1 → 5\b/.test(await line.innerText()), 'the line to read Store 10 → 6, Kitchen 1 → 5')
  await page.screenshot({ path: SHOTS + '7-move-stock.png' })
  await moveSheet.getByRole('button', { name: 'Move 1 item to Kitchen' }).click()
  // Done like every other write: the panel closes, and a toast says what happened, with Undo.
  await moveSheet.waitFor({ state: 'hidden' })
  await page.getByText('Moved · 1 item · Store → Kitchen').waitFor()
  let at = await areaFigures(ownerToken, rice.id)
  assert(at.Store === 6 && at.Kitchen === 5, `figures ${JSON.stringify(at)}`)

  // Opened again from Inventory, with nothing chosen: the route stays Store → Kitchen, and last time's
  // items are one tap away.
  await page.goto(`${UI}/app/products`)
  await page.getByRole('button', { name: 'Move stock' }).click()
  await moveSheet.waitFor()
  await waitFor(async () => (await chosenIn(page, '#move-to')) === 'Kitchen', 'the route to be kept')
  await page.getByRole('button', { name: 'Add all' }).click()
  await waitFor(async () => (await page.getByLabel('How many Rice').inputValue().catch(() => '')) === '4', 'the last move to be repeated')
})

await check("a give to Housekeeping is recorded as used there, and the toast's Undo puts it back", async () => {
  await page.locator('#move-to').selectOption({ label: 'Housekeeping (uses it)' })
  await page.getByText('Housekeeping uses stock up as soon as it arrives').waitFor()
  await page.getByLabel('How many Rice').fill('1')
  await moveSheet.getByRole('button', { name: 'Give 1 item to Housekeeping' }).click()
  await page.getByText('Given · 1 item · Store → Housekeeping').waitFor()
  let at = await areaFigures(ownerToken, rice.id)
  assert(at.Store === 5, `the Store holds ${at.Store}, expected 5`)
  await page.getByRole('button', { name: 'Undo' }).last().click()
  await page.getByText('Undone · back in the Store').waitFor()
  at = await areaFigures(ownerToken, rice.id)
  assert(at.Store === 6, `the Store holds ${at.Store} after Undo, expected 6`)
})

await check('more than the Store has turns the line red and holds the button', async () => {
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await moveSheet.waitFor()
  await page.locator('#move-to').selectOption({ label: 'Kitchen' })
  await page.getByLabel('How many Rice').fill('99')
  await page.getByText('The Store has 6').waitFor()
  assert(await moveSheet.getByRole('button', { name: 'Move 1 item to Kitchen' }).isDisabled(), 'the button is not held')
  await page.getByRole('button', { name: 'Take Rice off' }).click()
  await page.keyboard.press('Escape')
  await moveSheet.waitFor({ state: 'hidden' })
})

await check('moving in bags shows what is left in bags and in kg', async () => {
  const flour = await createProduct(ownerToken, owner.unique, 'Flour', { unitOfMeasure: 'KG', packagingUnit: 'BAG', packagingSize: 50 })
  await api(`/api/products/${flour.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 180 } })
  await page.goto(`${UI}/app/products/${flour.id}`)
  await page.getByRole('heading', { name: 'Flour', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await moveSheet.waitFor()
  await page.locator('#move-to').selectOption({ label: 'Kitchen' })
  await page.getByLabel('Unit for Flour').selectOption({ label: 'bag' })
  await page.getByLabel('How many Flour').fill('2')
  const line = page.locator('[data-move-line]', { hasText: 'Flour' }).locator('[data-before-after]')
  await waitFor(
    async () => /3 bags \+ 30 kg → 1 bag \+ 30 kg · 180 → 80 kg[\s\S]*Kitchen\s+0 → 2 bags · 0 → 100 kg/.test(await line.innerText()),
    'the bag line to read 3 bags + 30 kg → 1 bag + 30 kg · 180 → 80 kg, Kitchen 0 → 2 bags',
  )
  await page.screenshot({ path: SHOTS + '7b-move-in-bags.png' })
  await page.getByRole('button', { name: 'Take Flour off' }).click()
  await page.keyboard.press('Escape')
  await moveSheet.waitFor({ state: 'hidden' })
})

await check('offline, a move is kept on the phone and goes once back online', async () => {
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await moveSheet.waitFor()
  await page.locator('#move-to').selectOption({ label: 'Kitchen' })
  await page.getByLabel('How many Rice').fill('2')
  await context.setOffline(true)
  await moveSheet.getByRole('button', { name: 'Move 1 item to Kitchen' }).click()
  await page.getByText("Saved on this phone. It goes when you're connected.").waitFor()
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === 7, 'the queued move to arrive (Kitchen 7)')
})

await check('Inventory opens Move stock in a panel, and moves the products selected on it', async () => {
  await page.goto(`${UI}/app/products`)
  await page.getByRole('button', { name: 'Move stock' }).click()
  await moveSheet.waitFor()
  await waitFor(async () => (await page.evaluate(() => document.activeElement?.id)) === 'move-search', 'the search to be ready')
  await page.screenshot({ path: SHOTS + '7c-move-from-inventory.png' })
  await page.keyboard.press('Escape')

  // On a phone, Move sits in the bar along the bottom, and opens as a sheet from the bottom.
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(`${UI}/app/products`)
  await page.getByRole('region', { name: 'Inventory actions' }).getByRole('button', { name: 'Move' }).waitFor()
  await page.screenshot({ path: SHOTS + '7d-phone-inventory-bar.png' })
  await page.getByRole('region', { name: 'Inventory actions' }).getByRole('button', { name: 'Move' }).click()
  await page.locator('[data-usual]').waitFor()
  await page.waitForTimeout(500)
  await page.screenshot({ path: SHOTS + '7e-phone-move-empty.png' })
  await page.getByRole('button', { name: 'Add all' }).click()
  await page.locator('[data-move-line]').first().waitFor()
  await page.screenshot({ path: SHOTS + '7f-phone-move-lines.png' })
  await page.getByRole('button', { name: 'Take Rice off' }).click()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.goto(`${UI}/app/products`)
  await page.locator('tr').filter({ hasText: 'Rice' }).getByRole('checkbox').check()
  await page.locator('tr').filter({ hasText: 'Flour' }).getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Move to an area' }).click()
  await moveSheet.waitFor()
  await page.getByLabel('How many Rice').waitFor()
  await page.getByLabel('How many Flour').waitFor()
  await page.getByRole('button', { name: 'Take Rice off' }).click()
  await page.getByRole('button', { name: 'Take Flour off' }).click()
  await page.keyboard.press('Escape')
})

await check('Stock movements lists the moves, and says the area on each row', async () => {
  await page.goto(`${UI}/app/stock-movements?moves=1`)
  const moves = page.getByRole('list', { name: 'Moves between areas' })
  await moves.waitFor()
  await moves.getByText('undone').waitFor()
  assert((await moves.locator('[data-move-row]').count()) >= 3, 'fewer than three moves listed')
  await page.screenshot({ path: SHOTS + '8-moves-list.png' })
  // …and among every movement, as rows of their own: "Moved", Store → Kitchen.
  await page.goto(`${UI}/app/stock-movements`)
  const moved = page.locator('tbody tr', { hasText: 'Moved' }).filter({ hasText: 'Store → Kitchen' })
  await moved.first().waitFor()
  await page.screenshot({ path: SHOTS + '9-moves-among-movements.png' })
})

// ------------------------------------------------------------------------------------------ 6
await check('quick mode at a branch with areas: Move in the row, Count a link beside the explanation', async () => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(`${UI}/app/quick`)
  const row = page.getByRole('group', { name: 'What are you doing?' })
  await row.getByRole('button', { name: 'Move' }).waitFor()
  assert((await row.getByRole('button', { name: 'Count' }).count()) === 0, 'Count is still in the row')
  await row.getByRole('button', { name: 'Stock out' }).click()
  await page.getByText('To another area, use Move.', { exact: false }).waitFor()
  // Where it lands is in the title, changed there - no "Which area?" row (owner, 2026-10-31).
  assert((await page.getByText('Which area?').count()) === 0, 'quick mode still asks which area')
  const areaTitle = page.getByRole('button', { name: /^Recording in the .+\. Change area$/ })
  await areaTitle.click()
  await page.getByRole('menuitemradio', { name: 'Bar' }).click()
  await page.getByRole('button', { name: 'Recording in the Bar. Change area' }).waitFor()
  await page.screenshot({ path: SHOTS + '13-quick-mode-phone.png' })
  await page.getByRole('button', { name: 'Recording in the Bar. Change area' }).click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: SHOTS + '13b-quick-mode-area-menu.png' })
  await page.getByRole('menuitemradio', { name: 'Kitchen' }).click()
  // …and on a laptop: the menu under the name.
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('button', { name: 'Recording in the Kitchen. Change area' }).click()
  await page.waitForTimeout(200)
  await page.screenshot({ path: SHOTS + '13c-quick-mode-area-menu-laptop.png' })
  // Escape closes the menu, not quick mode.
  await page.keyboard.press('Escape')
  await page.getByRole('menu', { name: 'Record in' }).waitFor({ state: 'hidden' })
  await page.getByRole('heading', { name: /Quick mode/ }).waitFor()
  await page.setViewportSize({ width: 360, height: 780 })
  await page.getByRole('button', { name: 'Count stock' }).click()
  await page.getByText("Count what's on the shelf.", { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Done counting' }).click()
  // What's recorded says where it went: "Stock in · 1 piece · Kitchen" (owner, 2026-10-31).
  await row.getByRole('button', { name: 'Stock in' }).click()
  await page.locator('#quick-search').fill('Rice')
  await page.getByRole('button', { name: /^Rice/ }).first().click()
  await page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: '1', exact: true }).click()
  await page.getByRole('button', { name: /^Stock in 1 / }).click()
  await page.getByRole('region', { name: /This session/ }).getByText(/Stock in · 1 piece · Kitchen/).waitFor()
  await page.screenshot({ path: SHOTS + '13d-quick-session-area.png' })
  // Move is a tab like the others: moved, the stamp, and the move in This session with Undo.
  await row.getByRole('button', { name: 'Move' }).click()
  await page.getByRole('button', { name: 'Add all' }).click()
  await page.getByLabel('How many Rice').waitFor()
  await page.screenshot({ path: SHOTS + '14-quick-move-phone.png' })
  await page.getByRole('button', { name: /^Move 1 item to / }).click()
  const session = page.getByRole('region', { name: /This session/ })
  await session.getByText(/Moved · 1 item/).waitFor()
  await page.screenshot({ path: SHOTS + '15-quick-move-done-phone.png' })
  await session.getByRole('button', { name: 'Undo' }).click()
  await session.getByText('Undone').waitFor()
  await page.setViewportSize({ width: 1280, height: 900 })
  // Picking an area in quick mode made it where the owner is (Part 3.6): back to All areas for what follows.
  await page.getByRole('button', { name: 'Exit' }).click()
  await page.getByRole('button', { name: /^Area: .+\. Change area$/ }).click()
  await page.getByRole('menuitemradio', { name: 'All areas' }).click()
  await page.getByRole('button', { name: 'Area: All areas. Change area' }).waitFor()
})

// --------------------------------------------------------------- 6b (sheets plan Part 4)
await check("quick mode shows the Kitchen's figure, not the branch's: search, the product line, count and stock out", async () => {
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  const beans = await createProduct(ownerToken, owner.unique, 'Cowpea')
  await api(`/api/products/${beans.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 30, areaId: areaIds.Store } })
  await api(`/api/products/${beans.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 12, areaId: areaIds.Kitchen } })
  const never = await createProduct(ownerToken, owner.unique, 'Yam flour')
  await api(`/api/products/${never.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 5, areaId: areaIds.Store } })
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(`${UI}/app/quick?mode=out`)
  const areaTitle = page.getByRole('button', { name: /^Recording in the .+\. Change area$/ })
  if ((await areaTitle.getAttribute('aria-label')) !== 'Recording in the Kitchen. Change area') {
    await areaTitle.click()
    await page.getByRole('menuitemradio', { name: 'Kitchen' }).click()
  }
  await page.locator('#quick-search').fill('Yam flour')
  await page.getByRole('button', { name: /^Yam flour/ }).getByText('Not in Kitchen').waitFor()
  await page.locator('#quick-search').fill('Cowpea')
  const row = page.getByRole('button', { name: /^Cowpea AR-/ })
  await waitFor(async () => /12\s*pieces/.test(await row.innerText().catch(() => '')), "the search row to read the Kitchen's 12")
  await page.screenshot({ path: SHOTS + '13e-quick-kitchen-figures.png' })
  await row.click()
  await page.getByText('In the Kitchen: 12 pieces').waitFor()
  const keypad = page.getByRole('group', { name: 'Keypad' })
  for (const key of ['1', '5']) await keypad.getByRole('button', { name: key, exact: true }).click()
  await page.getByRole('button', { name: /^Stock out 15 / }).click()
  await page.getByRole('alert').getByText('The Kitchen has 12 pieces.').waitFor()
  await page.screenshot({ path: SHOTS + '13f-quick-more-than-the-kitchen.png' })
  await page.getByRole('button', { name: 'Change', exact: true }).click()
  await page.getByRole('button', { name: 'Count stock' }).click()
  await page.locator('#quick-search').fill('Cowpea')
  await page.getByRole('button', { name: /^Cowpea AR-/ }).click()
  for (const key of ['1', '0']) await keypad.getByRole('button', { name: key, exact: true }).click()
  // The difference is against the Kitchen's 12, not the branch's 42.
  await page.locator('[data-stock-figure]').getByText('−2').waitFor()
  await page.getByRole('button', { name: 'Done counting' }).click()
  await page.setViewportSize({ width: 1280, height: 900 })
  // Out of the way of the checks below, which count this company's products.
  for (const id of [beans.id, never.id]) await api(`/api/products/${id}`, { token: ownerToken, method: 'DELETE' })
})

// --------------------------------------------------------------- 6c (sheets plan Part 5)
await check("the closing count lists what the Kitchen has: the eggs nobody knew about are counted to 0", async () => {
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  const eggs = await createProduct(ownerToken, owner.unique, 'Eggs')
  await api(`/api/products/${eggs.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 30, areaId: areaIds.Store } })
  await api('/api/area-moves', {
    token: ownerToken,
    method: 'POST',
    body: { id: randomUUID(), fromAreaId: areaIds.Store, toAreaId: areaIds.Kitchen, lines: [{ productId: eggs.id, quantity: 30 }] },
  })
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(`${UI}/app/quick?mode=count`)
  const areaTitle = page.getByRole('button', { name: /^Recording in the .+\. Change area$/ })
  if ((await areaTitle.getAttribute('aria-label')) !== 'Recording in the Kitchen. Change area') {
    await areaTitle.click()
    await page.getByRole('menuitemradio', { name: 'Kitchen' }).click()
  }
  const toCount = page.getByRole('region', { name: /^To count in the Kitchen/ })
  const eggsRow = toCount.locator('[data-count-row="Eggs"]')
  // What the app says is faint in the box, not filled in; the phone's number keypad opens on it.
  const box = eggsRow.getByLabel('Eggs: pieces here')
  await waitFor(async () => (await box.getAttribute('placeholder').catch(() => null)) === '30', 'Eggs 30 on the list before anything is typed')
  assert((await box.getAttribute('inputmode')) === 'decimal', 'the box asks for the number keypad')
  assert((await page.locator('#quick-search').getAttribute('inputmode')) == null, 'the search box asks for the number keypad')
  await page.screenshot({ path: SHOTS + '13g-count-list.png' })
  await box.fill('0')
  await page.screenshot({ path: SHOTS + '13g2-counting-on-the-row.png' })
  await box.press('Enter')
  const counted = page.getByRole('region', { name: /^Counted today/ })
  await counted.getByText('Eggs').waitFor()
  await counted.getByText(/0 pieces · 30 used/).waitFor()
  assert((await toCount.locator('[data-count-row="Eggs"]').count()) === 0, 'Eggs is still to count')
  await page.screenshot({ path: SHOTS + '13h-counted-today.png' })
  await waitFor(async () => (await areaFigures(ownerToken, eggs.id)).Kitchen === 0, 'the Kitchen to have no eggs')
  await page.setViewportSize({ width: 1280, height: 900 })
  await api(`/api/products/${eggs.id}`, { token: ownerToken, method: 'DELETE' })
})

// ------------------------------------------------------------------------------------- 5c (Part 3)
await check('a route used a few times offers its usual items, most often first, each one tap', async () => {
  const flourId = (await api(`/api/products?search=Flour`, { token: ownerToken })).json.content?.find?.((p) => p.name === 'Flour')?.id
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  await api(`/api/products/${rice.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 20, areaId: areaIds.Store } })
  // Three moves Store → Bar: rice every time, flour twice, nothing else more than once.
  const lines = [[rice.id, flourId], [rice.id, flourId], [rice.id]]
  for (const [index, ids] of lines.entries()) {
    const sent = await api('/api/area-moves', {
      token: ownerToken,
      method: 'POST',
      body: { id: randomUUID(), fromAreaId: areaIds.Store, toAreaId: areaIds.Bar, lines: ids.map((productId) => ({ productId, quantity: index + 1 })) },
    })
    assert(sent.status === 201, `move ${index}: ${sent.status} ${JSON.stringify(sent.json)}`)
  }
  await page.goto(`${UI}/app/products`)
  await page.getByRole('button', { name: 'Move stock' }).click()
  await moveSheet.waitFor()
  await page.locator('#move-to').selectOption({ label: 'Bar' })
  const usual = page.getByRole('region', { name: 'Usual to Bar' })
  await usual.waitFor()
  const chips = await usual.getByRole('button', { name: /^Add (?!all)/ }).allInnerTexts()
  assert(chips.length === 2 && /Rice/.test(chips[0]) && /Flour/.test(chips[1]), `usual: ${JSON.stringify(chips)}`)
  // The amount it went at last time: rice 3 (the newest move), flour 2.
  assert(/3/.test(chips[0]) && /2/.test(chips[1]), `amounts: ${JSON.stringify(chips)}`)
  await page.waitForTimeout(500)
  await page.screenshot({ path: SHOTS + '16-usual-items.png' })
  // Searching folds the usual items into their header, which says how many and opens them again.
  const header = usual.getByRole('button', { name: /^Usual to Bar/ })
  await page.locator('#move-search').fill('Ri')
  await waitFor(async () => (await header.getAttribute('aria-expanded')) === 'false', 'the usual items to fold away')
  assert(/· 2/.test(await header.innerText()), `folded header: ${await header.innerText()}`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: SHOTS + '16b-usual-folded.png' })
  await page.locator('#move-search').fill('')
  await header.click()
  await waitFor(async () => (await header.getAttribute('aria-expanded')) === 'true', 'the usual items to open again')
  await usual.getByRole('button', { name: /^Add Flour/ }).click()
  await waitFor(async () => (await page.getByLabel('How many Flour').inputValue().catch(() => '')) === '2', 'flour to be added at 2')
  assert((await usual.getByRole('button', { name: /^Add (?!all)/ }).count()) === 1, 'flour is still offered')
  await page.getByRole('button', { name: 'Take Flour off' }).click()
  await page.keyboard.press('Escape')
  await moveSheet.waitFor({ state: 'hidden' })
})

await check('the owner places a cook in the Kitchen; the cook records there without being asked, and sees only the Kitchen', async () => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${UI}/app/users`)
  await page.getByRole('button', { name: 'Add user' }).first().click()
  const sheet = page.getByRole('dialog')
  const cookName = `cook-${owner.unique}`
  await sheet.getByLabel('Username').fill(cookName)
  await sheet.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await sheet.getByLabel('Confirm password').fill(PASSWORD)
  await sheet.getByRole('radiogroup', { name: 'Role' }).getByRole('radio', { name: /^Storekeeper/ }).click()
  await sheet.getByRole('radiogroup', { name: 'Areas' }).getByRole('radio', { name: 'Only some' }).click()
  await sheet.getByLabel('Kitchen').check()
  await page.screenshot({ path: SHOTS + '10-works-in-areas.png' })
  await sheet.getByRole('button', { name: 'Add user' }).click()
  await sheet.waitFor({ state: 'hidden' })

  const cookContext = await contextFor(await login(owner.user.clientIdentifier, cookName))
  const cookPage = await cookContext.newPage()
  await cookPage.goto(`${UI}/app/products/${rice.id}`)
  await cookPage.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await cookPage.locator('[data-area-chip]').getByText('Kitchen').waitFor()
  const areaLine = cookPage.locator('[data-area-breakdown]').first()
  await waitFor(async () => /^Kitchen/.test(await areaLine.innerText().catch(() => '')), 'the area line to start at the Kitchen')
  assert(!/Store|Bar/.test(await areaLine.innerText()), `the cook sees other areas: ${await areaLine.innerText()}`)

  const before = (await areaFigures(ownerToken, rice.id)).Kitchen
  await cookPage.getByRole('button', { name: 'Stock out' }).first().click()
  const cookSheet = cookPage.getByRole('dialog')
  await cookSheet.locator('[data-sheet-place]').getByText('Kitchen').waitFor()
  assert((await cookSheet.getByRole('button', { name: /Change area/ }).count()) === 0, 'the cook is asked which area')
  await cookSheet.getByLabel('Quantity').fill('1')
  await cookSheet.getByRole('button', { name: 'Confirm' }).click()
  await cookSheet.getByRole('button', { name: 'Done' }).click()
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === before - 1, 'the Kitchen to hold one fewer')
  await cookPage.screenshot({ path: SHOTS + '11-cook-product.png' })

  // Move stock: from the Kitchen, the only area they take from - and asking is one quiet link away (Part 5).
  await cookPage.goto(`${UI}/app/move`)
  const from = cookPage.locator('output#move-from')
  await from.waitFor()
  assert((await from.innerText()) === 'Kitchen', `Move starts from ${await from.innerText()}`)
  await cookPage.getByRole('button', { name: 'Ask for it instead' }).waitFor()
  await cookContext.close()
})

await check('a barman in the Bar and the Kitchen chooses where this phone is, and the sheets follow it', async () => {
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  const role = (await api('/api/roles', { token: ownerToken })).json.find((r) => r.name === 'STOREKEEPER')
  const barName = `barman-${owner.unique}`
  await api('/api/users', { token: ownerToken, method: 'POST', body: { username: barName, password: PASSWORD, roleId: role.id, areaIds: [areaIds.Bar, areaIds.Kitchen] } })
  const barContext = await contextFor(await login(owner.user.clientIdentifier, barName))
  const barPage = await barContext.newPage()
  await barPage.goto(`${UI}/app/products/${rice.id}`)
  await barPage.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  // On "All my areas" (the default, Part 3.6), a panel asks which of his areas.
  await barPage.getByRole('button', { name: 'Stock in' }).first().click()
  await barPage.getByRole('dialog').getByRole('button', { name: /^Recording in the (Bar|Kitchen)\. Change area$/ }).waitFor()
  await barPage.keyboard.press('Escape')
  await barPage.getByRole('button', { name: 'Area: All my areas. Change area' }).click()
  await barPage.getByRole('menuitemradio', { name: 'Bar' }).click()
  await barPage.getByRole('button', { name: 'Area: Bar. Change area' }).waitFor()
  await barPage.getByRole('button', { name: 'Stock in' }).first().click()
  const barSheet = barPage.getByRole('dialog')
  // The choice stays, the Bar already picked; another area is one tap, for this record only (owner,
  // 2026-10-31: no going back and forth to the top bar).
  await barSheet.getByRole('button', { name: 'Recording in the Bar. Change area' }).click()
  await barSheet.getByRole('menuitemradio', { name: 'Kitchen' }).click()
  await barSheet.getByRole('button', { name: 'Recording in the Kitchen. Change area' }).waitFor()
  await barPage.keyboard.press('Escape')
  await barPage.getByRole('button', { name: 'Area: Bar. Change area' }).waitFor()
  await barPage.getByRole('button', { name: 'Area: Bar. Change area' }).click()
  await barPage.getByRole('menuitemradio', { name: 'Kitchen' }).click()
  await barPage.getByRole('button', { name: 'Stock in' }).first().click()
  await barSheet.getByRole('button', { name: 'Recording in the Kitchen. Change area' }).waitFor()
  await barPage.waitForTimeout(500)
  await barPage.screenshot({ path: SHOTS + '12-barman-sheet.png' })
  await barPage.keyboard.press('Escape')
  // Quick mode's title is the same setting: changed there, the top bar follows.
  await barPage.goto(`${UI}/app/quick?mode=out`)
  await barPage.getByRole('button', { name: 'Recording in the Kitchen. Change area' }).click()
  await barPage.getByRole('menuitemradio', { name: 'Bar' }).click()
  await barPage.getByRole('button', { name: 'Recording in the Bar. Change area' }).waitFor()
  await barPage.getByRole('button', { name: 'Exit' }).click()
  await barPage.locator('[data-area-chip]').getByText('Bar').waitFor()
  await barContext.close()
})

// ------------------------------------------------------------------------------------- Part 3.6
await check('the top bar is where you are: All my areas sums his areas, one area shows only its own, Out but never Low', async () => {
  const barName = `barman-${owner.unique}`
  const at = await areaFigures(ownerToken, rice.id)
  const barContext = await contextFor(await login(owner.user.clientIdentifier, barName))
  const barPage = await barContext.newPage()
  await barPage.goto(`${UI}/app/products/${rice.id}`)
  await barPage.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  const headline = barPage.locator('[data-stock-figure]').first()
  // Back to All my areas: the headline is the Bar and the Kitchen together.
  await barPage.getByRole('button', { name: /^Area: .+\. Change area$/ }).click()
  await barPage.getByRole('menuitemradio', { name: 'All my areas' }).click()
  await barPage.getByText('On hand in your areas').waitFor()
  await waitFor(async () => (await headline.innerText()).startsWith(String(at.Bar + at.Kitchen)), `the headline to read ${at.Bar + at.Kitchen}`)
  await barPage.screenshot({ path: SHOTS + '24-all-my-areas.png' })
  // One area: only its own figure.
  await barPage.getByRole('button', { name: 'Area: All my areas. Change area' }).click()
  await barPage.getByRole('menu', { name: 'Showing and recording' }).waitFor()
  await barPage.getByRole('menuitemradio', { name: 'Bar' }).click()
  await barPage.getByText('On hand in the Bar').waitFor()
  await waitFor(async () => (await headline.innerText()).startsWith(String(at.Bar)), `the headline to read ${at.Bar}`)
  // Inventory: the Bar's figure; a product the Bar has none of is Out, nothing is Low.
  await barPage.goto(`${UI}/app/products`)
  const row = barPage.locator(`[data-product-row="${rice.id}"]`).locator('visible=true').first()
  await waitFor(async () => (await row.innerText().catch(() => '')).includes(String(at.Bar)), 'the Inventory row to show the Bar figure')
  const lowChip = barPage.getByRole('group', { name: 'Stock level' }).getByRole('button', { name: /^Low/ })
  assert(/Low\s*0/.test(await lowChip.innerText()), `Low in an area view: ${await lowChip.innerText()}`)
  await barPage.screenshot({ path: SHOTS + '25-inventory-bar.png' })
  // The Kitchen never had flour: it isn't listed or counted as Out there, just counted as "not in the Kitchen",
  // and Show them lists it as "Not here".
  const flourId = (await api(`/api/products?search=Flour`, { token: ownerToken })).json.content.find((p) => p.name === 'Flour').id
  await barPage.getByRole('button', { name: 'Area: Bar. Change area' }).click()
  await barPage.getByRole('menuitemradio', { name: 'Kitchen' }).click()
  const elsewhereLine = barPage.locator('[data-elsewhere]')
  await elsewhereLine.getByText("1 other product isn't in the Kitchen.").waitFor()
  await barPage.locator(`[data-product-row="${rice.id}"]`).locator('visible=true').first().waitFor()
  assert((await barPage.locator(`[data-product-row="${flourId}"]`).locator('visible=true').count()) === 0, 'flour is listed in the Kitchen')
  await barPage.screenshot({ path: SHOTS + '26-inventory-kitchen.png' })
  await elsewhereLine.getByRole('button', { name: 'Show them' }).click()
  const flourRow = barPage.locator(`[data-product-row="${flourId}"]`).locator('visible=true').first()
  await flourRow.getByText('Not here').waitFor()
  await elsewhereLine.getByRole('button', { name: 'Hide them' }).click()
  // A phone whose copy was taken before areas said what they've had: it downloads a fresh copy once, and the
  // Kitchen still lists only its own (owner, 2026-10-31: an old copy showed every product as Out).
  await barPage.evaluate(async () => {
    const name = (await indexedDB.databases()).map((d) => d.name).find((n) => n?.startsWith('procurepaddy-catalog:'))
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open(name)
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const tx = db.transaction(['products', 'meta'], 'readwrite')
    const products = tx.objectStore('products')
    products.openCursor().onsuccess = (event) => {
      const cursor = event.target.result
      if (!cursor) return
      const row = cursor.value
      cursor.update({ ...row, areaStock: row.areaStock?.map(({ carried: _c, ...figure }) => figure) })
      cursor.continue()
    }
    const meta = tx.objectStore('meta')
    meta.get('state').onsuccess = (event) => {
      const { rowFormat: _f, ...old } = event.target.result
      meta.put(old, 'state')
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })
  await barPage.reload()
  await elsewhereLine.getByText("1 other product isn't in the Kitchen.").waitFor({ timeout: 20000 })
  assert((await barPage.locator(`[data-product-row="${flourId}"]`).locator('visible=true').count()) === 0, 'an old copy lists flour in the Kitchen')
  await barContext.close()

  // The owner: All areas is the whole branch, as before; one area shows that area.
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Area: All areas. Change area' }).waitFor()
  assert((await page.getByText(/^On hand in /).count()) === 0, 'All areas names an area')
  // On a phone the menu spans the screen under the top bar, never off its edge (owner, 2026-10-31).
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Area: All areas. Change area' }).click()
  const phoneMenu = await page.getByRole('menu', { name: 'Showing and recording' }).boundingBox()
  assert(phoneMenu.x >= 16 && phoneMenu.x + phoneMenu.width <= 390 - 16, `the menu runs off the screen: ${JSON.stringify(phoneMenu)}`)
  await page.screenshot({ path: SHOTS + '27-area-menu-phone.png' })
  await page.getByRole('button', { name: 'Area: All areas. Change area' }).click()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Area: All areas. Change area' }).click()
  await page.getByRole('menuitemradio', { name: 'Store' }).click()
  await page.getByText('On hand in the Store').waitFor()
  await waitFor(async () => (await page.locator('[data-stock-figure]').first().innerText()).startsWith(String(at.Store)), `the Store's ${at.Store}`)
  // …and records there: the Store already picked.
  await page.getByRole('button', { name: 'Stock in' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Recording in the Store. Change area' }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Area: Store. Change area' }).click()
  await page.getByRole('menuitemradio', { name: 'All areas' }).click()
  await page.getByRole('button', { name: 'Area: All areas. Change area' }).waitFor()
})

// ------------------------------------------------------------------------------------- Part 3.5
await check("the Kitchen's closing count records what's short as used there, and counting again adds nothing", async () => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const kitchenBefore = (await areaFigures(ownerToken, rice.id)).Kitchen
  assert(kitchenBefore >= 2, `the Kitchen holds ${kitchenBefore}`)
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Count', exact: true }).first().click()
  const sheet = page.getByRole('dialog')
  await sheetArea(sheet, 'Kitchen')
  await sheet.getByText('Anything short is recorded as used at the Kitchen.').waitFor()
  await sheet.getByRole('group', { name: /How much is on the shelf now/ }).getByRole('textbox').first().fill(String(kitchenBefore - 2))
  await sheet.getByText('2 pieces short: recorded as used at the Kitchen.').waitFor()
  await page.screenshot({ path: SHOTS + '17-kitchen-count.png' })
  await sheet.getByRole('button', { name: 'Record count' }).click()
  await sheet.waitFor({ state: 'hidden' })
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === kitchenBefore - 2, 'the Kitchen to hold 2 fewer')
  const rows = (await api(`/api/stock/movements?productId=${rice.id}`, { token: ownerToken })).json.content
  assert(rows[0].movementType === 'OUT' && rows[0].outReason === 'USED' && rows[0].count === true, `latest row: ${JSON.stringify(rows[0])}`)

  // Counting the same shelf again: nothing more used; the sheet says when it was last counted.
  await page.getByRole('button', { name: 'Count', exact: true }).first().click()
  await sheetArea(sheet, 'Kitchen')
  await sheet.getByText(/Last counted today/).waitFor()
  await sheet.getByRole('group', { name: /How much is on the shelf now/ }).getByRole('textbox').first().fill(String(kitchenBefore - 2))
  await sheet.getByRole('button', { name: 'Record count' }).click()
  await sheet.waitFor({ state: 'hidden' })
  const after = (await api(`/api/stock/movements?productId=${rice.id}`, { token: ownerToken })).json.content
  assert(after.filter((r) => r.count && r.movementType === 'OUT').length === 1, 'counting again recorded more use')

  await page.goto(`${UI}/app/stock-movements`)
  await page.locator('tbody tr').filter({ hasText: 'Used at Kitchen · count' }).first().waitFor()
  await page.screenshot({ path: SHOTS + '18-used-at-kitchen-count.png' })
})

await check('a count can record its shortfall as missing instead, for that count only', async () => {
  const kitchenBefore = (await areaFigures(ownerToken, rice.id)).Kitchen
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Count', exact: true }).first().click()
  const sheet = page.getByRole('dialog')
  await sheetArea(sheet, 'Kitchen')
  await sheet.getByRole('group', { name: /How much is on the shelf now/ }).getByRole('textbox').first().fill(String(kitchenBefore - 1))
  await sheet.getByRole('button', { name: 'Change: record it as missing' }).click()
  await sheet.getByText('1 piece short: recorded as missing from the Kitchen.').waitFor()
  await sheet.getByRole('button', { name: 'Record count' }).click()
  await sheet.waitFor({ state: 'hidden' })
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === kitchenBefore - 1, 'the Kitchen to hold 1 fewer')
  const rows = (await api(`/api/stock/movements?productId=${rice.id}`, { token: ownerToken })).json.content
  assert(rows[0].movementType === 'ADJUSTMENT' && rows[0].quantity === -1, `latest row: ${JSON.stringify(rows[0])}`)
})

await check('an area\'s Edit asks what happens there in words, and the row says the new answer', async () => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${UI}/app/company/branches`)
  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  await areas.getByRole('button', { name: 'Edit Bar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit Bar' })
  await sheet.getByText('If a count finds less, the rest is recorded as used').waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: SHOTS + '20-what-happens-here.png' })
  await sheet.getByLabel(/^Stock is stored here/).check()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await sheet.waitFor({ state: 'hidden' })
  await areas.locator('[data-area="Bar"]').getByText('stock is stored here').waitFor()
  await page.screenshot({ path: SHOTS + '21-branches-rows.png' })

  // The same on a phone: the rows, then the panel from the bottom.
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(`${UI}/app/company/branches`)
  await areas.locator('[data-area="Bar"]').waitFor()
  await areas.locator('[data-area="Kitchen"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: SHOTS + '22-phone-branches-rows.png' })
  await areas.getByRole('button', { name: 'Edit Kitchen' }).click()
  await page.getByRole('dialog', { name: 'Edit Kitchen' }).getByRole('group', { name: 'When stock is moved here' }).waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: SHOTS + '23-phone-what-happens-here.png' })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 900 })
})

// ------------------------------------------------------------------------------------- Part 4
await check('the Kitchen confirms what arrives: a move waits, the cook confirms it short from quick mode, offline too', async () => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${UI}/app/company/branches`)
  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  await areas.getByRole('button', { name: 'Edit Kitchen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit Kitchen' })
  // Its own question, in its own box (owner, 2026-10-31): any kind of area can confirm.
  await sheet.getByRole('group', { name: 'When stock is moved here' }).getByLabel('Someone here confirms it').check()
  await sheet.getByText('It waits until someone in the Kitchen says they got it.').waitFor()
  await page.waitForTimeout(300)
  await page.screenshot({ path: SHOTS + '28-confirms-what-arrives.png' })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await sheet.waitFor({ state: 'hidden' })
  await areas.locator('[data-area="Kitchen"]').getByText('confirms what arrives').waitFor()

  // The owner moves 3: they leave the Store now and wait; the button and the toast said so.
  const before = await areaFigures(ownerToken, rice.id)
  async function moveToKitchen(quantity) {
    await page.goto(`${UI}/app/products/${rice.id}`)
    await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
    await page.getByRole('button', { name: 'Move', exact: true }).click()
    await moveSheet.waitFor()
    await page.locator('#move-to').selectOption({ label: 'Kitchen' })
    await page.getByLabel('How many Rice').fill(String(quantity))
    await moveSheet.getByText('once confirmed').waitFor()
    await moveSheet.getByRole('button', { name: 'Move 1 item · Kitchen will confirm' }).click()
    await moveSheet.waitFor({ state: 'hidden' })
    await page.getByText(/waiting for the Kitchen/).first().waitFor()
  }
  await moveToKitchen(3)
  await page.locator('[data-area-waiting]').getByText(/3 .*waiting for Kitchen/).waitFor()
  const held = await areaFigures(ownerToken, rice.id)
  assert(held.Store === before.Store - 3 && held.Kitchen === before.Kitchen, `held ${JSON.stringify(held)}, was ${JSON.stringify(before)}`)
  await page.screenshot({ path: SHOTS + '29-waiting-for-kitchen.png' })

  // The cook, on a phone: one line at the top of quick mode; got 2 of 3, the other still in the Store.
  const cookContext = await contextFor(await login(owner.user.clientIdentifier, `cook-${owner.unique}`), { width: 390, height: 844 })
  const cookPage = await cookContext.newPage()
  await cookPage.goto(`${UI}/app/quick?mode=out`)
  const line = cookPage.locator('[data-waiting-line]')
  await line.getByText('1 item from the Store to confirm').waitFor()
  await cookPage.screenshot({ path: SHOTS + '30-quick-waiting-line.png' })
  await line.click()
  const confirmSheet = cookPage.getByRole('dialog', { name: '1 item from the Store' })
  await confirmSheet.getByRole('button', { name: 'Got everything' }).waitFor()
  await confirmSheet.getByRole('button', { name: 'Decrease got of rice' }).click()
  // That line asks what happened to the rest, one tap each (Part 6); still in the Store to start with.
  await confirmSheet.locator('[data-rest-question]').getByText(/What happened to the other 1/).waitFor()
  assert(await confirmSheet.getByRole('radio', { name: 'Still in the Store' }).isChecked(), 'the rest does not start as still in the Store')
  await cookPage.waitForTimeout(300)
  await cookPage.screenshot({ path: SHOTS + '31-confirm-short.png' })
  await confirmSheet.getByRole('button', { name: /^Confirm · 1 .*short$/ }).click()
  await confirmSheet.waitFor({ state: 'hidden' })
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === before.Kitchen + 2, 'the Kitchen to get 2')
  // 3 left the Store; the 1 that didn't arrive is back there.
  assert((await areaFigures(ownerToken, rice.id)).Store === before.Store - 2, 'the other 1 is not back in the Store')
  await line.waitFor({ state: 'detached' })

  // Confirmed offline: kept on the phone, the line gone at once, and it lands once back online.
  await moveToKitchen(1)
  await cookPage.reload()
  await line.getByText('1 item from the Store to confirm').waitFor()
  await cookContext.setOffline(true)
  await line.click()
  await confirmSheet.getByRole('button', { name: 'Got everything' }).click()
  await cookPage.getByText(/Saved on this phone/).first().waitFor()
  await line.waitFor({ state: 'detached' })
  await cookContext.setOffline(false)
  await cookPage.evaluate(() => window.dispatchEvent(new Event('online')))
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === before.Kitchen + 3, 'the offline confirmation to land')
  await cookContext.close()

  // On a laptop: Needs you today on the dashboard, and the same line at the top of Inventory (owner, 2026-10-31).
  await moveToKitchen(1)
  const deskContext = await contextFor(await login(owner.user.clientIdentifier, `cook-${owner.unique}`))
  const deskPage = await deskContext.newPage()
  await deskPage.goto(`${UI}/app`)
  await deskPage.getByRole('region', { name: 'Needs you today' }).getByText('1 item from the Store to confirm').waitFor()
  await deskPage.goto(`${UI}/app/products`)
  const deskLine = deskPage.locator('[data-waiting-line]')
  await deskLine.getByText('1 item from the Store to confirm').waitFor()
  await deskPage.screenshot({ path: SHOTS + '33-inventory-waiting-line.png' })
  // The bell says it too, and its link opens the move over the page it lands on.
  await deskPage.getByRole('button', { name: /^Notifications/ }).click()
  await deskPage.getByRole('menu').getByText('1 item from the Store to confirm').first().click()
  const panel = deskPage.getByRole('dialog', { name: '1 item from the Store' })
  await panel.getByRole('button', { name: 'Got everything' }).waitFor()
  await deskPage.waitForTimeout(300)
  await deskPage.screenshot({ path: SHOTS + '34-confirm-panel-laptop.png' })
  await panel.getByRole('button', { name: 'Got everything' }).click()
  await deskLine.waitFor({ state: 'detached' })
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === before.Kitchen + 4, 'the laptop confirmation to land')
  await deskContext.close()

  // One more, taken back by the owner from the Moves list; the list says how each went.
  await moveToKitchen(2)
  await page.goto(`${UI}/app/stock-movements?moves=1`)
  const moves = page.getByRole('list', { name: 'Moves between areas' })
  await moves.locator('[data-move-state]').getByText('Waiting for the Kitchen').waitFor()
  await moves.locator('[data-move-state]').getByText('The Kitchen got 2 of 3').waitFor()
  await moves.locator('[data-move-state]').getByText('The Kitchen got everything').first().waitFor()
  await page.screenshot({ path: SHOTS + '32-moves-states.png' })
  await moves.getByRole('button', { name: 'Confirm' }).first().click()
  await page.getByRole('dialog', { name: '1 item from the Store' }).getByRole('button', { name: 'Take it back to the Store' }).click()
  await page.getByText(/Taken back · in the Store again/).first().waitFor()
  await moves.locator('[data-move-state]').getByText('Taken back').waitFor()
  const end = await areaFigures(ownerToken, rice.id)
  assert(end.Store === before.Store - 4 && end.Kitchen === before.Kitchen + 4, `ended ${JSON.stringify(end)}, began ${JSON.stringify(before)}`)

  // Switched off again: the rest of the suite moves instantly.
  await page.goto(`${UI}/app/company/branches`)
  await areas.getByRole('button', { name: 'Edit Kitchen' }).click()
  await sheet.getByLabel('It arrives straight away').check()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await sheet.waitFor({ state: 'hidden' })
})

// ------------------------------------------------------------------------------------- Part 6

await check('confirming short, each line says what happened and the cook adds a note; the move says it', async () => {
  const beans = await createProduct(ownerToken, owner.unique, 'Beans')
  await api(`/api/products/${beans.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 10, unitPrice: '100' } })
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  await api(`/api/areas/${areaIds.Kitchen}`, { token: ownerToken, method: 'PATCH', body: { confirms: true } })
  const before = await areaFigures(ownerToken, rice.id)
  const moveId = randomUUID()
  await api('/api/area-moves', {
    token: ownerToken,
    method: 'POST',
    body: {
      id: moveId,
      fromAreaId: areaIds.Store,
      toAreaId: areaIds.Kitchen,
      lines: [
        { productId: rice.id, quantity: 3 },
        { productId: beans.id, quantity: 2 },
      ],
    },
  })

  // The cook, on a phone: one short of each - the rice still in the Store, the beans expired - and a note.
  const cookContext = await contextFor(await login(owner.user.clientIdentifier, `cook-${owner.unique}`), { width: 390, height: 844 })
  const cookPage = await cookContext.newPage()
  await cookPage.goto(`${UI}/app/quick?mode=out`)
  await cookPage.locator('[data-waiting-line]').getByText('2 items from the Store to confirm').click()
  const sheet = cookPage.getByRole('dialog', { name: '2 items from the Store' })
  await sheet.getByRole('button', { name: 'Decrease got of rice' }).click()
  await sheet.getByRole('button', { name: 'Decrease got of beans' }).click()
  const beansLine = sheet.locator(`[data-confirm-line="${beans.id}"]`)
  await beansLine.getByText('What happened to the other 1 piece?').waitFor()
  await beansLine.getByText('Expired', { exact: true }).click()
  assert(await beansLine.getByRole('radio', { name: 'Expired' }).isChecked(), 'Expired is not chosen')
  await sheet.getByLabel('Note (optional)').fill('One tin was swollen')
  await cookPage.waitForTimeout(300)
  await cookPage.screenshot({ path: SHOTS + '48-confirm-short-reasons.png' })
  await sheet.getByRole('button', { name: /^Confirm · 2 items short$/ }).click()
  await sheet.waitFor({ state: 'hidden' })
  await cookContext.close()

  const move = (await api(`/api/area-moves/${moveId}`, { token: ownerToken })).json
  const reasons = Object.fromEntries(move.lines.map((line) => [line.productName, line.restReason]))
  assert(reasons.Rice === 'BACK' && reasons.Beans === 'EXPIRED', `reasons ${JSON.stringify(reasons)}`)
  assert(move.confirmNote === 'One tin was swollen', `note ${move.confirmNote}`)
  assert((await areaFigures(ownerToken, rice.id)).Store === before.Store - 2, 'the rice still in the Store is not back there')

  // The owner opens it from its link: each line says what happened, and the note.
  await page.goto(`${UI}/app?move=${moveId}`)
  const opened = page.getByRole('dialog', { name: '2 items from the Store' })
  await opened.locator(`[data-confirm-line="${beans.id}"]`).getByText('1 piece expired').waitFor()
  await opened.locator(`[data-confirm-line="${rice.id}"]`).getByText('1 piece still in the Store').waitFor()
  await opened.locator('[data-move-state]').getByText('The Kitchen got less of each item').waitFor()
  await opened.locator('[data-confirm-note]').getByText('Note: One tin was swollen').waitFor()
  await page.screenshot({ path: SHOTS + '49-move-says-what-happened.png' })
  await page.keyboard.press('Escape')
  await api(`/api/areas/${areaIds.Kitchen}`, { token: ownerToken, method: 'PATCH', body: { confirms: false } })
})

await check('the Kitchen gives back an expired tin to the Store and reports a spoilt one, from what it received', async () => {
  const tins = await createProduct(ownerToken, owner.unique, 'Canned peas')
  await api(`/api/products/${tins.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 10, unitPrice: '300' } })
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  await api('/api/area-moves', {
    token: ownerToken,
    method: 'POST',
    body: { id: randomUUID(), fromAreaId: areaIds.Store, toAreaId: areaIds.Kitchen, lines: [{ productId: tins.id, quantity: 3 }] },
  })
  const before = await areaFigures(ownerToken, tins.id)

  // The cook, on a phone: Inventory's "⋯" → Give back or report → what the Kitchen received lately.
  const cookContext = await contextFor(await login(owner.user.clientIdentifier, `cook-${owner.unique}`), { width: 390, height: 844 })
  const cookPage = await cookContext.newPage()
  await cookPage.goto(`${UI}/app/products`)
  await cookPage.getByRole('button', { name: 'More inventory actions' }).click()
  await cookPage.getByRole('menuitem', { name: 'Give back or report' }).click()
  const sheet = cookPage.getByRole('dialog', { name: 'Received by Kitchen' })
  const line = sheet.locator('[data-given-line="Canned peas"]').first()
  await line.getByText('3 pieces received').waitFor()

  // On inspection one has expired: it goes back to the Store, saying why.
  await line.getByRole('button', { name: 'Give back Canned peas' }).click()
  assert(await line.getByRole('radio', { name: 'Not needed' }).isChecked(), 'giving back does not start as not needed')
  await line.getByText('Expired', { exact: true }).click()
  await line.getByLabel('Note (optional)').fill('Lid puffed up')
  await cookPage.waitForTimeout(300)
  await cookPage.screenshot({ path: SHOTS + '52-kitchen-gives-back-expired.png' })
  await line.getByRole('button', { name: 'Give back 1 piece to the Store' }).click()
  await cookPage.getByText('Given back · 1 piece of Canned peas · to the Store').first().waitFor()
  await line.getByText('1 piece given back (expired)').waitFor()
  await waitFor(async () => {
    const now = await areaFigures(ownerToken, tins.id)
    return now.Store === before.Store + 1 && now.Kitchen === before.Kitchen - 1
  }, 'the tin to be back in the Store')

  // Another went mouldy: written off in the Kitchen.
  await line.getByRole('button', { name: 'Report Canned peas' }).click()
  await line.getByRole('button', { name: 'Report 1 piece spoilt' }).click()
  await line.getByText('1 piece reported spoilt').waitFor()
  await waitFor(async () => (await areaFigures(ownerToken, tins.id)).Kitchen === before.Kitchen - 2, 'the spoilt tin to leave the Kitchen')
  assert((await areaFigures(ownerToken, tins.id)).Store === before.Store + 1, 'a report changed the Store')
  await cookContext.close()
})

await check('Housekeeping gives back what it did not use and reports what spoilt, from what it was given; offline too', async () => {
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  const role = (await api('/api/roles', { token: ownerToken })).json.find((r) => r.name === 'STOREKEEPER')
  const name = `maid-${owner.unique}`
  await api('/api/users', { token: ownerToken, method: 'POST', body: { username: name, password: PASSWORD, roleId: role.id, areaIds: [areaIds.Housekeeping] } })
  await api('/api/area-moves', {
    token: ownerToken,
    method: 'POST',
    body: { id: randomUUID(), fromAreaId: areaIds.Store, toAreaId: areaIds.Housekeeping, lines: [{ productId: rice.id, quantity: 3 }] },
  })
  const before = await areaFigures(ownerToken, rice.id)
  const ownerHeard = () =>
    execSync(psqlCommand, {
      input: `SELECT COUNT(*) FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email = '${owner.email}' AND n.type = 'AREA_RETURN';`,
    })
      .toString()
      .trim()
  const heardBefore = Number(ownerHeard())

  // On a phone: Inventory's "⋯" → Give back or report → what Housekeeping was given lately.
  const maidContext = await contextFor(await login(owner.user.clientIdentifier, name), { width: 390, height: 844 })
  const maidPage = await maidContext.newPage()
  await maidPage.goto(`${UI}/app/products`)
  await maidPage.getByRole('button', { name: 'More inventory actions' }).click()
  await maidPage.getByRole('menuitem', { name: 'Give back or report' }).click()
  const sheet = maidPage.getByRole('dialog', { name: 'Received by Housekeeping' })
  const line = sheet.locator('[data-given-line="Rice"]').first()
  await line.getByText('3 pieces received').waitFor()

  // Give back 1: it opens in place; the Store has it again.
  await line.getByRole('button', { name: 'Give back Rice' }).click()
  await line.getByRole('button', { name: 'Give back 1 piece to the Store' }).click()
  await maidPage.getByText('Given back · 1 piece of Rice · to the Store').first().waitFor()
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Store === before.Store + 1, 'the Store to have it again')
  await line.getByText('1 piece given back').waitFor()

  // Report 1 spoilt, with a note: no figure changes.
  await line.getByRole('button', { name: 'Report Rice' }).click()
  await line.getByText('Spoilt', { exact: true }).click()
  await line.getByLabel('Note (optional)').fill('Mice got into the bag')
  await maidPage.waitForTimeout(300)
  await maidPage.screenshot({ path: SHOTS + '50-report-spoilt.png' })
  await line.getByRole('button', { name: 'Report 1 piece spoilt' }).click()
  await line.getByText('1 piece reported spoilt').waitFor()
  assert((await areaFigures(ownerToken, rice.id)).Store === before.Store + 1, 'a report changed the Store')
  await maidPage.screenshot({ path: SHOTS + '51-given-to-housekeeping.png' })

  // The last one, given back offline: kept on the phone, and it lands once back online.
  await maidContext.setOffline(true)
  await line.getByRole('button', { name: 'Give back Rice' }).click()
  await line.getByRole('button', { name: 'Give back 1 piece to the Store' }).click()
  await maidPage.getByText(/Saved on this phone/).first().waitFor()
  await maidContext.setOffline(false)
  await maidPage.evaluate(() => window.dispatchEvent(new Event('online')))
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Store === before.Store + 2, 'the offline give back to land')
  await maidContext.close()
  await waitFor(async () => Number(ownerHeard()) === heardBefore + 3, `the owner to hear 3 more times (heard ${ownerHeard()}, had ${heardBefore})`)
})

// ------------------------------------------------------------------------------------- Part 5
await check('the cook asks the Store from Move; the storekeeper moves part, says none of the rest; the buyer sees it', async () => {
  const paste = await createProduct(ownerToken, owner.unique, 'Tomato paste')
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  const role = (await api('/api/roles', { token: ownerToken })).json.find((r) => r.name === 'STOREKEEPER')
  const keeperName = `keeper-${owner.unique}`
  await api('/api/users', { token: ownerToken, method: 'POST', body: { username: keeperName, password: PASSWORD, roleId: role.id, areaIds: [areaIds.Store], firstName: 'Amaka', phone: '0803 123 4567' } })
  const before = await areaFigures(ownerToken, rice.id)

  // The cook, on a phone: quick mode's Move, From the Store - it asks.
  const cookContext = await contextFor(await login(owner.user.clientIdentifier, `cook-${owner.unique}`), { width: 390, height: 844 })
  const cookPage = await cookContext.newPage()
  await cookPage.goto(`${UI}/app/quick`)
  // Ask is its own button for a cook (owner, 2026-11-01), opening on the Store.
  await cookPage.getByRole('group', { name: 'What are you doing?' }).getByRole('button', { name: 'Ask' }).click()
  assert((await chosenIn(cookPage, 'select#move-from')) === 'Store', `Ask starts from ${await chosenIn(cookPage, 'select#move-from')}`)
  await cookPage.locator('[data-asking]').getByText("The Store's people move it to you.").waitFor()
  for (const [name, quantity] of [['Rice', '2'], ['Tomato paste', '3']]) {
    // A product made moments ago may still be reaching the phone's copy of the catalogue: type again once.
    const result = cookPage.getByRole('button', { name: new RegExp(`^${name}`) }).first()
    await cookPage.locator('#move-search').fill(name)
    if (!(await result.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false))) {
      await cookPage.locator('#move-search').fill('')
      await cookPage.locator('#move-search').fill(name)
    }
    await result.click()
    await cookPage.getByLabel(`How many ${name}`).fill(quantity)
  }
  await cookPage.locator(`[data-move-line="${paste.id}"]`).getByText('The Store has none').waitFor()
  await cookPage.waitForTimeout(300)
  await cookPage.screenshot({ path: SHOTS + '35-cook-asks.png' })
  await cookPage.getByRole('button', { name: 'Ask the Store for 2 items' }).click()
  await cookPage.getByText(/2 items · Store → Kitchen · asked/).first().waitFor()
  // Tell the one person who can move it, on WhatsApp, the message already typed (owner, 2026-11-01).
  await cookContext.route('https://wa.me/**', (route) => route.fulfill({ body: 'whatsapp' }))
  const tell = cookPage.locator('[data-whatsapp-tell]').getByRole('button', { name: 'Tell Amaka on WhatsApp' })
  await tell.waitFor()
  // Sent: the session line says so too, as the big stamp did.
  await cookPage.locator('section[aria-labelledby="quick-session-heading"] [data-stamp="synced"]').waitFor()
  await cookPage.screenshot({ path: SHOTS + '45-tell-on-whatsapp.png' })
  const [chat] = await Promise.all([cookContext.waitForEvent('page'), tell.click()])
  await chat.waitForURL(/wa\.me/)
  const link = decodeURIComponent(chat.url())
  assert(link.startsWith('https://wa.me/2348031234567?text=The Kitchen asked for '), `whatsapp link: ${link}`)
  assert(link.includes('Rice 2 pieces') && link.includes('Tomato paste 3 pieces'), `whatsapp message: ${link}`)
  assert(link.includes('/app?request='), `no link back to the request: ${link}`)
  await chat.close()
  assert((await areaFigures(ownerToken, rice.id)).Store === before.Store, 'asking moved stock')

  // The storekeeper, on a laptop: the line at the top of Inventory opens Move, filled.
  const keeperContext = await contextFor(await login(owner.user.clientIdentifier, keeperName))
  const keeperPage = await keeperContext.newPage()
  await keeperPage.goto(`${UI}/app/products`)
  const askedLine = keeperPage.locator('[data-request-line]')
  await askedLine.getByText('The Kitchen asked for 2 items').waitFor()
  await keeperPage.screenshot({ path: SHOTS + '36-store-asked-line.png' })
  await askedLine.click()
  const fillSheet = keeperPage.getByRole('dialog', { name: /Move stock/ })
  await fillSheet.locator('[data-request-header]').getByText(/The Kitchen asked for these/).waitFor()
  await waitFor(async () => (await keeperPage.getByLabel('How many Rice').inputValue()) === '2', 'rice to be filled in at 2')
  await keeperPage.getByLabel('How many Tomato paste').waitFor()
  await keeperPage.waitForTimeout(300)
  await keeperPage.screenshot({ path: SHOTS + '37-move-filled-from-request.png' })
  await fillSheet.locator(`[data-move-line="${paste.id}"]`).getByRole('button', { name: 'None in the Store' }).click()
  await fillSheet.locator('[data-none-here]').getByText(/Tomato paste/).waitFor()
  await keeperPage.getByLabel('How many Rice').fill('1')
  await fillSheet.getByRole('button', { name: 'Move 1 item to Kitchen' }).click()
  await fillSheet.waitFor({ state: 'hidden' })
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === before.Kitchen + 1, 'the Kitchen to get 1')
  // One rice still asked: the line stays, and opens with just that.
  await keeperPage.reload()
  await askedLine.click()
  await waitFor(async () => (await keeperPage.getByLabel('How many Rice').inputValue()) === '1', 'the last rice to be filled in')
  assert((await keeperPage.getByLabel('How many Tomato paste').count()) === 0, 'tomato paste is asked again')
  await fillSheet.getByRole('button', { name: 'Move 1 item to Kitchen' }).click()
  await fillSheet.waitFor({ state: 'hidden' })
  await askedLine.waitFor({ state: 'detached' })
  await keeperContext.close()

  // The cook's Requests: how it went.
  await cookPage.goto(`${UI}/app/stock-movements?requests=1`)
  const requests = cookPage.getByRole('list', { name: 'Requests' })
  await requests.locator('[data-request-state]').getByText('Moved, some none in the Store').waitFor()
  await cookPage.screenshot({ path: SHOTS + '38-cook-requests.png' })
  await cookContext.close()

  // The buyer: Low stock opens with what the Store has none of.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${UI}/app/products/low-stock`)
  await page.getByRole('region', { name: 'Asked for, none in the store' })
    .getByText(/The Kitchen needs 3 .* of Tomato paste\. The Store has none\./).waitFor()
  await page.screenshot({ path: SHOTS + '39-low-stock-none-in-store.png' })
  const end = await areaFigures(ownerToken, rice.id)
  assert(end.Store === before.Store - 2 && end.Kitchen === before.Kitchen + 2, `ended ${JSON.stringify(end)}, began ${JSON.stringify(before)}`)
})

await check('the Store is offered notifications under what was asked, turns them on, and can turn them off on Profile', async () => {
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  const role = (await api('/api/roles', { token: ownerToken })).json.find((r) => r.name === 'STOREKEEPER')
  const name = `notify-${owner.unique}`
  await api('/api/users', { token: ownerToken, method: 'POST', body: { username: name, password: PASSWORD, roleId: role.id, areaIds: [areaIds.Store] } })
  const cook = await login(owner.user.clientIdentifier, `cook-${owner.unique}`)
  const requestId = randomUUID()
  await api('/api/stock-requests', {
    token: cook.tokens.accessToken,
    method: 'POST',
    body: { id: requestId, fromAreaId: areaIds.Store, toAreaId: areaIds.Kitchen, lines: [{ productId: rice.id, quantity: 1 }] },
  })

  const keeperContext = await contextFor(await login(owner.user.clientIdentifier, name))
  await keeperContext.grantPermissions(['notifications'], { origin: UI })
  // Headless Chromium has no push service to subscribe with: the browser's subscription stands in, with real keys.
  const device = createECDH('prime256v1')
  device.generateKeys()
  const keys = { p256dh: device.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }
  await keeperContext.addInitScript(([keys]) => {
    // Headless Chromium answers "denied" whatever it's granted: the browser's "Allow" stands in too.
    let permission = localStorage.getItem('__permission') ?? 'default'
    Object.defineProperty(Notification, 'permission', { get: () => permission })
    Notification.requestPermission = async () => {
      permission = 'granted'
      localStorage.setItem('__permission', permission)
      return permission
    }
    let current = null
    const fake = (endpoint) => ({ endpoint, toJSON: () => ({ endpoint, keys }), unsubscribe: async () => ((current = null), true) })
    PushManager.prototype.subscribe = async function () {
      current = fake('https://push.example.test/e2e/' + Math.random().toString(36).slice(2))
      localStorage.setItem('__push', current.endpoint)
      return current
    }
    PushManager.prototype.getSubscription = async function () {
      const kept = localStorage.getItem('__push')
      return current ?? (kept ? (current = fake(kept)) : null)
    }
  }, [keys])
  const keeperPage = await keeperContext.newPage()
  await keeperPage.goto(`${UI}/app/products`)
  await keeperPage.evaluate(() => navigator.serviceWorker.ready)
  await keeperPage.locator('[data-request-line]').getByText('The Kitchen asked for 1 item').waitFor()
  const offer = keeperPage.locator('[data-push-offer]')
  await offer.getByText('Get a notification on this computer when someone asks').waitFor()
  await keeperPage.screenshot({ path: SHOTS + '46-push-offer.png' })
  await offer.getByRole('button', { name: 'Turn on' }).click()
  await keeperPage.getByText('Notifications on. This computer will tell you when someone asks.').waitFor()
  await offer.waitFor({ state: 'detached' })
  const devices = () =>
    execSync(psqlCommand, { input: `SELECT COUNT(*) FROM push_subscriptions s JOIN users u ON u.id = s.user_id WHERE u.username = '${name}' AND s.p256dh = '${keys.p256dh}';` })
      .toString()
      .trim()
  await waitFor(async () => devices() === '1', 'the server to keep this computer')

  // Profile: the switch for this computer, on; off again, and the server forgets it.
  await keeperPage.goto(`${UI}/app/profile`)
  const panel = keeperPage.locator('[data-notifications-panel]')
  await panel.getByText(/^On for this computer\./).waitFor()
  await keeperPage.screenshot({ path: SHOTS + '47-profile-notifications.png' })
  await panel.getByRole('button', { name: 'Turn off' }).click()
  await panel.getByText(/^Get a notification on this computer/).waitFor()
  await waitFor(async () => devices() === '0', 'the server to forget this computer')
  await keeperContext.close()
  await api(`/api/stock-requests/${requestId}/cancel`, { token: cook.tokens.accessToken, method: 'POST' })
})

await check("the app's worker shows what's asked, puts the quiet answer in its place and closes it, and opens it over the page", async () => {
  // Headless Chromium shows no notifications, so the worker script runs here against a stand-in browser.
  const shown = []
  const listeners = {}
  const posted = []
  const opened = []
  const windows = []
  const self = {
    addEventListener: (type, listener) => (listeners[type] = listener),
    location: { origin: UI },
    registration: {
      showNotification: async (title, options) => {
        for (const old of shown.filter((n) => n.tag && n.tag === options.tag)) old.close()
        const notification = { title, ...options, close: () => shown.splice(shown.indexOf(notification), 1) }
        shown.push(notification)
      },
      getNotifications: async ({ tag } = {}) => shown.filter((n) => !tag || n.tag === tag),
    },
    clients: { matchAll: async () => windows, openWindow: async (url) => opened.push(url) },
  }
  new Function('self', readFileSync(new URL('../../public/push-sw.js', import.meta.url), 'utf8'))(self)
  const deliver = async (type, event) => {
    let work
    listeners[type]({ ...event, waitUntil: (promise) => (work = promise) })
    return work
  }
  const push = (message) => deliver('push', { data: { json: () => message } })
  const tag = 'request-1'

  await push({ title: 'The Kitchen asked for 1 item', body: 'Rice · cook at 9:00 AM', tag, url: '/app?request=1', quiet: false })
  assert(shown.length === 1 && shown[0].title === 'The Kitchen asked for 1 item' && !shown[0].silent, `shown: ${JSON.stringify(shown)}`)
  const answered = push({ title: "The Kitchen's request · Moved ✓", body: 'Moved by Amaka', tag, url: '/app?request=1', quiet: true })
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert(shown.length === 1 && shown[0].title.endsWith('Moved ✓') && shown[0].silent, `in its place: ${JSON.stringify(shown)}`)
  await answered
  assert(shown.length === 0, 'the quiet one stayed')

  // Tapped with the app open: it's asked to open the request over its page; with none open, a window opens.
  await push({ title: 'The Kitchen asked for 2 items', body: '', tag: 'request-2', url: '/app?request=2', quiet: false })
  windows.push({ url: `${UI}/app/products`, focus: async () => undefined, postMessage: (message) => posted.push(message) })
  await deliver('notificationclick', { notification: shown[0] })
  assert(shown.length === 0, 'tapping it left it showing')
  assert(posted[0]?.type === 'pp.push.open' && posted[0].url === '/app?request=2', `posted ${JSON.stringify(posted)}`)
  windows.length = 0
  await push({ title: 'The Kitchen asked for 3 items', body: '', tag: 'request-3', url: '/app?request=3', quiet: false })
  await deliver('notificationclick', { notification: shown[0] })
  assert(opened[0] === `${UI}/app?request=3`, `opened ${JSON.stringify(opened)}`)
})

await check('a request nobody has moved can be cancelled by the cook', async () => {
  const areaIds = Object.fromEntries((await api('/api/branches', { token: ownerToken })).json.branches[0].areas.map((a) => [a.name, a.id]))
  const cook = await login(owner.user.clientIdentifier, `cook-${owner.unique}`)
  await api('/api/stock-requests', {
    token: cook.tokens.accessToken,
    method: 'POST',
    body: { id: randomUUID(), fromAreaId: areaIds.Store, toAreaId: areaIds.Kitchen, lines: [{ productId: rice.id, quantity: 1 }] },
  })
  const cookContext = await contextFor(cook)
  const cookPage = await cookContext.newPage()
  await cookPage.goto(`${UI}/app/stock-movements?requests=1`)
  const requests = cookPage.getByRole('list', { name: 'Requests' })
  await requests.locator('[data-request-row="OPEN"]').first().click()
  const sheet = cookPage.getByRole('dialog', { name: 'The Kitchen asked for 1 item' })
  await sheet.getByRole('button', { name: 'Cancel this request' }).click()
  await sheet.waitFor({ state: 'hidden' })
  await requests.locator('[data-request-state]').getByText('Cancelled').first().waitFor()
  await cookContext.close()
})

// ---------------------------------------------------------------------------------- quick mode buttons
await check("quick mode's buttons: the usual ones for where each works, a person's own choice kept on their account", async () => {
  const row = (p) => p.getByRole('group', { name: 'What are you doing?' })
  const labels = async (p) => (await row(p).getByRole('button').allInnerTexts()).map((t) => t.trim())

  // The storekeeper: deliveries arrive in the Store.
  const keeperContext = await contextFor(await login(owner.user.clientIdentifier, `keeper-${owner.unique}`), { width: 390, height: 844 })
  const keeperPage = await keeperContext.newPage()
  await keeperPage.goto(`${UI}/app/quick`)
  await row(keeperPage).getByRole('button', { name: 'Move' }).waitFor()
  assert(JSON.stringify(await labels(keeperPage)) === JSON.stringify(['Stock in', 'Move', 'Count']), `keeper: ${await labels(keeperPage)}`)
  await keeperContext.close()

  // The cook: Stock out, Ask, Count - Count a button, so no link.
  const cookContext = await contextFor(await login(owner.user.clientIdentifier, `cook-${owner.unique}`), { width: 390, height: 844 })
  const cookPage = await cookContext.newPage()
  await cookPage.goto(`${UI}/app/quick`)
  await row(cookPage).getByRole('button', { name: 'Ask' }).waitFor()
  assert(JSON.stringify(await labels(cookPage)) === JSON.stringify(['Stock out', 'Ask', 'Count']), `cook: ${await labels(cookPage)}`)
  assert((await cookPage.getByRole('button', { name: 'Count stock' }).count()) === 0, 'a Count link beside a Count button')
  await cookPage.screenshot({ path: SHOTS + '40-cook-quick-buttons.png' })

  // On their profile: add Stock in, drop Count. The row above the choices shows it as quick mode will.
  await cookPage.goto(`${UI}/app/profile`)
  const panel = cookPage.getByRole('region', { name: 'Quick mode buttons' })
  await panel.getByLabel(/^Stock in/).check()
  await panel.getByLabel(/^Count/).uncheck()
  assert(JSON.stringify(await panel.locator('[data-quick-preview] span').allInnerTexts()) === JSON.stringify(['Stock in', 'Stock out', 'Ask']), 'preview')
  await cookPage.waitForTimeout(300)
  await cookPage.screenshot({ path: SHOTS + '41-profile-quick-buttons.png', fullPage: true })
  await panel.getByRole('button', { name: 'Save' }).click()
  await cookPage.getByText('Quick mode buttons saved').first().waitFor()

  // Kept on the account: a fresh sign-in, on another "phone", has them; Count is the small link again.
  const otherContext = await contextFor(await login(owner.user.clientIdentifier, `cook-${owner.unique}`), { width: 390, height: 844 })
  const otherPage = await otherContext.newPage()
  await otherPage.goto(`${UI}/app/quick`)
  await row(otherPage).getByRole('button', { name: 'Stock in' }).waitFor()
  assert(JSON.stringify(await labels(otherPage)) === JSON.stringify(['Stock in', 'Stock out', 'Ask']), `chosen: ${await labels(otherPage)}`)
  await otherPage.getByRole('button', { name: 'Count stock' }).waitFor()
  await otherContext.close()

  // At least one stays: the last one can't be unticked. And back to the usual ones.
  await panel.getByRole('button', { name: 'Use the usual buttons' }).click()
  await cookPage.getByText('Quick mode has the usual buttons again').first().waitFor()
  for (const name of ['Stock out', 'Ask']) await panel.getByLabel(new RegExp(`^${name}`)).uncheck()
  assert(await panel.getByLabel(/^Count/).isDisabled(), 'the last button can be unticked')
  await cookContext.close()
})

await check('Inventory: the owner finds Ask in "⋯"; the search keeps its width; Filters stays on a phone; one heading', async () => {
  // A narrower laptop: the search keeps room to type; the actions go to a second line instead.
  await page.setViewportSize({ width: 1024, height: 800 })
  await page.goto(`${UI}/app/products`)
  const search = page.getByLabel('Search products')
  await search.waitFor()
  const box = await search.boundingBox()
  assert(box.width >= 200, `the search is ${box.width}px wide`)
  await page.screenshot({ path: SHOTS + '42-inventory-1024.png' })
  // Both Move and Ask are buttons on a laptop (owner, 2026-11-01), short words on a narrower one; not in "⋯".
  await page.getByRole('button', { name: 'More inventory actions' }).click()
  assert((await page.getByRole('menuitem', { name: 'Ask for stock' }).count()) === 0, 'Ask is still in "⋯"')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Move', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Ask', exact: true }).click()
  const askSheet = page.getByRole('dialog', { name: /Ask for stock/ })
  await askSheet.locator('[data-asking]').waitFor()
  await page.keyboard.press('Escape')
  await askSheet.waitFor({ state: 'hidden' })

  // A phone: no second "Inventory" under the top bar's; Filters opens on screen; Quick mode beside it.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${UI}/app/products`)
  await search.waitFor()
  // Still there for screen readers - 1px, not a second title on screen.
  const heading = await page.getByRole('heading', { name: 'Inventory', level: 1 }).boundingBox()
  assert(heading.width <= 1 && heading.height <= 1, `the heading shows twice on a phone: ${JSON.stringify(heading)}`)
  await page.getByRole('button', { name: 'Quick mode' }).waitFor()
  await page.getByRole('button', { name: 'Filters' }).click()
  const filters = await page.getByRole('dialog', { name: 'Filters' }).boundingBox()
  assert(filters.x >= 0 && filters.x + filters.width <= 390, `Filters runs off the screen: ${JSON.stringify(filters)}`)
  await page.screenshot({ path: SHOTS + '43-inventory-phone-filters.png' })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 900 })
})

await check('a shared number signs nobody in, and Add user says so as it is typed', async () => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const cook = (await api('/api/users?size=100', { token: ownerToken })).json.content.find((u) => u.username === `cook-${owner.unique}`)
  await api(`/api/users/${cook.id}`, { token: ownerToken, method: 'PUT', body: { phone: '0806 000 0009' } })
  await page.goto(`${UI}/app/users`)
  await page.getByRole('button', { name: 'Add user' }).first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Username').fill(`chef-${owner.unique}`)
  // The same number, written another way.
  await sheet.getByLabel('Phone').fill('+234 806 000 0009')
  await sheet.locator('[data-shared-sign-in]').getByText(/has this number too, so nobody can sign in with it/).waitFor()
  await sheet.locator('[data-shared-sign-in]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: SHOTS + '44-shared-number.png' })
  await sheet.getByLabel('Phone').fill('0806 000 0010')
  await sheet.locator('[data-shared-sign-in]').waitFor({ state: 'detached' })
  await page.keyboard.press('Escape')
})

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
  await shopPage.getByRole('button', { name: 'Edit Store' }).click()
  const storeSheet = shopPage.getByRole('dialog', { name: 'Edit Store' })
  // Before areas, only its name: nothing about counts or closing.
  assert((await storeSheet.getByText('What happens here?').count()) === 0, 'the lone Store is asked what happens there')
  await storeSheet.getByLabel('Name').fill('Shop floor')
  await storeSheet.getByRole('button', { name: 'Save' }).click()
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
  // Its card opened, so the questions are checked too.
  await sheet.locator('[data-area-card="Front desk"]').getByRole('button', { name: 'Change what happens at Front desk' }).click()
  await sheet.locator('[data-area-card="Front desk"]').getByRole('group', { name: 'When stock is moved here' }).waitFor()
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
