// End-to-end checks for a product's own units (UNITS_PLAN.md Parts 0-4), against the production preview and the API.
//   1. The product form: rice in kg, a Bag of 80 kg, Add a unit → Derica 0.6 kg and Cup 0.2 kg, stock-outs start in
//      Derica. A wrong one says why where it's typed.
//   2. Stock out 5 dericas from the product page: the sheet starts in Derica and says 3 kg; the figure is 157 kg.
//   3. Quick mode on a phone: stock out starts in Derica, "In the …: 157 kg (about 261.7 dericas)"; 7 dericas is 4.2 kg.
//   4. Count in two units: "2 bags + 7 dericas = 164.2 kg", on the count sheet and in quick mode.
//   5. Taking off a used unit hides it ("Not offered any more"); history still reads 5 dericas.
//   6. Decimals (Part 0): a stock-in of 12.6 kg is 12.6 kg; half an egg is refused.
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'

const SHOTS = shotsPrefix('units')
const PASSWORD = 'correct-horse-battery-staple'
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
      await pg.screenshot({ path: SHOTS + `fail-${results.length}-${i++}.png` }).catch(() => {})
    }
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
async function waitFor(predicate, what, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`timed out waiting for ${what}`)
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

async function createProduct(token, unique, name, extra) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `UN-${name.slice(0, 4)}-${unique}`, ...extra })], { type: 'application/json' }))
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

