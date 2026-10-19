// End-to-end checks for selling Phase 4 (SELLING_PRICE_PLAN.md §6.1-§6.3): Record a sale - the basket,
// scanning, prices changed at the till, receipts, Undo sale, offline sales and an oversold line -
// quick mode's Sell and its till total, the product page's Sell, and the word to staff.
// Production preview (4173) + real API (8081).
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const SHOTS = shotsPrefix('sales')
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
const ownerName = `sales-${unique}@example.com`
const signup = (
  await api('/api/clients/signup', {
    method: 'POST',
    body: { name: `E2E Sales ${unique}`, adminEmail: ownerName, password: PASSWORD, confirmPassword: PASSWORD },
  })
).json
const token = signup.tokens.accessToken
const me = (await api('/api/me', { token })).json
const clientIdentifier = me.client?.identifier ?? me.tenant?.identifier ?? me.clientIdentifier
await api('/api/company/selling', { token, method: 'PUT', body: { sellsStock: true, source: 'OWNER' } })

async function createProduct(name, extra = {}, opening = 0) {
  const sku = `SA-${name.replace(/\W+/g, '').slice(0, 8)}-${unique}`
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku, unitOfMeasure: 'PIECE', ...extra })], { type: 'application/json' }))
  const product = (await api('/api/products', { token, method: 'POST', body: form })).json
  if (!product?.id) throw new Error(`product ${name}: ${JSON.stringify(product).slice(0, 200)}`)
  if (opening) await api(`/api/products/${product.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: opening, unitPrice: 100 } })
  return product
}
const onHand = async (id) => (await api(`/api/products/${id}`, { token })).json.quantityOnHand
/** The product's sale lines, newest first. */
const saleLines = async (id) =>
  (await api(`/api/products/${id}/stock/history?size=50&sort=createdAt,desc`, { token })).json.content.filter(
    (m) => m.movementType === 'OUT' && m.saleId,
  )
async function eventually(read, ok, seconds = 40) {
  let got
  for (let i = 0; i < seconds * 2; i++) {
    got = await read()
    if (ok(got)) return got
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`never settled: ${JSON.stringify(got).slice(0, 300)}`)
}

async function phone(refreshToken, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(
    ([rt]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('__seeded', '1')
      }
    },
    [refreshToken],
  )
  return { context, page: await context.newPage() }
}
async function goOffline(context, page) {
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
}
async function goOnline(context, page) {
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
}

const rice = await createProduct('Rice (sa)', { unitPrice: 2000 }, 100)
const soap = await createProduct('Soap (sa)', { unitPrice: 350 }, 100)
const oil = await createProduct('Oil (sa)', {}, 100)
const salt = await createProduct('Salt (sa)', { unitPrice: 150 }, 100)
const sugar = await createProduct('Sugar (sa)', { unitPrice: 900 }, 100)
const milk = await createProduct('Milk (sa)', { unitPrice: 500 }, 1)

browser = await chromium.launch(launchOptions)
const { context, page } = await phone(signup.tokens.refreshToken)
const search = () => page.getByLabel('Scan or search a product')
const basket = () => page.getByRole('list', { name: 'This sale' })
const line = (product) => basket().locator('li').filter({ hasText: product.name })
/** Types like a barcode scanner: the SKU in a burst, then Enter. */
async function scan(product) {
  await search().click()
  await page.keyboard.type(product.sku, { delay: 5 })
  await page.keyboard.press('Enter')
}

await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 }).catch(() => {})

await check('Record a sale is the Inventory\'s action once selling is on, and opens an empty basket', async () => {
  await page.getByRole('button', { name: 'Record a sale' }).first().click()
  await page.getByRole('heading', { name: 'Record a sale', level: 1 }).waitFor()
  await page.getByText('Scan or search to add the first item.').waitFor()
  await axeClean(page, 'empty basket')
})

await check('a scanner runs a basket: scanning again adds one; a changed price shows the usual one quietly; the total is announced', async () => {
  await scan(rice)
  await line(rice).waitFor()
  await scan(rice)
  await line(rice).getByText('2 pieces × ₦2,000').waitFor()
  await scan(soap)
  await line(soap).waitFor()
  // Soap opened as the newest line: sell it for less.
  await page.getByLabel(/Price each/).fill('300')
  await line(soap).getByText('(usual ₦350)').waitFor()
  const live = page.locator('[aria-live="polite"]').filter({ hasText: 'items,' })
  await live.getByText('2 items, ₦4,300').waitFor()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: SHOTS + '1-basket.png' })
  // Nothing about what the stock cost, ever: the customer can see this screen.
  const text = await page.locator('body').innerText()
  assert(!/cost|profit|margin/i.test(text), `cost or profit on the till: ${text.match(/.{0,30}(cost|profit|margin).{0,30}/i)?.[0]}`)
  await axeClean(page, 'basket')
})

let firstSaleId
await check('one button records the lot as one sale; the receipt lists it and lands SYNCED', async () => {
  await page.getByRole('button', { name: 'Record sale ₦4,300' }).click()
  await page.locator('[data-receipt="synced"]').waitFor()
  await page.getByText('Rice (sa)').waitFor()
  await page.screenshot({ path: SHOTS + '2-receipt.png' })
  await axeClean(page, 'receipt')
  const [riceLine] = await saleLines(rice.id)
  const [soapLine] = await saleLines(soap.id)
  assert(riceLine.saleId === soapLine.saleId, 'two sale ids for one sale')
  assert(riceLine.saleAmount === 4000 && soapLine.saleAmount === 300, `amounts ${riceLine.saleAmount} ${soapLine.saleAmount}`)
  firstSaleId = riceLine.saleId
  const sale = (await api(`/api/sales/${firstSaleId}`, { token })).json
  assert(sale && (sale.lines?.length ?? 0) === 2, `sale: ${JSON.stringify(sale).slice(0, 200)}`)
})

await check('Undo sale takes the whole sale back', async () => {
  await page.getByRole('button', { name: 'Undo sale' }).click()
  await page.getByText('Sale undone.').waitFor()
  await eventually(() => onHand(rice.id), (n) => n === 100)
  assert((await onHand(soap.id)) === 100, 'soap not put back')
})

await check('an unpriced item asks once before the sale is recorded without its price', async () => {
  await page.getByText('Scan or search to add the first item.').waitFor()
  await scan(oil)
  await line(oil).getByText('Add price').waitFor()
  await page.getByRole('button', { name: /^Record sale/ }).click()
  await page.getByRole('alert').getByText('Oil (sa) has no price.').waitFor()
  await page.getByRole('button', { name: 'Record without a price' }).click()
  await page.locator('[data-receipt="synced"]').waitFor()
  const [oilLine] = await saleLines(oil.id)
  assert(oilLine && oilLine.saleAmount == null, `oil: ${JSON.stringify(oilLine)}`)
  await page.getByRole('button', { name: 'New sale' }).click()
})

await check('the basket is kept on the phone: a reload brings the customer\'s items back', async () => {
  await scan(salt)
  await line(salt).waitFor()
  await page.waitForTimeout(800)
  await page.reload()
  await line(salt).waitFor()
  await line(salt).getByRole('button').first().click()
  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByText('Salt (sa) taken off the sale.').waitFor()
})

await check('offline: a five-item sale is RECORDED on the phone, then lands as one sale whose total matches', async () => {
  await goOffline(context, page)
  for (const product of [rice, soap, salt, sugar, oil]) {
    await scan(product)
    await line(product).waitFor()
  }
  // Rice 2,000 + Soap 350 + Salt 150 + Sugar 900, and Oil with no price.
  await page.getByRole('button', { name: 'Record sale ₦3,400' }).click()
  await page.getByRole('button', { name: 'Record without a price' }).click()
  await page.locator('[data-receipt="recorded"]').waitFor()
  await page.screenshot({ path: SHOTS + '3-offline-receipt.png' })
  await goOnline(context, page)
  const lines = await eventually(
    async () => (await Promise.all([rice, soap, salt, sugar, oil].map(async (p) => (await saleLines(p.id))[0]))),
    (all) => all.every(Boolean) && new Set(all.map((l) => l.saleId)).size === 1 && all[0].saleId !== firstSaleId,
  )
  const total = lines.reduce((sum, l) => sum + (l.saleAmount ?? 0), 0)
  assert(total === 3400, `server total ${total}`)
  await page.getByRole('button', { name: 'New sale' }).click()
})

await check('online, an oversold line is refused and stays in the basket saying why; the rest of the sale lands', async () => {
  await scan(sugar)
  await scan(milk)
  await line(milk).waitFor()
  await page.getByLabel('How many Milk (sa)').fill('3')
  await page.getByRole('button', { name: /^Record sale/ }).click()
  await page.getByText(/Milk \(sa\) was not recorded/).waitFor()
  await page.getByRole('button', { name: 'Back to the basket' }).click()
  await line(milk).getByText(/Not recorded:/).waitFor()
  assert((await basket().locator('li').count()) === 1, 'more than the refused line left in the basket')
  assert((await onHand(milk.id)) === 1, 'milk taken anyway')
  await line(milk).getByRole('button').first().click()
  await page.getByRole('button', { name: 'Remove' }).click()
})

await check('offline, an oversold line comes back as CHECK naming the sale it was part of; the others land', async () => {
  const before = await onHand(sugar.id)
  await goOffline(context, page)
  await scan(sugar)
  await scan(milk)
  await line(milk).waitFor()
  await page.getByLabel('How many Milk (sa)').fill('4')
  await page.getByRole('button', { name: /^Record sale/ }).click()
  await page.locator('[data-receipt="recorded"]').waitFor()
  await goOnline(context, page)
  await eventually(() => onHand(sugar.id), (n) => n === before - 1)
  await page.getByRole('button', { name: /1 needs you/ }).first().waitFor({ timeout: 40000 })
  await page.getByRole('button', { name: /1 needs you/ }).first().click()
  await page.getByText(/part of the .* sale \(2 items\)/).first().waitFor()
  await page.keyboard.press('Escape')
  assert((await onHand(milk.id)) === 1, 'milk oversold')
})

await check('the product page has Sell, leading for a priced product, opening the basket with it', async () => {
  await page.goto(`${UI}/app/products/${soap.id}`)
  await page.getByRole('heading', { name: soap.name, level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Sell' }).first().click()
  await page.getByRole('heading', { name: 'Record a sale', level: 1 }).waitFor()
  // It arrives open, ready for its quantity and price.
  await line(soap).locator('[aria-expanded="true"]').waitFor()
  await page.getByRole('button', { name: 'Remove' }).click()
})

await check('quick mode Sell: big targets, a stamp per sale, and "Your sales today" from the server', async () => {
  await page.goto(`${UI}/app/quick?mode=sell`)
  await page.getByRole('heading', { name: 'Quick mode' }).waitFor()
  await page.getByRole('button', { name: 'Sell', exact: true }).waitFor()
  await page.getByText('Your sales today:').waitFor()
  await scan(salt)
  await line(salt).waitFor()
  for (const name of ['More Salt (sa)', 'Fewer Salt (sa)']) {
    const box = await page.getByRole('button', { name }).boundingBox()
    assert(box.width >= 44 && box.height >= 44, `${name} is ${box.width}×${box.height}`)
  }
  await page.getByRole('button', { name: 'More Salt (sa)' }).click()
  await page.getByRole('button', { name: 'Record sale ₦300' }).click()
  await page.getByText('Sale · 1 item · ₦300').waitFor()
  const mine = (await api('/api/sales/mine/summary', { token })).json
  await page.getByText(new RegExp(`Your sales today: ${mine.saleCount} · `)).waitFor({ timeout: 10000 })
  // The refused line waiting in CHECK is not "waiting to send": it needs the person, not the network.
  assert((await page.getByText('waiting to send').count()) === 0, 'a refused line counted as waiting')
  assert(mine.costAmount === undefined && mine.grossProfit === undefined, 'cost in the till total')
  await page.getByRole('button', { name: 'Stock out', exact: true }).click()
  await page.getByText('For a customer, use Sell.').waitFor()
  await page.screenshot({ path: SHOTS + '4-quick-sell.png' })
})

await check('staff are told once that sales are recorded now; the owner who turned it on is not', async () => {
  assert((await page.goto(`${UI}/app/products`), await page.getByText('Your company now records sales.').count()) === 0, 'owner told')
  const role = (await api('/api/roles', { token, method: 'POST', body: { name: `Cashier ${unique}`, permissionCodes: ['VIEW_PRODUCTS', 'STOCK_OUT'] } })).json
  const username = `cashier-${unique}`
  const created = await api('/api/users', { token, method: 'POST', body: { username, password: PASSWORD, roleId: role.id } })
  assert(created.status < 300, `user: ${created.status}`)
  const login = (await api('/api/auth/login', { method: 'POST', body: { clientIdentifier, username, password: PASSWORD } })).json
  const staff = await phone(login.tokens.refreshToken)
  await staff.page.goto(`${UI}/app/products`)
  await staff.page.getByText('Your company now records sales.').waitFor()
  await axeClean(staff.page, 'staff notice')
  await staff.page.getByRole('button', { name: 'Got it' }).click()
  await staff.page.reload()
  await staff.page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  await staff.page.waitForTimeout(1000)
  assert((await staff.page.getByText('Your company now records sales.').count()) === 0, 'told twice')
  await staff.context.close()
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
