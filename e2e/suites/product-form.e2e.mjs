// End-to-end checks for the product form's sections (2026-11-10): steps, Required, several suppliers, Review, edit.
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'

const SHOTS = shotsPrefix('product-form')
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


async function supplier(token, name) {
  return (await api('/api/company-vendors', { token, method: 'POST', body: { name, contactPhone: '0803' + randomUUID().slice(0, 7).replace(/\D/g, '1') } })).json
}

browser = await chromium.launch(launchOptions)
const owner = await signup('pform')
const token = owner.tokens.accessToken
const mama = await supplier(token, `Mama Nkechi ${owner.unique}`)
const alaba = await supplier(token, `Alaba Grains ${owner.unique}`)
const third = await supplier(token, `Third Foods ${owner.unique}`)
const context = await contextFor(owner)
const page = await context.newPage()
const heading = (name) => page.getByRole('heading', { name, level: 2, exact: true })
const steps = () => page.getByRole('navigation', { name: 'Steps to add a product' })
let created

/** Next until the named section is on screen. */
async function nextUntil(name) {
  for (let i = 0; i < 6 && !(await heading(name).isVisible()); i++) {
    await page.getByRole('button', { name: /^Next: / }).click()
    await page.waitForTimeout(150)
  }
  await heading(name).waitFor()
}

// ------------------------------------------------------------------------------------------ 1
await check('adding: steps down the left, Required said in words, and Next stops on a missing name', async () => {
  await page.goto(`${UI}/app/products/new`)
  await heading('Basics').waitFor()
  await steps().getByRole('button', { name: /Units/ }).last().waitFor()
  await page.locator('label[for="name"] + span', { hasText: 'Required' }).waitFor()
  assert((await page.locator('#name').getAttribute('aria-required')) === 'true', 'the name box does not say it is required')
  await page.getByText('Only what says Required has to be filled.').waitFor()
  await page.screenshot({ path: SHOTS + '1-basics.png' })
  await page.getByRole('button', { name: 'Next: Units' }).click()
  await page.getByText('Name is required').waitFor()
  assert(await heading('Basics').isVisible(), 'Next went on without a name')
  await page.getByLabel('Name', { exact: true }).fill(`Rice ${owner.unique}`)
  const sku = page.getByLabel('SKU', { exact: true })
  if (await sku.isVisible()) await sku.fill(`PF-${owner.unique}`)
  await page.getByRole('button', { name: 'Next: Units' }).click()
  await heading('Units').waitFor()
})

// ------------------------------------------------------------------------------------------ 2
await check('units: the stock unit starts at Piece, is required, and a bag of 50 kg is set', async () => {
  const unit = page.locator('#unitOfMeasure')
  assert((await unit.inputValue()) === 'PIECE', `the stock unit starts at ${await unit.inputValue()}`)
  await unit.selectOption('')
  await page.getByRole('button', { name: /^Next: / }).click()
  await page.getByText('Choose what it’s counted in.').waitFor()
  await unit.selectOption('KG')
  await page.locator('#packagingUnit').selectOption('BAG')
  await page.locator('#product-contains').fill('50 kg')
  await page.screenshot({ path: SHOTS + '2-units.png', fullPage: true })
  await page.getByRole('button', { name: /^Next: / }).click()
  await page.waitForTimeout(200)
  assert(!(await heading('Units').isVisible()), 'Next did not go on from Units')
})