browser = await chromium.launch(launchOptions)
const owner = await signup('units')
const token = owner.tokens.accessToken
const rice = await createProduct(token, owner.unique, 'Rice', { unitOfMeasure: 'KG', packagingUnit: 'BAG', packagingSize: 80 })
await api(`/api/products/${rice.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 2, unit: 'BAG' } })
const context = await contextFor(owner)
const page = await context.newPage()

// ------------------------------------------------------------------------------------------ 1
await check('the product form: Add a unit → Derica 0.6 kg, Cup 0.2 kg; stock-outs start in Derica', async () => {
  await page.goto(`${UI}/app/products/${rice.id}/edit`)
  const units = page.locator('[data-product-units]')
  await units.getByRole('heading', { name: 'Also used in' }).waitFor()
  await page.screenshot({ path: SHOTS + '1-units-empty.png', fullPage: true })
  await units.getByRole('button', { name: 'Add a unit' }).click()
  await units.getByRole('group', { name: 'Add a unit' }).getByRole('button', { name: 'Derica', exact: true }).click()
  await units.getByLabel('How much one Derica holds, in kg').fill('0.6')
  await units.getByRole('button', { name: 'Add a unit' }).click()
  await units.getByRole('group', { name: 'Add a unit' }).getByRole('button', { name: 'Cup', exact: true }).click()
  // A size that can't be kept is said where it's typed.
  const cup = units.getByLabel('How much one Cup holds, in kg')
  await cup.fill('0')
  await cup.blur()
  await units.getByText('Type a number above 0.').waitFor()
  await cup.fill('0.2')
  await units.getByText('g and t work out by themselves.').waitFor({ timeout: 5000 }).catch(() => {})
  await units.getByLabel('Stock out opens in').selectOption({ label: 'Derica' })
  // Counted in: nothing chosen yet, so a count opens in the bag and the derica.
  const countIn = units.getByRole('group', { name: 'Count in' })
  for (const [name, on] of [[/^Bag/, 'true'], [/^kg$/, 'false'], [/^Derica$/, 'true'], [/^Cup$/, 'false']]) {
    assert((await countIn.getByRole('button', { name }).getAttribute('aria-pressed')) === on, `Count in ${name} is not ${on}`)
  }
  await page.screenshot({ path: SHOTS + '1b-units-filled.png', fullPage: true })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await waitFor(async () => {
    const detail = (await api(`/api/products/${rice.id}`, { token })).json
    return detail.measures?.length === 2 && detail.usedInUnit === 'Derica'
  }, 'the product to keep Derica and Cup')
  // The product page says them, where the rest of how it's counted is.
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.locator('[data-product-measures]').getByText('Derica = 0.6 kg · Cup = 0.2 kg').waitFor()
  await page.getByText('Stock out opens in Derica').waitFor()
})

// ------------------------------------------------------------------------------------------ 2
await check('stock out from the product page starts in Derica: 5 dericas is 3 kg', async () => {
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('button', { name: /^Stock out/ }).first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('heading', { name: 'Stock out · Rice' }).waitFor()
  const unit = sheet.getByLabel('Counted in')
  assert((await unit.evaluate((el) => el.tagName)) !== 'SELECT' || (await unit.inputValue()) === 'Derica', 'the sheet does not start in Derica')
  await sheet.getByLabel(/^Quantity/).fill('5')
  await sheet.getByText(/3 kg/).first().waitFor()
  await page.screenshot({ path: SHOTS + '2-stock-out-dericas.png' })
  await sheet.getByRole('button', { name: 'Confirm', exact: true }).click()
  await waitFor(async () => Number((await api(`/api/products/${rice.id}`, { token })).json.quantityOnHand) === 157, 'the figure to be 157 kg')
})

// ------------------------------------------------------------------------------------------ 3
await check('quick mode on a phone starts in Derica, and 7 dericas is 4.2 kg', async () => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(`${UI}/app/quick?mode=out`)
  await page.locator('#quick-search').fill('Rice')
  await page.getByRole('button', { name: /^Rice/ }).first().click()
  await page.getByText(/On hand 157 kg \(about 261\.7 dericas\)/).waitFor()
  const units = page.getByRole('group', { name: 'Counted in' })
  assert((await units.getByRole('button', { name: 'Derica' }).getAttribute('aria-pressed')) === 'true', 'quick mode does not start in Derica')
  await page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: '7', exact: true }).click()
  await page.getByRole('button', { name: /^Stock out 7 dericas \(4\.2 kg\)/ }).waitFor()
  await page.screenshot({ path: SHOTS + '3-quick-dericas.png' })
  await page.getByRole('button', { name: /^Stock out 7 dericas/ }).click()
  await waitFor(async () => Number((await api(`/api/products/${rice.id}`, { token })).json.quantityOnHand) === 152.8, 'the figure to be 152.8 kg')
})

// ------------------------------------------------------------------------------------------ 4
await check('count in two units: 2 bags + 7 dericas = 164.2 kg, in quick mode and on the count sheet', async () => {
  await page.goto(`${UI}/app/quick?mode=count`)
  await page.locator('#quick-search').fill('Rice')
  await page.getByRole('button', { name: /^Rice/ }).first().click()
  // Every unit as a chip, the ones Rice is counted in already on, a box for each (owner, 2026-11-10).
  const chips = page.getByRole('group', { name: 'Count Rice in' })
  await chips.waitFor()
  const pair = page.getByRole('group', { name: 'Count in several units' })
  const keypad = page.getByRole('group', { name: 'Keypad' })
  await keypad.getByRole('button', { name: '2', exact: true }).click()
  await pair.getByRole('button', { name: /Type dericas$/ }).click()
  await keypad.getByRole('button', { name: '7', exact: true }).click()
  await page.locator('[data-quick-total]').getByText('= 164.2 kg').waitFor()
  await page.screenshot({ path: SHOTS + '4-quick-count-two-units.png' })
  // A cup too, when the shelf needs it: tap its chip, its box comes and the keypad types into it; tap again, it goes.
  await chips.getByRole('button', { name: 'Cup', exact: true }).click()
  await keypad.getByRole('button', { name: '1', exact: true }).click()
  await page.locator('[data-quick-total]').getByText('= 164.4 kg').waitFor()
  await page.screenshot({ path: SHOTS + '4a-quick-count-three-units.png' })
  await chips.getByRole('button', { name: 'Cup', exact: true }).click()
  await page.locator('[data-quick-total]').getByText('= 164.2 kg').waitFor()
  await page.getByRole('button', { name: /^Record count: 164\.2 kg/ }).click()
  await waitFor(async () => Number((await api(`/api/products/${rice.id}`, { token })).json.quantityOnHand) === 164.2, 'the count to make it 164.2 kg')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('button', { name: /^Count/ }).first().click()
  const sheet = page.getByRole('dialog')
  await sheet.locator('[data-count-pair]').waitFor()
  await sheet.getByLabel('bags on the shelf').fill('1')
  await sheet.getByLabel('dericas on the shelf').fill('10')
  await sheet.locator('[data-count-total]').getByText('= 86 kg').waitFor()
  // Cups instead of dericas: one tap off, one tap on.
  const sheetChips = sheet.getByRole('group', { name: 'Count Rice in' })
  await sheetChips.getByRole('button', { name: 'Derica', exact: true }).click()
  await sheetChips.getByRole('button', { name: 'Cup', exact: true }).click()
  await sheet.getByLabel('cups on the shelf').fill('10')
  await sheet.locator('[data-count-total]').getByText('= 82 kg').waitFor()
  await sheetChips.getByRole('button', { name: 'kg', exact: true }).click()
  assert((await sheet.locator('[data-count-pair] input').count()) === 3, 'no third box on the count sheet')
  await page.screenshot({ path: SHOTS + '4c-count-sheet-cups.png' })
  await sheet.getByRole('button', { name: 'Cancel' }).click()
})

await check('the product says what it is counted in: Bag + Cup, and a count opens in them', async () => {
  await page.goto(`${UI}/app/products/${rice.id}/edit`)
  const countIn = page.locator('[data-product-units]').getByRole('group', { name: 'Count in' })
  await countIn.getByRole('button', { name: 'Derica', exact: true }).click()
  await countIn.getByRole('button', { name: 'Cup', exact: true }).click()
  await page.screenshot({ path: SHOTS + '4d-count-in-on-the-form.png', fullPage: true })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await waitFor(async () => {
    const countedIn = (await api(`/api/products/${rice.id}`, { token })).json.countIn ?? []
    return countedIn.length === 2 && countedIn[0] === 'BAG:80' && countedIn[1] === 'Cup'
  }, 'Rice to be counted in Bag + Cup')
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.locator('[data-product-count-in]').getByText(/Counted in .*Bag.* \+ Cup/).waitFor()
  await page.getByRole('button', { name: /^Count/ }).first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('cups on the shelf').waitFor()
  assert((await sheet.locator('[data-count-pair] input').count()) === 2, 'the count does not open in bags and cups')
  await sheet.getByRole('button', { name: 'Cancel' }).click()
})

// ------------------------------------------------------------------------------------------ 5
await check('taking off a used unit hides it; the history still reads 5 dericas', async () => {
  await page.goto(`${UI}/app/products/${rice.id}/edit`)
  const units = page.locator('[data-product-units]')
  await units.getByRole('button', { name: 'Take Derica off' }).click()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await waitFor(async () => (await api(`/api/products/${rice.id}`, { token })).json.measures?.some((m) => m.name === 'Derica' && m.hidden), 'Derica to be hidden')
  await page.goto(`${UI}/app/products/${rice.id}/edit`)
  await page.locator('[data-hidden-measures]').getByText(/Derica \(0\.6 kg\)/).waitFor()
  await page.screenshot({ path: SHOTS + '5-hidden-unit.png', fullPage: true })
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.locator('text=5 dericas >> visible=true').first().waitFor()
})

// ------------------------------------------------------------------------------------------ 6
await check('decimals: 12.6 kg is 12.6 kg; half an egg is refused', async () => {
  const flour = await createProduct(token, owner.unique, 'Flour', { unitOfMeasure: 'KG' })
  const put = await api(`/api/products/${flour.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 12.6 } })
  assert(put.status === 200 && Number(put.json.product.quantityOnHand) === 12.6, `12.6 kg was ${put.json?.product?.quantityOnHand}`)
  const eggs = await createProduct(token, owner.unique, 'Eggs', { unitOfMeasure: 'PIECE' })
  const half = await api(`/api/products/${eggs.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 2.5 } })
  assert(half.status === 400, `half an egg was ${half.status}`)
})

// ------------------------------------------------------------------------------------------ 7
await check('stock in: No supplier is a choice, and a new supplier is added in place', async () => {
  const unique = randomUUID().slice(0, 6)
  const mama = (await api('/api/company-vendors', { token, method: 'POST', body: { name: `Mama Nkechi ${unique}`, contactPhone: `0803${unique}` } })).json
  await api(`/api/products/${rice.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 1, unit: 'BAG', companyVendorId: mama.id } })
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('button', { name: /^Stock in/ }).first().click()
  const sheet = page.getByRole('dialog')
  const supplier = sheet.getByLabel('Supplier', { exact: true })
  await waitFor(async () => (await supplier.locator('option:checked').innerText()) === mama.name, 'the usual supplier to be picked')
  await supplier.selectOption({ label: 'No supplier' })
  await sheet.getByLabel(/^Quantity/).fill('1')
  await sheet.getByRole('button', { name: 'Continue' }).click()
  await sheet.getByText('from no supplier').waitFor()
  await page.screenshot({ path: SHOTS + '7-no-supplier.png' })
  await sheet.getByRole('button', { name: 'Confirm', exact: true }).click()
  await sheet.getByRole('button', { name: 'Done' }).click()
  // + Add a supplier opens in place: name and phone, and it's picked.
  await page.getByRole('button', { name: /^Stock in/ }).first().click()
  await sheet.getByLabel('Supplier', { exact: true }).selectOption({ label: '+ Add a supplier' })
  const card = sheet.getByRole('group', { name: 'Add a supplier' })
  await card.getByLabel('Name').fill(`Alaba Rice ${unique}`)
  await card.getByLabel('Phone').fill(`0805${unique}`)
  await page.screenshot({ path: SHOTS + '7b-add-supplier.png' })
  await card.getByRole('button', { name: 'Add supplier' }).click()
  await waitFor(async () => (await sheet.getByLabel('Supplier', { exact: true }).locator('option:checked').innerText()) === `Alaba Rice ${unique}`, 'the new supplier to be picked')
  await sheet.getByRole('button', { name: 'Cancel' }).click()
})

