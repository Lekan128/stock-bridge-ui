// End-to-end checks for price requests, PURCHASE_ORDER_PLAN.md section 12, against the production preview and the
// real API:
//   1. Picking the supplier for each item: it starts on the lowest; the buyer picks a dearer supplier for one item
//      and "Not now" for another; the summary says what it makes, the delivery and the extra; two orders are made;
//      the request then says what each item went to beside the lowest. (Phone and laptop.)
//   2. Replies close on the Reply by day: the supplier's link is read-only after it, the buyer sees "Replies closed"
//      and gives more time, and the link takes prices again.
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { API, UI, launchOptions, psqlCommand, shotsPrefix } from '../config.mjs'

const SHOTS = shotsPrefix('price-requests')
const PASSWORD = 'correct-horse-battery-staple'
const results = []

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
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`)
  return json
}

const sql = (query) => execSync(psqlCommand, { input: query }).toString().trim()
const lagosDay = (offset = 0) => {
  const day = new Date(Date.now() + offset * 86_400_000)
  return day.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
}

/** A browser signed in as the owner afresh: a sign-in's refresh token is used up once a context refreshes it. */
async function contextFor(_owner, viewport = { width: 1280, height: 900 }) {
  const session = await api('/api/auth/login', {
    method: 'POST',
    body: { clientIdentifier: owner.user.clientIdentifier, username: `quotes-${unique}@example.com`, password: PASSWORD },
  })
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

const browser = await chromium.launch(launchOptions)
const unique = randomUUID().slice(0, 8)
const owner = await api('/api/clients/signup', {
  method: 'POST',
  body: { name: `E2E Quotes ${unique}`, adminEmail: `quotes-${unique}@example.com`, password: PASSWORD, confirmPassword: PASSWORD },
})
const token = owner.tokens.accessToken

async function product(name) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `PQ-${name.slice(0, 4).toUpperCase()}-${unique}`, unitOfMeasure: 'KG' })], { type: 'application/json' }))
  return api('/api/products', { token, method: 'POST', body: form })
}
async function vendor(name) {
  return api('/api/company-vendors', { token, method: 'POST', body: { name, contactPhone: '08030000000' } })
}
const rice = await product('Rice')
const oil = await product('Oil')
const beans = await product('Beans')
const tony = await vendor('Tony Stores')
const mama = await vendor('Mama Put')

/** A request to Tony and Mama, each replying from their own link. */
async function askAndReply(replyBy) {
  const request = await api('/api/price-requests', {
    token,
    method: 'POST',
    body: {
      lines: [
        { productId: rice.id, unit: 'KG', quantity: 20 },
        { productId: oil.id, unit: 'KG', quantity: 10 },
        { productId: beans.id, unit: 'KG', quantity: 5 },
      ],
      vendorIds: [tony.id, mama.id],
      replyBy,
    },
  })
  const [riceLine, oilLine, beansLine] = request.lines.map((line) => line.id)
  const tokenOf = (name) => sql(`SELECT token FROM price_request_suppliers WHERE id = '${request.suppliers.find((s) => s.vendorName === name).id}';`)
  const links = { tony: tokenOf('Tony Stores'), mama: tokenOf('Mama Put') }
  await api(`/api/public/price-requests/${links.tony}/reply`, {
    method: 'PUT',
    body: {
      lines: [
        { lineId: riceLine, price: 900, cannotSupply: false },
        { lineId: oilLine, price: 380, cannotSupply: false },
        { lineId: beansLine, cannotSupply: true },
      ],
      deliveryCharge: 500,
      remark: 'Premium long-grain rice',
      declined: false,
    },
  })
  await api(`/api/public/price-requests/${links.mama}/reply`, {
    method: 'PUT',
    body: {
      lines: [
        { lineId: riceLine, price: 880, cannotSupply: false },
        { lineId: oilLine, price: 395, cannotSupply: false },
        { lineId: beansLine, price: 600, cannotSupply: false },
      ],
      deliveryCharge: 800,
      declined: false,
    },
  })
  return { request, links }
}

// ------------------------------------------------------------------------------------------ 1
await check('the buyer picks the supplier for each item: the lowest to start, a dearer one, and not now', async () => {
  const { request } = await askAndReply(lagosDay(2))
  const context = await contextFor(owner, { width: 390, height: 844 })
  const page = await context.newPage()
  await page.goto(`${UI}/app/purchase-orders/rfq/${request.id}`)
  const choose = page.locator('[data-choose]')
  await choose.getByText('Choose who to order from').waitFor()
  const item = (name) => choose.locator(`[data-choose-line="${name}"]`)
  const summary = page.locator('[data-choose-summary]')

  // It starts on the lowest for each item: Mama's rice and beans, Tony's oil - 2 orders, and no extra.
  assert(await item('Rice').getByRole('radio', { name: /Mama Put/ }).isChecked(), 'rice does not start on the lowest')
  assert(await item('Oil').getByRole('radio', { name: /Tony Stores/ }).isChecked(), 'oil does not start on the lowest')
  await item('Beans').getByText("Can't supply").waitFor()
  await summary.getByRole('button', { name: 'Make 2 purchase orders' }).waitFor()
  assert(!(await summary.getByText(/more than the cheapest/).count()), 'the lowest picks say they cost more')
  await page.screenshot({ path: SHOTS + '1-starts-on-lowest.png', fullPage: true })

  // Tony's rice is better: picked though dearer. The beans can wait.
  await item('Rice').getByText('Tony Stores').click()
  await item('Rice').getByText('+₦400').waitFor()
  await item('Beans').getByText('Not now').click()
  // Mama's oil too would add her delivery: the summary says it costs more than the cheapest picks.
  await item('Oil').getByText('Mama Put').click()
  await summary.getByText('Tony Stores 1 item · Mama Put 1 item').waitFor()
  await summary.getByText(/₦550 more than the cheapest/).waitFor()
  await page.screenshot({ path: SHOTS + '2a-dearer-says-so.png', fullPage: true })
  await item('Oil').getByText('Tony Stores').click()
  await summary.getByText('Tony Stores 2 items').waitFor()
  await summary.getByText(/incl\. ₦500 delivery/).waitFor()
  // One order, one delivery charge: less than the cheapest of each from two suppliers, so no extra is said.
  await summary.getByText('₦22,300').waitFor()
  assert(!(await summary.getByText(/more than the cheapest/).count()), 'a cheaper overall pick is said to cost more')
  await summary.getByRole('button', { name: 'Make the purchase order' }).waitFor()
  await page.waitForTimeout(300)
  await choose.screenshot({ path: SHOTS + '2-picked-phone.png' })
  await page.screenshot({ path: SHOTS + '2b-phone-top.png' })

  // Laptop: the same page, wider.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: SHOTS + '3-picked-laptop.png', fullPage: true })

  await summary.getByRole('button', { name: 'Make the purchase order' }).click()
  await page.waitForURL(/\/app\/purchase-orders\/[0-9a-f-]{36}$/)
  const made = await api(`/api/price-requests/${request.id}`, { token })
  assert(made.status === 'DONE', `request is ${made.status}`)
  const orders = made.suppliers.filter((s) => s.orderId)
  assert(orders.length === 1 && orders[0].vendorName === 'Tony Stores', `orders ${JSON.stringify(orders.map((s) => s.vendorName))}`)
  const order = await api(`/api/expected-deliveries/${orders[0].orderId}`, { token })
  assert(order.lines.length === 2, `Tony's order has ${order.lines.length} lines`)
  assert(Number(order.total) === 20 * 900 + 10 * 380 + 500, `total ${order.total}`)

  // The request says what each item went to, and that the rice wasn't the lowest.
  await page.goto(`${UI}/app/purchase-orders/rfq/${request.id}`)
  await page.locator('[data-dearer-pick]').getByText('Ordered from Tony Stores at ₦900 · lowest was ₦880 from Mama Put').waitFor()
  await page.screenshot({ path: SHOTS + '4-done.png', fullPage: true })
  await context.close()
})

