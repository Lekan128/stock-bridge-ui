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
  // Share copies the receipt where the browser can't share (selling till Step 2).
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: UI }).catch(() => {})
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
// Priced per carton of 24: the price as typed is 5,000, per piece it is 208.333...
const peak = await createProduct('Peak (sa)', { packagingUnit: 'CARTON', packagingSize: 24, unitPrice: 5000, unitPriceUnit: 'CARTON' }, 240)

browser = await chromium.launch(launchOptions)
const { context, page } = await phone(signup.tokens.refreshToken)
const search = () => page.getByLabel('Scan or search a product')
const basket = () => page.getByRole('list', { name: 'This sale' })
const line = (product) => basket().locator('li').filter({ hasText: product.name })
/** One tap on how the customer paid (selling till Step 1), checking the amount the buttons collect. */
async function pay(method, amount) {
  await page.getByRole('group', { name: `Paid with, ${amount}` }).getByRole('button', { name: method, exact: true }).click()
}
/** The same, whatever the amount. */
async function payAny(method) {
  await page.getByRole('group', { name: /^Paid with, / }).getByRole('button', { name: method, exact: true }).click()
}
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
  await page.getByRole('list', { name: 'Tap to add' }).waitFor()
  await page.getByRole('list', { name: 'Tap to add' }).getByRole('button', { name: `Add ${rice.name}` }).waitFor()
  await axeClean(page, 'empty basket')
})

await check('a scanner runs a basket: scanning again adds one; a changed price shows the usual one quietly; the total is announced', async () => {
  await scan(rice)
  await line(rice).waitFor()
  await scan(rice)
  await eventually(() => line(rice).getByLabel(`How many ${rice.name}`).inputValue(), (v) => v === '2')
  await scan(soap)
  await line(soap).waitFor()
  // Sell soap for less: tap its price, in the line.
  await line(soap).getByRole('button', { name: /^Change price of Soap/ }).click()
  await line(soap).getByLabel('Each (₦)').fill('300')
  await line(soap).getByText('usual ₦350').waitFor()
  await page.getByText('2 items', { exact: true }).filter({ visible: true }).first().waitFor()
  await page.getByRole('group', { name: 'Paid with, ₦4,300' }).waitFor()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: SHOTS + '1-basket.png' })
  // Nothing about what the stock cost, ever: the customer can see this screen.
  const text = await page.locator('body').innerText()
  assert(!/cost|profit|margin/i.test(text), `cost or profit on the till: ${text.match(/.{0,30}(cost|profit|margin).{0,30}/i)?.[0]}`)
  await axeClean(page, 'basket')
})

let firstSaleId
await check('one tap on Cash records the lot as one cash sale; the basket is empty again; the receipt lists it and says Cash', async () => {
  await pay('Cash', '₦4,300')
  // The receipt straight away, ready to print (owner, 2026-11-16).
  await page.locator('[data-receipt="synced"]').waitFor()
  await page.locator('[data-receipt="synced"]').getByText('Cash', { exact: true }).waitFor()
  await page.locator('[data-receipt="synced"]').getByText(`${rice.name} × 2`).waitFor()
  await page.getByRole('button', { name: 'Print' }).waitFor()
  await page.getByRole('button', { name: 'Next sale' }).waitFor()
  // Share: this browser can't share, so it copies the receipt as text (Step 2).
  await page.getByRole('button', { name: 'Share' }).click()
  await page.getByText('Receipt copied. Paste it into a chat or a message.').waitFor()
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  assert(copied.includes('Receipt No.') && copied.includes('Total: ₦4,300') && copied.includes('Paid by: Cash'), `copied: ${copied}`)
  await page.screenshot({ path: SHOTS + '2-receipt.png' })
  await axeClean(page, 'receipt')
  const [riceLine] = await saleLines(rice.id)
  const [soapLine] = await saleLines(soap.id)
  assert(riceLine.saleId === soapLine.saleId, 'two sale ids for one sale')
  assert(riceLine.saleAmount === 4000 && soapLine.saleAmount === 300, `amounts ${riceLine.saleAmount} ${soapLine.saleAmount}`)
  firstSaleId = riceLine.saleId
  const sale = (await api(`/api/sales/${firstSaleId}`, { token })).json
  assert(sale && (sale.lines?.length ?? 0) === 2, `sale: ${JSON.stringify(sale).slice(0, 200)}`)
  assert(sale.paymentMethod === 'CASH', `paid by ${sale.paymentMethod}`)
})

