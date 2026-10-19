// End-to-end checks for selling Phase 6 (SELLING_PRICE_PLAN.md §6.6, §6.9-§6.11): the Sales page against
// hand-worked figures - today's list, the gaps sentence, a breakdown whose footer equals its rows, the
// leak filters, Add price and Cancel sale on a sale, export - and the same sales on the dashboard, the
// Movements card and the product page. Production preview (4173) + real API (8081).
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const SHOTS = shotsPrefix('sales-report')
const PASSWORD = 'correct-horse-battery-staple'
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
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
const naira = (n) => `₦${n.toLocaleString('en-NG')}`

async function company(label, selling) {
  const unique = randomUUID().slice(0, 8)
  const signup = (
    await api('/api/clients/signup', {
      method: 'POST',
      body: { name: `E2E Report ${label} ${unique}`, adminEmail: `report-${label.toLowerCase()}-${unique}@example.com`, password: PASSWORD, confirmPassword: PASSWORD },
    })
  ).json
  const token = signup.tokens.accessToken
  if (selling) await api('/api/company/selling', { token, method: 'PUT', body: { sellsStock: true, source: 'OWNER' } })
  return { unique, token, refreshToken: signup.tokens.refreshToken }
}
async function product(shop, name, price, cost) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `SR-${name.replace(/\W+/g, '')}-${shop.unique}`, unitOfMeasure: 'PIECE', ...(price ? { unitPrice: price } : {}) })], { type: 'application/json' }))
  const created = (await api('/api/products', { token: shop.token, method: 'POST', body: form })).json
  await api(`/api/products/${created.id}/stock/stock-in`, { token: shop.token, method: 'POST', body: { quantity: 100, unitPrice: cost } })
  return created
}
async function sell(shop, saleId, item, quantity, unitPrice) {
  const res = await api(`/api/products/${item.id}/stock/stock-out`, {
    token: shop.token,
    method: 'POST',
    body: { quantity, reason: 'SALE', saleId, ...(unitPrice != null ? { unitPrice } : {}) },
  })
  assert(res.status < 300, `sell ${item.name}: ${res.status} ${JSON.stringify(res.json)}`)
}

// ---------------------------------------------------------------- the hand-worked day
// Rice: price 2,000, cost 1,500. Soap: price 350, cost 200. Oil: no price, cost 1,000.
//   Sale 1: 2 rice at 2,000 + 1 soap at 350 ......... 4,350  (profit 1,000 + 150)
//   Sale 2: 3 soap at 300 (below the usual 350) ......   900  (profit 300)
//   Sale 3: 1 oil, no price ..........................     -
//   Sale 4: 1 rice at 2,000 ..........................  2,000  (profit 500)
//   Used:   1 soap (not a sale), at its cost .........   200 other stock out
// Sales 7,250 · 4 sales · profit 1,950; profit leaves out 1 sale (no price).
const shop = await company('On', true)
const rice = await product(shop, 'Rice (sr)', 2000, 1500)
const soap = await product(shop, 'Soap (sr)', 350, 200)
const oil = await product(shop, 'Oil (sr)', null, 1000)
const s1 = randomUUID()
await sell(shop, s1, rice, 2, 2000)
await sell(shop, s1, soap, 1, 350)
await sell(shop, randomUUID(), soap, 3, 300)
await sell(shop, randomUUID(), oil, 1, null)
const s4 = randomUUID()
await sell(shop, s4, rice, 1, 2000)
await api(`/api/products/${soap.id}/stock/stock-out`, { token: shop.token, method: 'POST', body: { quantity: 1, reason: 'USED' } })

browser = await chromium.launch(launchOptions)
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
await context.addInitScript(
  ([rt]) => {
    if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('sb.refreshToken', rt)
      localStorage.setItem('__seeded', '1')
    }
  },
  [shop.refreshToken],
)
const page = await context.newPage()
const total = () => page.locator('[data-sales-total]')

await check('Sales is in the nav, and today reads 7,250 from 4 sales with 1,950 profit and the one gap said once', async () => {
  await page.goto(`${UI}/app/products`)
  await page.getByRole('link', { name: 'Sales', exact: true }).click()
  await page.getByRole('heading', { name: 'Sales', level: 1 }).waitFor()
  await total().getByText(naira(7250)).waitFor()
  await page.getByText(`4 sales · ${naira(1950)} profit`).waitFor()
  await page.getByText('Profit leaves out 1 sale: 1 has no price.').waitFor()
  const list = page.getByRole('list', { name: 'Sales' })
  await list.getByText('Rice (sr), Soap (sr)').waitFor()
  assert((await list.locator('li').count()) === 4, `rows: ${await list.locator('li').count()}`)
  await page.screenshot({ path: SHOTS + '1-today.png' })
  await axeClean(page, 'sales today')
})