// ------------------------------------------------------------------------------------------ 2
await check("replies close on the Reply by day: the supplier's link is read-only, and Give more time reopens it", async () => {
  const { request, links } = await askAndReply(lagosDay(0))
  const supplierContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const supplier = await supplierContext.newPage()
  await supplier.goto(`${UI}/q/${links.tony}`)
  await supplier.getByText(/You can change them until/).waitFor({ state: 'attached' }).catch(() => {})
  await supplier.getByRole('button', { name: 'Change my prices' }).waitFor()

  // The day passes.
  sql(`UPDATE price_requests SET reply_by = '${lagosDay(-1)}' WHERE id = '${request.id}';`)
  await supplier.reload()
  await supplier.locator('[data-replies-closed]').getByText(/^Replies closed on/).waitFor()
  await supplier.getByText('Your prices are with').waitFor()
  assert((await supplier.getByRole('button', { name: 'Change my prices' }).count()) === 0, 'a closed link still offers a change')
  await supplier.screenshot({ path: SHOTS + '5-supplier-closed.png', fullPage: true })

  // The buyer: "Replies closed … · Give more time", then a day from today on.
  const context = await contextFor(owner)
  const page = await context.newPage()
  await page.goto(`${UI}/app/purchase-orders/rfq/${request.id}`)
  const line = page.locator('[data-reply-by]')
  await line.getByText(/^Replies closed/).waitFor()
  await page.screenshot({ path: SHOTS + '6-buyer-closed.png' })
  await line.getByRole('button', { name: 'Give more time' }).click()
  const editor = page.locator('[data-reply-by-editor]')
  await editor.getByLabel('Replies close on').fill(lagosDay(1))
  await editor.getByRole('button', { name: 'Save' }).click()
  await line.getByText(/^Replies close /).waitFor()
  await line.getByRole('button', { name: 'Change' }).waitFor()

  await supplier.reload()
  await supplier.getByRole('button', { name: 'Change my prices' }).waitFor()
  await context.close()
  await supplierContext.close()
})

// ------------------------------------------------------------------------------------------ 3
await check("the supplier's page says it's the price of one, on the box, and delivery is its own section", async () => {
  const request = await api('/api/price-requests', {
    token,
    method: 'POST',
    body: { lines: [{ productId: rice.id, unit: 'KG', quantity: 20 }, { productId: oil.id, unit: 'KG', quantity: 10 }], vendorIds: [tony.id], replyBy: lagosDay(2) },
  })
  const link = sql(`SELECT token FROM price_request_suppliers WHERE id = '${request.suppliers[0].id}';`)
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const supplier = await context.newPage()
  await supplier.goto(`${UI}/q/${link}`)
  await supplier.locator('[data-price-how]').getByText('Type your price for one kg. We add up the totals.').waitFor()
  const box = supplier.getByLabel('Your price for one kg of Rice')
  await box.fill('1200')
  await supplier.getByText('₦24,000 for 20 kg').waitFor()
  await box.blur()
  assert((await box.inputValue()) === '1,200', `the price reads ${await box.inputValue()}`)
  const delivery = supplier.locator('[data-delivery]')
  await delivery.getByText('Delivery charge').waitFor()
  await delivery.getByText('When can you deliver?').waitFor()
  await supplier.waitForTimeout(300)
  await supplier.screenshot({ path: SHOTS + '7-supplier-reply.png', fullPage: true })
  await context.close()
})

await browser.close()
const failed = results.filter(([status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
