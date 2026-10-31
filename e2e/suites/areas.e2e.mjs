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
  // What happens there (D-A12): the quick picks start sensibly - the Kitchen and Bar work with stock,
  // Housekeeping uses it up - and each is one tap to change.
  const kindOf = (name) => dialog.getByLabel(`What happens at ${name}`)
  assert((await kindOf('Kitchen').inputValue()) === 'WORKED', 'the Kitchen does not start as "stock is used here"')
  assert((await kindOf('Housekeeping').inputValue()) === 'USED_UP', "Housekeeping does not start as \"uses what it's given\"")
  // What the chosen answer does, right under it, in words (owner, 2026-10-31).
  await dialog.locator('li', { hasText: 'Housekeeping' }).getByText('Not counted. Whatever is sent here is recorded as used').waitFor()
  await dialog.screenshot({ path: SHOTS + '2-add-areas-sheet.png' })
  await dialog.getByRole('button', { name: 'Add 3 areas' }).click()
  await page.getByRole('status').filter({ hasText: `${branchName} now has 4 areas. Everything you have is in the Store.` }).waitFor()

  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  // Each row says the area in words: what happens there (owner, 2026-10-31).
  await areas.locator('[data-area="Housekeeping"]').getByText("uses what it's given").waitFor()
  await areas.locator('[data-area="Kitchen"]').getByText('stock is used here').waitFor()
  await areas.locator('[data-area="Store"]').getByText('stock is kept here').waitFor()
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
  await page.getByText("Housekeeping uses what it's given").waitFor()
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
  await cookSheet.getByRole('heading', { name: /Kitchen/ }).waitFor()
  assert((await cookSheet.getByText('Which area?').count()) === 0, 'the cook is asked which area')
  await cookSheet.getByLabel('Quantity').fill('1')
  await cookSheet.getByRole('button', { name: 'Confirm' }).click()
  await cookSheet.getByRole('button', { name: 'Done' }).click()
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === before - 1, 'the Kitchen to hold one fewer')
  await cookPage.screenshot({ path: SHOTS + '11-cook-product.png' })

  // Move stock: from the Kitchen, the only area they take from.
  await cookPage.goto(`${UI}/app/move`)
  // One place to take from, so no picker: just the name.
  const from = cookPage.locator('output#move-from')
  await from.waitFor()
  assert((await from.innerText()) === 'Kitchen', `Move starts from ${await from.innerText()}`)
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
  await barPage.getByRole('dialog').getByText('Which area?').waitFor()
  await barPage.keyboard.press('Escape')
  await barPage.getByRole('button', { name: 'Area: All my areas. Change area' }).click()
  await barPage.getByRole('menuitemradio', { name: 'Bar' }).click()
  await barPage.getByRole('button', { name: 'Area: Bar. Change area' }).waitFor()
  await barPage.getByRole('button', { name: 'Stock in' }).first().click()
  const barSheet = barPage.getByRole('dialog')
  await barSheet.getByRole('heading', { name: /Stock in · Bar/ }).waitFor()
  assert((await barSheet.getByText('Which area?').count()) === 0, 'the barman is asked which area')
  await barPage.keyboard.press('Escape')
  await barPage.getByRole('button', { name: 'Area: Bar. Change area' }).click()
  await barPage.getByRole('menuitemradio', { name: 'Kitchen' }).click()
  await barPage.getByRole('button', { name: 'Stock in' }).first().click()
  await barSheet.getByRole('heading', { name: /Stock in · Kitchen/ }).waitFor()
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
  await barContext.close()

  // The owner: All areas is the whole branch, as before; one area shows that area.
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Area: All areas. Change area' }).waitFor()
  assert((await page.getByText(/^On hand in /).count()) === 0, 'All areas names an area')
  await page.getByRole('button', { name: 'Area: All areas. Change area' }).click()
  await page.getByRole('menuitemradio', { name: 'Store' }).click()
  await page.getByText('On hand in the Store').waitFor()
  await waitFor(async () => (await page.locator('[data-stock-figure]').first().innerText()).startsWith(String(at.Store)), `the Store's ${at.Store}`)
  // …and records there without asking.
  await page.getByRole('button', { name: 'Stock in' }).first().click()
  await page.getByRole('dialog').getByRole('heading', { name: /Stock in · Store/ }).waitFor()
  assert((await page.getByRole('dialog').getByText('Which area?').count()) === 0, 'the owner on the Store is asked which area')
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
  await sheet.getByRole('radio', { name: 'Kitchen' }).click()
  await sheet.getByText('Anything short is recorded as used at the Kitchen.').waitFor()
  await sheet.getByLabel(/How much is on the shelf now/).fill(String(kitchenBefore - 2))
  await sheet.getByText('2 pieces short: recorded as used at the Kitchen.').waitFor()
  await page.screenshot({ path: SHOTS + '17-kitchen-count.png' })
  await sheet.getByRole('button', { name: 'Record count' }).click()
  await sheet.waitFor({ state: 'hidden' })
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === kitchenBefore - 2, 'the Kitchen to hold 2 fewer')
  const rows = (await api(`/api/stock/movements?productId=${rice.id}`, { token: ownerToken })).json.content
  assert(rows[0].movementType === 'OUT' && rows[0].outReason === 'USED' && rows[0].count === true, `latest row: ${JSON.stringify(rows[0])}`)

  // Counting the same shelf again: nothing more used; the sheet says when it was last counted.
  await page.getByRole('button', { name: 'Count', exact: true }).first().click()
  await sheet.getByRole('radio', { name: 'Kitchen' }).click()
  await sheet.getByText(/Last counted today/).waitFor()
  await sheet.getByLabel(/How much is on the shelf now/).fill(String(kitchenBefore - 2))
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
  await sheet.getByRole('radio', { name: 'Kitchen' }).click()
  await sheet.getByLabel(/How much is on the shelf now/).fill(String(kitchenBefore - 1))
  await sheet.getByRole('button', { name: 'Change: record it as missing' }).click()
  await sheet.getByText('1 piece short: recorded as missing from the Kitchen.').waitFor()
  await sheet.getByRole('button', { name: 'Record count' }).click()
  await sheet.waitFor({ state: 'hidden' })
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Kitchen === kitchenBefore - 1, 'the Kitchen to hold 1 fewer')
  const rows = (await api(`/api/stock/movements?productId=${rice.id}`, { token: ownerToken })).json.content
  assert(rows[0].movementType === 'ADJUSTMENT' && rows[0].quantity === -1, `latest row: ${JSON.stringify(rows[0])}`)
})