await check('By product: the footer is the server\'s, and equals the rows above it', async () => {
  await page.getByRole('tab', { name: 'By product' }).click()
  const table = page.locator('table')
  await table.getByText('Rice (sr)').waitFor()
  const cells = await table.locator('tbody tr').evaluateAll((rows) =>
    rows.map((row) => Number(row.querySelectorAll('td')[1].textContent.replace(/[^\d.]/g, ''))))
  const sum = cells.reduce((a, b) => a + b, 0)
  const footer = Number((await table.locator('tfoot td').nth(1).textContent()).replace(/[^\d.]/g, ''))
  assert(sum === 7250 && footer === 7250, `rows ${sum}, footer ${footer}`)
  await page.screenshot({ path: SHOTS + '2-by-product.png' })
  await axeClean(page, 'by product')
  await page.getByRole('tab', { name: 'Sales', exact: true }).click()
})

await check('a leak filter narrows to its lines: one sold below the usual price', async () => {
  const chip = page.getByRole('button', { name: /Sold below usual price/ })
  await chip.getByText('1').waitFor()
  await chip.click()
  await total().getByText(naira(7250)).waitFor() // the headline stays the day's
  const list = page.getByRole('list', { name: 'Sales' })
  await list.getByText('Soap (sr)', { exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll('ul[aria-label="Sales"] li').length === 1, null, { timeout: 10000 })
  await chip.click()
})

await check('"Fix these" lists the unpriced sale; adding its price lifts the total and the profit', async () => {
  await page.getByRole('button', { name: 'Fix these' }).click()
  const list = page.getByRole('list', { name: 'Sales' })
  await list.getByText('Oil (sr)').click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Add price' }).click()
  await sheet.getByLabel(/What it went for/).fill('1200')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await page.getByText('Price added.').waitFor()
  await sheet.getByText(naira(1200)).first().waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Show all sales' }).click()
  await total().getByText(naira(8450)).waitFor()
  await page.getByText(`4 sales · ${naira(2150)} profit`).waitFor()
})

await check('Cancel sale puts it back: struck through, with who, and off the total', async () => {
  const list = page.getByRole('list', { name: 'Sales' })
  // Sale 4 is the only rice-only sale.
  await list.locator('li').filter({ hasText: /^Rice \(sr\)/ }).filter({ hasNotText: 'Soap' }).first().click()
  const sheet = page.getByRole('dialog').first()
  await sheet.getByRole('button', { name: 'Cancel sale' }).click()
  await page.getByRole('dialog', { name: 'Cancel this sale?' }).getByRole('button', { name: 'Cancel sale' }).click()
  await page.getByText('Sale cancelled.').waitFor()
  await page.getByText(/Cancelled by /).first().waitFor()
  await page.screenshot({ path: SHOTS + '3-cancelled.png' })
  await page.keyboard.press('Escape')
  await total().getByText(naira(6450)).waitFor()
  await list.getByText('Cancelled', { exact: true }).waitFor()
  const report = (await api(`/api/sales/${s4}`, { token: shop.token })).json
  assert(report.cancelledLineCount === 1, `ledger: ${JSON.stringify(report).slice(0, 200)}`)
})

await check('Export downloads the report as a spreadsheet', async () => {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()])
  assert(download.suggestedFilename() === 'sales.xlsx', download.suggestedFilename())
})

await check('the dashboard leads with Sales today, the same figure, compared with last week', async () => {
  await page.goto(`${UI}/app`)
  const figure = page.getByRole('region', { name: 'Sales today' })
  await figure.locator('[data-sales-today]').getByText(naira(6450)).waitFor()
  await figure.getByText(/· 3 sales/).waitFor()
  await figure.getByText(/profit/).waitFor()
  await page.screenshot({ path: SHOTS + '4-dashboard.png' })
  await axeClean(page, 'dashboard with sales')
})

await check('Movements: stock out is split into sales and other stock out at cost, and they add up', async () => {
  await page.goto(`${UI}/app/stock-movements`)
  await page.getByRole('heading', { name: 'Stock movements' }).waitFor()
  // This page shows kobo ("₦6,450.00"), as all its figures do.
  await page.getByText(/₦6,450\.00 sales · ₦200\.00 other stock out/).waitFor()
  await page.getByText('₦6,650.00').first().waitFor()
  await page.getByText(/fixes to sales/).waitFor()
})

await check('the product page says what it sold this month', async () => {
  await page.goto(`${UI}/app/products/${soap.id}`)
  await page.getByRole('heading', { name: soap.name, level: 1 }).waitFor()
  await page.locator('[data-sold-this-month]').getByText(`4 pieces · ${naira(1250)}`).waitFor()
})

await check('a company that does not sell has no Sales page in its nav', async () => {
  const off = await company('Off', false)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(([rt]) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('sb.refreshToken', rt); localStorage.setItem('__seeded', '1') } }, [off.refreshToken])
  const pg = await ctx.newPage()
  await pg.goto(`${UI}/app/products`)
  await pg.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  await pg.waitForTimeout(1000)
  assert((await pg.getByRole('link', { name: 'Sales', exact: true }).count()) === 0, 'Sales in the nav')
  await ctx.close()
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