await check('a wrong tap is fixed with "Change how they paid", in place, and the server has it', async () => {
  await page.getByRole('button', { name: 'Change how they paid' }).click()
  await page.getByRole('group', { name: 'How they paid' }).getByRole('button', { name: 'Transfer' }).click()
  await page.getByText('Changed to Transfer.').waitFor()
  await page.locator('[data-receipt="synced"]').getByText('Transfer', { exact: true }).waitFor()
  await eventually(async () => (await api(`/api/sales/${firstSaleId}`, { token })).json.paymentMethod, (m) => m === 'TRANSFER')
  await page.getByRole('button', { name: 'Next sale' }).click()
  await page.getByRole('list', { name: 'Tap to add' }).waitFor()
  await page.locator('[data-sale-paid]').getByText('₦4,300 · Transfer').waitFor()
})

await check('Cancel sale, in its first two minutes, with a reason: kept on record, stock back, items back in the basket', async () => {
  await page.locator('[data-sale-paid]').getByRole('button', { name: 'Receipt' }).click()
  await page.getByRole('button', { name: 'Cancel sale' }).click()
  await page.getByRole('radio', { name: 'Wrong item' }).click()
  await page.screenshot({ path: SHOTS + '2a-cancel-why.png' })
  await page.getByRole('region', { name: 'Cancel this sale' }).getByRole('button', { name: 'Cancel sale' }).click()
  await page.getByText('Sale cancelled. The items are back.').waitFor()
  await eventually(() => onHand(rice.id), (n) => n === 100)
  assert((await onHand(soap.id)) === 100, 'soap not put back')
  const kept = (await api(`/api/sales/${firstSaleId}`, { token })).json
  assert(kept.cancelState === 'CANCELLED' && kept.cancelReason === 'WRONG_ITEM', `sale after cancel: ${JSON.stringify(kept).slice(0, 300)}`)
  await line(rice).waitFor()
  await line(soap).waitFor()
  await page.screenshot({ path: SHOTS + '2b-undone.png' })
  for (const product of [rice, soap]) await line(product).getByRole('button', { name: `Remove ${product.name}` }).click()
})

await check('an unpriced item asks once before the sale is recorded without its price', async () => {
  await page.getByRole('list', { name: 'Tap to add' }).waitFor()
  await scan(oil)
  await line(oil).getByText('Add price').waitFor()
  await payAny('Card')
  await page.getByRole('alert').getByText('Oil (sa) has no price.').waitFor()
  await payAny('Card')
  await page.locator('[data-receipt]').waitFor()
  await page.getByRole('button', { name: 'Next sale' }).click()
  const [oilLine] = await eventually(() => saleLines(oil.id), (lines) => lines.length > 0)
  assert(oilLine && oilLine.saleAmount == null, `oil: ${JSON.stringify(oilLine)}`)
})

await check('the basket is kept on the phone: a reload brings the customer\'s items back', async () => {
  await scan(salt)
  await line(salt).waitFor()
  await page.waitForTimeout(800)
  await page.reload()
  await line(salt).waitFor()
  await line(salt).getByRole('button', { name: `Remove ${salt.name}` }).click()
  await page.getByText('Salt (sa) taken off the sale.').waitFor()
})

await check('typing in the search hides the pay buttons; picking an item brings them back', async () => {
  await page.getByRole('list', { name: 'Tap to add' }).getByRole('button', { name: `Add ${sugar.name}` }).click()
  await line(sugar).waitFor()
  await page.getByRole('group', { name: /^Paid with, / }).waitFor()
  // The search narrows the same buttons (owner, 2026-11-16).
  await search().fill('salt')
  await page.getByRole('group', { name: /^Paid with, / }).waitFor({ state: 'hidden' })
  await page.getByRole('list', { name: 'Tap to add' }).getByRole('button', { name: `Add ${salt.name}` }).waitFor()
  assert((await page.getByRole('list', { name: 'Tap to add' }).getByRole('button', { name: `Add ${sugar.name}`, exact: false }).count()) === 0, 'search did not narrow the buttons')
  await search().fill('')
  await page.getByRole('group', { name: /^Paid with, / }).waitFor()
})

