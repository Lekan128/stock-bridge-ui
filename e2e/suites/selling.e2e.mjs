// End-to-end checks for selling Phase 3 (SELLING_PRICE_PLAN.md §5, §6.4–§6.6): the switch and where it
// is offered, the selling price on a product, the list, the old-price review - and that a company
// with selling off sees exactly what it saw before. Production preview (4173) + real API (8081).
import { chromium } from 'playwright'
import { API, UI, launchOptions, psqlCommand, shotsPrefix } from '../config.mjs'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const SHOTS = shotsPrefix('selling')
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
/** axe (WCAG 2.2 A/AA) on what is on screen now; the a11y suite never reaches these screens. */
async function axeClean(pg, label) {
  await pg.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
  await pg.addScriptTag({ path: AXE })
  const violations = await pg.evaluate(async () =>
    (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }))
      .violations.map((v) => `${v.id} ×${v.nodes.length}`))
  if (violations.length) throw new Error(`axe on ${label}: ${violations.join(', ')}`)
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
/** "Priced per": segmented buttons when the unit names are short, a select when they are not. */
async function pricePerCarton(pg) {
  const group = pg.getByRole('group', { name: 'Priced per' })
  if (await group.count()) return group.getByRole('button', { name: /Carton/ }).click()
  const select = pg.getByLabel('Priced per')
  const label = await select.evaluate((el) => [...el.options].find((o) => /Carton/i.test(o.text))?.value)
  await select.selectOption(label)
}
const sql = (statement) => execSync(psqlCommand, { input: statement }).toString().trim()

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

async function company(label) {
  const unique = randomUUID().slice(0, 8)
  const signup = (
    await api('/api/clients/signup', {
      method: 'POST',
      body: {
        name: `E2E Selling ${label} ${unique}`,
        adminEmail: `selling-${label.toLowerCase()}-${unique}@example.com`,
        password: 'correct-horse-battery-staple',
        confirmPassword: 'correct-horse-battery-staple',
      },
    })
  ).json
  return { unique, token: signup.tokens.accessToken, refreshToken: signup.tokens.refreshToken }
}
async function createProduct(shop, name, extra = {}, opening = 0) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `SL-${name.replace(/\W+/g, '').slice(0, 8)}-${shop.unique}`, unitOfMeasure: 'PIECE', packagingUnit: 'CARTON', packagingSize: 24, ...extra })], { type: 'application/json' }))
  const product = (await api('/api/products', { token: shop.token, method: 'POST', body: form })).json
  if (opening) await api(`/api/products/${product.id}/stock/stock-in`, { token: shop.token, method: 'POST', body: { quantity: opening, unitPrice: 175 } })
  return product
}
async function pageFor(shop, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(
    ([rt]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('__seeded', '1')
      }
    },
    [shop.refreshToken],
  )
  return { context, page: await context.newPage() }
}

browser = await chromium.launch(launchOptions)

// ------------------------------------------------------------------------------------- off
const off = await company('Off')
const offMilk = await createProduct(off, 'Milk (off)', {}, 48)
const { page: offPage } = await pageFor(off)

await check('selling off: no price field, column, row or filter anywhere - the screens are as they were', async () => {
  await offPage.goto(`${UI}/app/products/new`)
  await offPage.getByRole('heading', { name: 'Add product' }).waitFor()
  await offPage.getByLabel('Name').waitFor()
  assert((await offPage.getByRole('heading', { name: 'Selling' }).count()) === 0, 'a Selling section on the form')
  assert((await offPage.getByLabel(/Selling price/).count()) === 0, 'a selling price field')
  await offPage.goto(`${UI}/app/products`)
  await offPage.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  await offPage.getByRole('link', { name: offMilk.name }).first().waitFor()
  assert((await offPage.getByRole('columnheader', { name: /Selling price/ }).count()) === 0, 'a Selling price column')
  await offPage.getByRole('button', { name: 'Filters' }).click()
  assert((await offPage.getByText('Selling price', { exact: true }).count()) === 0, 'a price filter')
  await offPage.keyboard.press('Escape')
  assert((await offPage.locator('[data-stock-worth]').count()) === 0, 'a stock worth line')
  await offPage.goto(`${UI}/app/products/${offMilk.id}`)
  await offPage.getByRole('heading', { name: offMilk.name, level: 1 }).waitFor()
  assert((await offPage.getByText('Selling price').count()) === 0, 'a selling price on the product page')
})