await check('a move line used straight away is used at the Kitchen and never joins its stock', async () => {
  const before = await areaFigures(ownerToken, rice.id)
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Rice', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await moveSheet.waitFor()
  await page.locator('#move-to').selectOption({ label: 'Kitchen' })
  await page.getByLabel('How many Rice').fill('1')
  await page.getByRole('checkbox', { name: 'Rice used straight away at the Kitchen' }).check()
  await page.screenshot({ path: SHOTS + '19-used-straight-away.png' })
  await moveSheet.getByRole('button', { name: 'Move 1 item to Kitchen (1 used)' }).click()
  await moveSheet.waitFor({ state: 'hidden' })
  await waitFor(async () => (await areaFigures(ownerToken, rice.id)).Store === before.Store - 1, 'the Store to give 1')
  const at = await areaFigures(ownerToken, rice.id)
  assert(at.Kitchen === before.Kitchen, `the Kitchen went from ${before.Kitchen} to ${at.Kitchen}`)
})

await check('an area\'s Edit asks what happens there in words, and the row says the new answer', async () => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${UI}/app/company/branches`)
  const areas = page.getByRole('region', { name: `Areas at ${branchName}` })
  await areas.getByRole('button', { name: 'Edit Bar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit Bar' })
  await sheet.getByText('If a count finds less, it\'s recorded as used').waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: SHOTS + '20-what-happens-here.png' })
  await sheet.getByLabel(/Stock is kept here/).check()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await sheet.waitFor({ state: 'hidden' })
  await areas.locator('[data-area="Bar"]').getByText('stock is kept here').waitFor()
  await page.screenshot({ path: SHOTS + '21-branches-rows.png' })

  // The same on a phone: the rows, then the panel from the bottom.
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(`${UI}/app/company/branches`)
  await areas.locator('[data-area="Bar"]').waitFor()
  await areas.locator('[data-area="Kitchen"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: SHOTS + '22-phone-branches-rows.png' })
  await areas.getByRole('button', { name: 'Edit Kitchen' }).click()
  await page.getByRole('dialog', { name: 'Edit Kitchen' }).waitFor()
  await page.waitForTimeout(400)
  await page.screenshot({ path: SHOTS + '23-phone-what-happens-here.png' })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 900 })
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
  await sheet.getByLabel('What happens at Front desk').waitFor()
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