await check('"+ New sale" keeps the first customer waiting as a pill; both are kept and paid separately', async () => {
  // Sugar (₦900) is in Sale 1. Start Sale 2 with salt.
  await page.getByRole('button', { name: '+ New sale' }).click()
  await page.getByRole('button', { name: 'Sale 1 · ₦900' }).waitFor()
  await scan(salt)
  await line(salt).waitFor()
  assert((await line(sugar).count()) === 0, 'sugar followed into the new sale')
  await page.screenshot({ path: SHOTS + '2c-two-sales.png' })
  // Leave the screen: Inventory says a sale is waiting.
  await page.waitForTimeout(800)
  await page.goto(`${UI}/app/products`)
  await page.getByText('2 sales waiting for payment').waitFor()
  await page.getByRole('link', { name: 'Open' }).click()
  await page.getByRole('heading', { name: 'Record a sale', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Sale 1 · ₦900' }).click()
  await line(sugar).waitFor()
  await pay('Card', '₦900')
  await page.locator('[data-receipt]').waitFor()
  await page.getByRole('button', { name: 'Next sale' }).click()
  await page.getByRole('button', { name: /^Sale \d · ₦150$/ }).click()
  await line(salt).getByRole('button', { name: `Remove ${salt.name}` }).click()
  await page.getByRole('button', { name: /^Sale \d/ }).waitFor({ state: 'detached' })
})

await check('offline: a five-item sale is RECORDED on the phone, then lands as one sale whose total matches', async () => {
  await goOffline(context, page)
  for (const product of [rice, soap, salt, sugar, oil]) {
    await scan(product)
    await line(product).waitFor()
  }
  // Rice 2,000 + Soap 350 + Salt 150 + Sugar 900, and Oil with no price.
  await pay('Transfer', '₦3,400')
  await pay('Transfer', '₦3,400')
  await page.locator('[data-receipt="recorded"]').getByText('It will send when you are online.').waitFor()
  await page.screenshot({ path: SHOTS + '3-offline-receipt.png' })
  await page.getByRole('button', { name: 'Next sale' }).click()
  await goOnline(context, page)
  const lines = await eventually(
    async () => (await Promise.all([rice, soap, salt, sugar, oil].map(async (p) => (await saleLines(p.id))[0]))),
    (all) => all.every(Boolean) && new Set(all.map((l) => l.saleId)).size === 1 && all[0].saleId !== firstSaleId,
  )
  const total = lines.reduce((sum, l) => sum + (l.saleAmount ?? 0), 0)
  assert(total === 3400, `server total ${total}`)
  const offlineSale = (await api(`/api/sales/${lines[0].saleId}`, { token })).json
  assert(offlineSale.paymentMethod === 'TRANSFER', `offline sale paid by ${offlineSale.paymentMethod}`)
})

await check('online, an oversold line is refused and stays in the basket saying why; the rest of the sale lands', async () => {
  await scan(sugar)
  await scan(milk)
  await line(milk).waitFor()
  await page.getByLabel('How many Milk (sa)').fill('3')
  await payAny('Cash')
  await page.getByText(/Milk \(sa\) was not recorded/).waitFor()
  await page.getByRole('button', { name: 'Next sale' }).click()
  await line(milk).getByText(/Not recorded:/).waitFor()
  assert((await basket().locator(':scope > li').count()) === 1, 'more than the refused line left in the basket')
  assert((await onHand(milk.id)) === 1, 'milk taken anyway')
  await line(milk).getByRole('button', { name: `Remove ${milk.name}` }).click()
})

await check('offline, an oversold line comes back as CHECK naming the sale it was part of; the others land', async () => {
  const before = await onHand(sugar.id)
  await goOffline(context, page)
  await scan(sugar)
  await scan(milk)
  await line(milk).waitFor()
  await page.getByLabel('How many Milk (sa)').fill('4')
  await pay('Cash', '₦2,900')
  // This sale's own receipt (sugar ₦900 + milk 4 × ₦500).
  await page.locator('[data-receipt="recorded"]').getByText('₦2,900').waitFor()
  await page.getByRole('button', { name: 'Next sale' }).click()
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
  await line(soap).waitFor()
  await line(soap).getByRole('button', { name: `Remove ${soap.name}` }).click()
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
    assert(box.width >= 40 && box.height >= 44, `${name} is ${box.width}×${box.height}`)
  }
  await page.getByRole('button', { name: 'More Salt (sa)' }).click()
  await pay('Card', '₦300')
  // Quick mode's own way, made for a sale: the stamped card with Print, until Next sale (owner, 2026-11-16).
  await page.locator('[data-quick-sale-card]').getByText('₦300 · Card').waitFor()
  await page.getByRole('button', { name: 'Print' }).first().waitFor()
  await page.getByRole('button', { name: 'Next sale' }).click()
  const mine = (await api('/api/sales/mine/summary', { token })).json
  await page.getByText(new RegExp(`Your sales today: ${mine.saleCount} · `)).waitFor({ timeout: 10000 })
  // The refused line waiting in CHECK is not "waiting to send": it needs the person, not the network.
  assert((await page.getByText('waiting to send').count()) === 0, 'a refused line counted as waiting')
  assert(mine.costAmount === undefined && mine.grossProfit === undefined, 'cost in the till total')
  assert(mine.byPayment && mine.byPayment.cardAmount >= 300, `till total by payment: ${JSON.stringify(mine.byPayment)}`)
  await page.getByRole('button', { name: 'Stock out', exact: true }).click()
  await page.getByText('For a customer, use Sell.').waitFor()
  await page.screenshot({ path: SHOTS + '4-quick-sell.png' })
})

await check('money is exact: 24 pieces of a ₦5,000 carton record as ₦5,000, and a price typed "1,500" is kept', async () => {
  await page.goto(`${UI}/app/sell`)
  await page.getByRole('heading', { name: 'Record a sale', level: 1 }).waitFor()
  await scan(peak)
  await line(peak).getByRole('button', { name: /^Change price of Peak \(sa\), ₦5,000/ }).waitFor()
  // Sold by the piece instead: the small unit choice in the line.
  const select = line(peak).getByLabel(`Unit for ${peak.name}`)
  await select.selectOption(await select.evaluate((el) => [...el.options].find((o) => /piece/i.test(o.text))?.value))
  await page.getByLabel('How many Peak (sa)').fill('24')
  await line(peak).getByText('₦5,000', { exact: true }).first().waitFor()
  await scan(rice)
  await line(rice).getByRole('button', { name: /^Change price of Rice/ }).click()
  await line(rice).getByLabel('Each (₦)').fill('1,500')
  await line(rice).getByText('₦1,500', { exact: true }).first().waitFor()
  await pay('Cash', '₦6,500')
  await page.locator('[data-receipt="synced"]').getByText('₦6,500').first().waitFor()
  const [peakLine] = await saleLines(peak.id)
  const [riceLine] = await saleLines(rice.id)
  assert(peakLine.saleAmount === 5000, `peak recorded ${peakLine.saleAmount}`)
  assert(riceLine.saleAmount === 1500, `rice recorded ${riceLine.saleAmount}`)
  await page.getByRole('button', { name: 'Next sale' }).click()
})

await check('a line\'s total can be typed instead of the price each; the price each follows', async () => {
  await scan(salt)
  await page.getByRole('button', { name: `More ${salt.name}` }).click()
  await page.getByRole('button', { name: `More ${salt.name}` }).click()
  await line(salt).getByRole('button', { name: /^Change price of Salt/ }).click()
  await line(salt).getByLabel('Total (₦)').fill('400')
  await eventually(() => line(salt).getByLabel('Each (₦)').inputValue(), (v) => v === '133.33')
  await page.getByRole('group', { name: 'Paid with, ₦400' }).waitFor()
  await page.screenshot({ path: SHOTS + '5a-line-total.png' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: SHOTS + '5b-laptop.png' })
  // The till's title sits in the app's own top bar on a large screen.
  await page.locator('#topbar-page-slot').getByRole('heading', { name: 'Record a sale', level: 1 }).waitFor()
  await page.setViewportSize({ width: 1100, height: 760 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: SHOTS + '5c-tablet-landscape.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await line(salt).getByRole('button', { name: `Remove ${salt.name}` }).click()
})

await check('My sales today lists the cashier\'s own sales; each opens its receipt to print, share or cancel', async () => {
  await page.goto(`${UI}/app/sell`)
  await page.getByRole('link', { name: 'My sales today' }).first().click()
  await page.getByRole('heading', { name: 'My sales today', level: 1 }).waitFor()
  const list = page.getByRole('list', { name: 'My sales today' })
  await list.getByText(/^Cancelled · /).first().waitFor()
  await list.getByRole('button').first().click()
  await page.getByRole('heading', { name: 'Receipt', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Print' }).waitFor()
  await page.getByRole('button', { name: 'Share' }).waitFor()
  await page.screenshot({ path: SHOTS + '5d-sale-receipt-again.png' })
  await page.getByRole('main').getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('heading', { name: 'My sales today', level: 1 }).waitFor()
})

await check('the Sales page splits today into Cash, Transfer and Card, and each sale says how it was paid', async () => {
  await page.goto(`${UI}/app/sales`)
  await page.locator('[data-sales-total]').waitFor()
  const mine = (await api('/api/analytics/sales?groupBy=sale', { token })).json.totals.byPayment
  for (const [method, amount] of [['CASH', mine.cashAmount], ['TRANSFER', mine.transferAmount], ['CARD', mine.cardAmount]]) {
    const shown = await page.locator(`[data-payment-total="${method}"]`).innerText()
    assert(shown === `₦${amount.toLocaleString('en-NG')}`, `${method} shows ${shown}, server ${amount}`)
  }
  assert(mine.cashAmount >= 6500 && mine.transferAmount >= 3400 && mine.cardAmount >= 300, `by payment: ${JSON.stringify(mine)}`)
  await page.getByRole('list').getByText('Transfer', { exact: true }).first().waitFor()
  await page.screenshot({ path: SHOTS + '5-sales-by-payment.png' })
  await axeClean(page, 'sales by payment')
})

await check('lab baseline (§9): a three-item scanned sale in quick mode, on a phone-speed CPU, well under 10 s', async () => {
  // The target is for the field, with a real scanner and a real customer; this is the floor the app
  // itself sets, so the field number can be read against it.
  await page.goto(`${UI}/app/quick?mode=sell`)
  await page.getByRole('heading', { name: 'Quick mode' }).waitFor()
  await search().waitFor()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const started = Date.now()
  for (const product of [rice, soap, salt]) {
    await scan(product)
    await line(product).waitFor()
  }
  await payAny('Cash')
  await page.locator('[data-quick-sale-card]').waitFor()
  const ms = Date.now() - started
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  console.log(`    three-item sale, scanned, CPU 4× slower: ${(ms / 1000).toFixed(1)} s`)
  assert(ms < 10_000, `took ${ms} ms`)
})

await check('made here (Step 4): the owner turns it on; a made-here item is added through the same form, has its own tab, sells with no stock and refuses stock in', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${UI}/app/company`)
  await page.getByRole('switch', { name: 'Sell things you make' }).click()
  await page.getByText('You can now add things you make.').waitFor()

  await page.goto(`${UI}/app/products/new`)
  await page.getByRole('radio', { name: 'Made here' }).click()
  const steps = page.getByRole('navigation', { name: 'Steps to add a product' })
  assert((await steps.getByText('Units').count()) === 0, 'a Units step for a made-here item')
  await page.getByLabel('Name').fill(`Pepper soup ${unique}`)
  const sku = page.getByLabel('SKU')
  if (await sku.count()) await sku.fill(`PS-${unique}`)
  await page.getByRole('button', { name: /^Next: Price/ }).click()
  await page.getByLabel(/^Selling price/).fill('6500')
  await page.getByLabel('Rough cost to make one (₦, optional)').fill('2800')
  await page.screenshot({ path: SHOTS + '6a-made-here-price.png' })
  // Step 5: Made with comes next, and is optional.
  await page.getByRole('button', { name: /^Next: Made with/ }).click()
  await page.getByRole('button', { name: /^Next: Review/ }).click()
  await page.getByRole('button', { name: 'Create product' }).click()
  await page.getByText('Made here: sold, not kept in stock.').waitFor()
  await page.screenshot({ path: SHOTS + '6b-made-here-page.png' })
  const soupId = page.url().split('/').pop()

  await page.goto(`${UI}/app/products`)
  await page.getByRole('tab', { name: /^Made here/ }).click()
  await page.getByText(`Pepper soup ${unique}`).first().waitFor()
  await page.getByText('Made here', { exact: true }).first().waitFor()
  await page.screenshot({ path: SHOTS + '6c-made-here-tab.png' })

  await page.goto(`${UI}/app/sell`)
  await search().fill('Pepper soup')
  await page.getByRole('list', { name: 'Tap to add' }).getByRole('button', { name: new RegExp(`^Add Pepper soup ${unique}`) }).click()
  await page.getByRole('button', { name: `More Pepper soup ${unique}` }).click()
  await pay('Cash', '₦13,000')
  await page.locator('[data-receipt="synced"]').getByText(`Pepper soup ${unique} × 2`).waitFor()
  await page.getByRole('button', { name: 'Next sale' }).click()

  const soup = (await api(`/api/products/${soupId}`, { token })).json
  assert(soup.madeHere === true && soup.quantityOnHand === 0, `soup: ${JSON.stringify(soup).slice(0, 200)}`)
  const refused = await api(`/api/products/${soupId}/stock/stock-in`, { token, method: 'POST', body: { quantity: 5 } })
  assert(refused.status === 409, `stock in on a made-here item: ${refused.status}`)
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