await check('the first-week question is asked once; "We use it" is remembered and changes nothing else', async () => {
  await offPage.goto(`${UI}/app`)
  const question = offPage.locator('[data-stock-use-question]')
  await question.waitFor()
  await question.getByRole('button', { name: 'We use it to make or serve things' }).click()
  await question.waitFor({ state: 'detached' })
  const settings = (await api('/api/company/selling', { token: off.token })).json
  assert(settings.stockUse === 'USE' && settings.sellsStock === false, JSON.stringify(settings))
  await offPage.reload()
  await offPage.getByRole('region', { name: 'Set up your shop' }).waitFor()
  assert((await question.count()) === 0, 'asked again')
})

await check('picking Sold on a stock-out offers the owner selling, once; one tap turns it on and asks the price', async () => {
  await offPage.goto(`${UI}/app/products/${offMilk.id}`)
  await offPage.getByRole('heading', { name: offMilk.name, level: 1 }).waitFor()
  await offPage.getByRole('button', { name: 'Stock out' }).click()
  const dialog = offPage.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Add a reason' }).click()
  await dialog.getByRole('radio', { name: 'Sold' }).click()
  await dialog.locator('[data-selling-offer]').waitFor()
  await offPage.screenshot({ path: SHOTS + '1-offer.png' })
  await dialog.getByRole('button', { name: 'Turn on selling' }).click()
  const price = dialog.getByLabel(/Price each/)
  await price.waitFor()
  await dialog.getByLabel('Quantity').fill('2')
  await price.fill('300')
  await dialog.getByText('₦600').waitFor()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.locator('[data-receipt="synced"]').waitFor()
  await dialog.getByText('Sold for').waitFor()
  await dialog.getByRole('button', { name: 'Done' }).click()
  const history = (await api(`/api/products/${offMilk.id}/stock/history?size=5&sort=createdAt,desc`, { token: off.token })).json.content
  const sale = history.find((m) => m.movementType === 'OUT')
  assert(sale.outReason === 'SALE' && sale.saleAmount === 600, JSON.stringify(sale))
  const settings = (await api('/api/company/selling', { token: off.token })).json
  assert(settings.sellsStock === true && settings.changedVia === 'IN_CONTEXT', JSON.stringify(settings))
})

// -------------------------------------------------------------------------------------- on
const shop = await company('On')
const { page } = await pageFor(shop)
await page.goto(`${UI}/app/company`)
await page.getByRole('heading', { name: 'Company settings' }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 }).catch(() => {})

await check('the switch acts at once; off has an Undo that puts it back', async () => {
  const toggle = page.getByRole('switch', { name: 'Sell from your stock' })
  await toggle.waitFor()
  assert((await toggle.getAttribute('aria-checked')) === 'false', 'not off to begin with')
  await toggle.click()
  await page.getByText('Selling is on.').first().waitFor()
  assert((await toggle.getAttribute('aria-checked')) === 'true', 'did not turn on')
  await toggle.click()
  const undoToast = page.getByRole('status').filter({ hasText: 'Selling is hidden' })
  await undoToast.waitFor()
  await undoToast.getByRole('button', { name: 'Undo' }).click()
  await page.waitForFunction(() => document.querySelector('[role="switch"]')?.getAttribute('aria-checked') === 'true')
  await page.getByText(/Turned on by/).waitFor()
  await page.screenshot({ path: SHOTS + '2-company.png' })
  await axeClean(page, 'the company page with the selling switch')
})