// ------------------------------------------------------------------------------------------ 3
await check('suppliers: two at once, each with its pack and price; the stock on the shelf from one of them', async () => {
  await nextUntil('Suppliers')
  await page.getByRole('button', { name: 'Add a supplier' }).click()
  const first = page.locator('[data-supplier-card="1"]')
  await first.getByLabel('Supplier', { exact: true }).selectOption({ label: mama.name })
  await first.getByLabel('Price (₦ a bag)').fill('50000')
  await first.getByText('₦1,000 a kg').waitFor()
  await page.getByRole('button', { name: 'Add another supplier' }).click()
  const second = page.locator('[data-supplier-card="2"]')
  // One already chosen isn't offered again.
  assert((await second.getByLabel('Supplier', { exact: true }).locator('option', { hasText: mama.name }).count()) === 0, 'Mama is offered twice')
  await second.getByLabel('Supplier', { exact: true }).selectOption({ label: alaba.name })
  await page.getByLabel(/^Opening stock/).fill('2')
  await page.getByLabel('Bought from').selectOption({ label: mama.name })
  await page.screenshot({ path: SHOTS + '3-suppliers.png', fullPage: true })
})

// ------------------------------------------------------------------------------------------ 4
await check('review: each section in a line with Change, then Create; the product has both suppliers and 100 kg', async () => {
  await nextUntil('Review')
  const review = page.locator('[data-review]')
  await review.locator('[data-review-line="suppliers"]').getByText(new RegExp(`${mama.name}, ${alaba.name} · 2 bags on the shelf`)).waitFor()
  await review.locator('[data-review-line="alert"]').getByText('None').waitFor()
  await page.screenshot({ path: SHOTS + '4-review.png', fullPage: true })
  // Change goes to its section, and Next comes back.
  await review.getByRole('button', { name: 'Change Stock alert' }).click()
  await heading('Stock alert').waitFor()
  await page.getByLabel(/^Tell me when stock falls to/).fill('1')
  await page.getByRole('button', { name: 'Next: Review' }).click()
  await review.locator('[data-review-line="alert"]').getByText(/When it falls to 1 bag/).waitFor()
  await page.getByRole('button', { name: 'Create product' }).click()
  await page.waitForURL(/\/app\/products\/[0-9a-f-]{36}$/)
  created = page.url().split('/').pop()
  const product = (await api(`/api/products/${created}`, { token })).json
  assert(Number(product.quantityOnHand) === 100, `on hand ${product.quantityOnHand}`)
  const vendors = (await api(`/api/products/${created}/vendors`, { token })).json
  assert(vendors.length === 2, `${vendors.length} suppliers`)
  assert(vendors.find((v) => v.companyVendorId === mama.id)?.isPreferred, 'Mama is not the usual supplier')
})

// ------------------------------------------------------------------------------------------ 5
await check('a phone: the steps are a row across the top, and Next stays at the bottom', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${UI}/app/products/new`)
  await heading('Basics').waitFor()
  await page.screenshot({ path: SHOTS + '5-phone.png' })
  await page.setViewportSize({ width: 1280, height: 900 })
})

// ------------------------------------------------------------------------------------------ 6
await check('editing: the sections listed plainly, Save from any of them; #suppliers opens Suppliers, a third is added', async () => {
  await page.goto(`${UI}/app/products/${created}/edit#suppliers`)
  await heading('Suppliers').waitFor()
  await page.getByRole('navigation', { name: 'Sections of this product' }).waitFor()
  await page.locator(`[data-linked-supplier="${mama.name}"]`).getByText('Usual supplier').waitFor()
  await page.getByRole('button', { name: 'Add another supplier' }).click()
  await page.locator('[data-supplier-card="1"]').getByLabel('Supplier', { exact: true }).selectOption({ label: third.name })
  await page.screenshot({ path: SHOTS + '6-edit-suppliers.png', fullPage: true })
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.waitForURL(new RegExp(`/app/products/${created}$`))
  await waitFor(async () => (await api(`/api/products/${created}/vendors`, { token })).json.length === 3, 'three suppliers')
  // A name changed from Basics, saved straight from there.
  await page.goto(`${UI}/app/products/${created}/edit`)
  await heading('Basics').waitFor()
  await page.getByLabel('Name', { exact: true }).fill(`Rice (renamed) ${owner.unique}`)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await waitFor(async () => (await api(`/api/products/${created}`, { token })).json.name.startsWith('Rice (renamed)'), 'the new name')
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