// ------------------------------------------------------------------------------------------ 8
await check('quick mode stock in: Other unit… gives a pack not listed for this delivery', async () => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto(`${UI}/app/quick?mode=in`)
  await page.locator('#quick-search').fill('Rice')
  await page.getByRole('button', { name: /^Rice/ }).first().click()
  await page.getByRole('button', { name: 'Other unit…' }).click()
  const other = page.getByRole('group', { name: 'Other units' })
  await other.getByRole('button', { name: 'g', exact: true }).waitFor()
  await other.getByLabel('Pack').selectOption({ label: 'Bag' })
  await other.getByLabel('How much one holds, in kg').fill('25')
  await page.screenshot({ path: SHOTS + '8-quick-other-unit.png' })
  await other.getByRole('button', { name: 'Use this pack' }).click()
  await page.getByRole('group', { name: 'Counted in' }).getByRole('button', { name: 'Bag of 25 kg', pressed: true }).waitFor()
  const before = Number((await api(`/api/products/${rice.id}`, { token })).json.quantityOnHand)
  await page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: '2', exact: true }).click()
  await page.getByRole('button', { name: /^Stock in 2 bags \(50 kg\)/ }).click()
  await waitFor(async () => Number((await api(`/api/products/${rice.id}`, { token })).json.quantityOnHand) === before + 50, 'the delivery to add 50 kg')
  await page.setViewportSize({ width: 1280, height: 900 })
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