let milk
await check('a price typed per carton is kept as typed, echoed per piece, with the profit in naira', async () => {
  // Made through the API with its pack and a delivery at 175 a piece; priced on the form.
  milk = await createProduct(shop, `Peak Milk (sl) ${shop.unique}`, {}, 48)
  await page.goto(`${UI}/app/products/${milk.id}/edit`)
  const priceBox = page.getByLabel(/Selling price/)
  await priceBox.waitFor()
  await pricePerCarton(page)
  await priceBox.fill('5000')
  const echo = page.locator('[data-price-echo]')
  await echo.getByText('₦208.33 a piece').waitFor()
  // 24 × 175 = 4,200 a carton bought; 5,000 sold.
  await echo.getByText('₦800 profit a carton').waitFor()
  await page.screenshot({ path: SHOTS + '3-form.png' })
  await axeClean(page, 'the product form with its Selling section')
  await page.getByRole('button', { name: /Save/ }).click()
  await page.waitForURL(/\/app\/products\/[0-9a-f-]{36}$/)
  await page.getByText('₦5,000 / carton').first().waitFor()
  await page.getByText('₦208.33 / piece').waitFor()
  const saved = (await api(`/api/products/${milk.id}`, { token: shop.token })).json
  assert(saved.unitPriceEntered === 5000 && saved.unitPriceEnteredUnit === 'CARTON' && saved.unitPrice === 208.33, JSON.stringify(saved))
})

await check('the edit form reopens it as typed, and a change shows in the price history', async () => {
  await page.goto(`${UI}/app/products/${milk.id}/edit`)
  const priceBox = page.getByLabel(/Selling price \(₦ per carton/)
  await priceBox.waitFor()
  assert((await priceBox.inputValue()) === '5000', `reopened as ${await priceBox.inputValue()}`)
  await priceBox.fill('5200')
  await page.getByRole('button', { name: /Save/ }).click()
  await page.waitForURL(/\/app\/products\/[0-9a-f-]{36}$/)
  await page.getByText('₦5,200 / carton').first().waitFor()
  await page.getByRole('button', { name: 'Price history' }).click()
  await page.getByText(/₦5,000 \/ carton → ₦5,200 \/ carton/).waitFor()
})

await check('the inventory shows the price and narrows to products with no selling price', async () => {
  await createProduct(shop, 'Gas (sl)')
  await page.goto(`${UI}/app/products`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  await page.getByRole('columnheader', { name: /Selling price/ }).waitFor()
  await page.getByRole('cell', { name: '₦5,200 / carton' }).waitFor()
  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByRole('button', { name: /No selling price/ }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Gas (sl)' }).first().waitFor()
  await page.waitForFunction(() => !document.body.innerText.includes('Peak Milk (sl)'))
  await page.screenshot({ path: SHOTS + '4-list.png' })
})

await check('old prices wait for the owner to choose; the ticked one becomes a selling price', async () => {
  const oldA = await createProduct(shop, 'Old A (sl)')
  const oldB = await createProduct(shop, 'Old B (sl)')
  sql(`UPDATE products SET legacy_unit_price = 950 WHERE id = '${oldA.id}'; UPDATE products SET legacy_unit_price = 175 WHERE id = '${oldB.id}';`)
  await page.goto(`${UI}/app/company`)
  await page.getByRole('button', { name: 'Check old prices' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Old prices' })
  await sheet.getByText('Old A (sl)').waitFor()
  await sheet.getByRole('checkbox').first().waitFor()
  await sheet.locator('label').filter({ hasText: 'Old A (sl)' }).getByRole('checkbox').check()
  await page.screenshot({ path: SHOTS + '5-review.png' })
  await axeClean(page, 'the old-price review')
  await sheet.getByRole('button', { name: /^Use 1 as selling price$/ }).click()
  await sheet.waitFor({ state: 'detached' })
  assert((await api(`/api/products/${oldA.id}`, { token: shop.token })).json.unitPrice === 950, 'Old A not priced')
  assert((await api(`/api/products/${oldB.id}`, { token: shop.token })).json.unitPrice == null, 'Old B priced without being chosen')
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
