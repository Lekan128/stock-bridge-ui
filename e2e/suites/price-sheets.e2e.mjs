// End-to-end checks for selling Phase 5 (SELLING_PRICE_PLAN.md §5.3, §6.7, §6.8): a bare "Price" column
// is asked about and the file waits; a sheet's selling prices are offered to an owner whose company does
// not sell yet; below cost is a warning in the grid; "Add prices in a sheet" downloads what has no
// price; and a delivery that now costs more than the price says so, on the receipt and on the result.
// Production preview (4173) + real API (8081).
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const SHOTS = shotsPrefix('price-sheets')
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

const unique = randomUUID().slice(0, 8)
const signup = (
  await api('/api/clients/signup', {
    method: 'POST',
    body: { name: `E2E Price Sheets ${unique}`, adminEmail: `price-sheets-${unique}@example.com`, password: PASSWORD, confirmPassword: PASSWORD },
  })
).json
const token = signup.tokens.accessToken
const sku = (name) => `PS-${name}-${unique}`
const product = async (code) =>
  (await api(`/api/products?search=${encodeURIComponent(code)}&size=5`, { token })).json.content.find((p) => p.sku === code)
const sellingOn = async () => (await api('/api/company/selling', { token })).json.sellsStock === true

browser = await chromium.launch(launchOptions)
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
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

/** Upload a CSV on Bulk upload and land on its review. */
async function upload(kind, csv, name = 'sheet.csv') {
  await page.goto(`${UI}/app/products/import/new?kind=${kind}`)
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await page.getByRole('button', { name: 'Upload and check it' }).click()
  await page.waitForURL(/\/app\/products\/import\/[0-9a-f-]{36}$/)
}
/** Continue → confirm → the result page. */
async function importIt() {
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.waitForURL(/\/confirm$/)
  await page.getByRole('button', { name: /^(Add|Update|Import|Record)/ }).last().click()
  await page.waitForURL(/\/result/)
}

await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()

await check('a bare "Price" column is asked about, Continue waits, and "What we pay" imports it as the cost', async () => {
  await upload('PRODUCT_CATALOG', `Product name,Your code,Price\nBeans (ps),${sku('BEANS')},1200\nGarri (ps),${sku('GARRI')},800\n`)
  const question = page.getByRole('region', { name: /Is “Price” what you pay, or what you sell for\?/ })
  await question.waitFor()
  await question.getByText('1200 · 800').waitFor()
  assert(await page.getByRole('button', { name: /^Continue/ }).isDisabled(), 'Continue live with the question open')
  await page.getByText('Answer the question about your price column above').waitFor()
  await page.screenshot({ path: SHOTS + '1-question.png' })
  await axeClean(page, 'price question')
  await question.getByRole('button', { name: 'What we pay' }).click()
  await question.waitFor({ state: 'detached' })
  await importIt()
  const beans = await product(sku('BEANS'))
  assert(beans.costPrice === 1200 && beans.unitPrice == null, `beans: cost ${beans.costPrice}, price ${beans.unitPrice}`)
})

await check('a sheet\'s selling prices are offered to the owner; keeping them turns selling on', async () => {
  assert(!(await sellingOn()), 'selling already on')
  await upload('PRODUCT_CATALOG', `Product name,Your code,Selling price\nSoap (ps),${sku('SOAP')},350\n`)
  const offer = page.getByRole('region', { name: 'Your sheet has selling prices. Keep them?' })
  await offer.waitFor()
  await offer.getByRole('button', { name: 'Keep prices and turn on selling' }).click()
  await page.getByText('Selling is on. These prices will be kept.').waitFor()
  await importIt()
  assert(await sellingOn(), 'selling not on')
  assert((await product(sku('SOAP'))).unitPrice === 350, 'soap price not kept')
})

await check('selling below cost is a warning in the grid, with both figures, and does not block', async () => {
  await upload('PRODUCT_CATALOG',
    `Product name,Your code,Comes in,Size of one,Price you pay for one,Selling price for one\nOil keg (ps),${sku('OIL')},Keg,25 l,52000,48000\n`)
  await page.getByText(/less than the ₦52,000 a keg you pay/).first().waitFor()
  assert(!(await page.getByRole('button', { name: /^Continue/ }).isDisabled()), 'a warning blocked Continue')
  await page.screenshot({ path: SHOTS + '2-below-cost.png' })
  await importIt()
  const oil = await product(sku('OIL'))
  assert(oil.unitPriceEntered === 48000 && oil.unitPriceEnteredUnit === 'KEG', `oil: ${oil.unitPriceEntered} ${oil.unitPriceEnteredUnit}`)
})

await check('"Add prices in a sheet" downloads the products that have no price', async () => {
  await page.goto(`${UI}/app/products?price=none`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Fill them in a sheet' }).click()])
  assert(download.suggestedFilename() === 'selling-prices.xlsx', download.suggestedFilename())
  await page.getByText(/Price sheet downloaded/).waitFor()
})

await check('a delivery that now costs more than the price says so on the receipt, with Update price', async () => {
  const oil = await product(sku('OIL'))
  await page.goto(`${UI}/app/products/${oil.id}`)
  await page.getByRole('heading', { name: oil.name, level: 1 }).waitFor()
  const dialog = page.getByRole('dialog')
  await page.getByRole('button', { name: 'Stock in' }).first().click()
  await dialog.getByLabel('Quantity').fill('1')
  await dialog.getByRole('button', { name: /More details/ }).click()
  await dialog.getByLabel(/Unit price/).fill('50000')
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  const nudge = dialog.locator('[data-price-nudge]')
  await nudge.getByText('You now pay ₦50,000 a keg and sell at ₦48,000.').waitFor()
  await nudge.getByRole('link', { name: 'Update price' }).waitFor()
  await page.screenshot({ path: SHOTS + '3-receipt-nudge.png' })
  await dialog.getByRole('button', { name: 'Done' }).click()
})

await check('a delivery sheet\'s result lists the products to check, and leaves their prices alone', async () => {
  await upload('STOCK_IN', `Product,Your code,Comes in,How many arrived,Price paid for one\nOil keg (ps),${sku('OIL')},Keg,2,53000\n`)
  await importIt()
  const section = page.getByRole('region', { name: 'Check your prices' })
  await section.waitFor()
  await section.getByText(/you now pay ₦53,000 a keg and sell at ₦48,000/).waitFor()
  await page.screenshot({ path: SHOTS + '4-check-prices.png' })
  await axeClean(page, 'result with prices to check')
  assert((await product(sku('OIL'))).unitPriceEntered === 48000, 'a delivery changed the selling price')
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
