// A shop's first week (LANDING_PAGE_PLAN.md, step 5), against the production preview (4173) and
// the real API (8081): the owner's setup checklist and "Send us your list"; the team downloading
// the list, opening the shop as Procurepaddy support and leaving again; the checklist ticking as
// products arrive and the shop records its first delivery; and the team's first-week list with
// the message that's due.
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { API, UI, launchOptions, psqlCommand, shotsPrefix } from '../config.mjs'

const psql = (sql) => execSync(psqlCommand, { input: sql }).toString().trim()
const SHOTS = shotsPrefix('first-week')
const PASSWORD = 'correct-horse-battery-staple'
const run = randomUUID().slice(0, 6)
const local = `0805${Math.floor(1_000_000 + Math.random() * 8_999_999)}`
const e164 = `+234${local.slice(1)}`
const SHOP = `E2E First Week ${run}`

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const axeScan = async (page) => {
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () =>
    (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(
      (v) => `${v.id} ×${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`,
    ),
  )
}

const results = []
const browser = await chromium.launch(launchOptions)
async function check(name, fn) {
  try {
    await fn()
    results.push(['PASS', name])
    console.log('PASS', name)
  } catch (err) {
    results.push(['FAIL', name, err.message])
    console.log('FAIL', name, '\n   ', err.message.split('\n').slice(0, 3).join(' | '))
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
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  return { status: response.status, json: text ? JSON.parse(text) : null }
}

// A shop that has just signed up with its WhatsApp number, and a super admin for the team.
const owner = (await api('/api/clients/signup', { method: 'POST', body: { name: SHOP, phone: local, password: PASSWORD } })).json
const companyId = owner.user.clientIdentifier
const admin = `e2e-admin-${run}`
psql(`INSERT INTO super_admins (username, password_hash) SELECT '${admin}', u.password_hash FROM users u JOIN clients c ON c.id = u.client_id WHERE c.slug = '${companyId}' LIMIT 1;`)
const adminToken = (await api('/api/superadmin/auth/login', { method: 'POST', body: { username: admin, password: PASSWORD } })).json.tokens.accessToken
const clientId = psql(`SELECT id FROM clients WHERE slug = '${companyId}';`)

/** A phone signed in as the owner: a fresh login each time (refresh tokens rotate), with the phone number. */
async function ownerPhone() {
  const login = (await api('/api/auth/login', { method: 'POST', body: { clientIdentifier: companyId, username: local, password: PASSWORD } })).json
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await context.addInitScript(
    ([rt, welcome, id]) => {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('sb.lastClientIdentifier', id)
        localStorage.setItem('pp.welcome.v1', welcome)
        sessionStorage.setItem('__seeded', '1')
      }
    },
    [login.tokens.refreshToken, JSON.stringify({ clientIdentifier: companyId, username: e164, fromSetup: false }), companyId],
  )
  return context
}

await check('a new owner sees the setup checklist: the Company ID, how they log in, and four things to do', async () => {
  const context = await ownerPhone()
  const page = await context.newPage()
  await page.goto(`${UI}/app`)
  const checklist = page.getByRole('region', { name: 'Set up your shop' })
  await checklist.waitFor({ timeout: 20000 })
  await checklist.getByText(companyId).waitFor()
  await checklist.getByText(`0805 ${local.slice(4, 7)} ${local.slice(7)}`).waitFor()
  await checklist.getByText('0 of 4 done').waitFor()
  for (const title of ['Add your products', 'Record your first delivery or count', 'Put Procurepaddy on your phone', 'Add your staff']) {
    await checklist.getByRole('heading', { name: new RegExp(`^${title}`) }).waitFor()
  }
  await checklist.getByText('After your products are in.').waitFor()
  await page.screenshot({ path: SHOTS + '1-checklist.png', fullPage: true })
  await context.close()
})

await check('"Send us your list" sends a spreadsheet and a photo, and the checklist says the list is being loaded', async () => {
  const context = await ownerPhone()
  const page = await context.newPage()
  await page.goto(`${UI}/app`)
  const checklist = page.getByRole('region', { name: 'Set up your shop' })
  await checklist.getByRole('button', { name: 'Send us your list' }).tap()
  const sheet = page.getByRole('dialog', { name: 'Send us your list' })
  await sheet.waitFor()
  const violations = await axeScan(page)
  assert(violations.length === 0, `axe, with the sheet open: ${violations.join(' | ')}`)
  // A 1×1 PNG stands in for a photo of the stock book.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await sheet.getByLabel('Choose files to send').setInputFiles([
    { name: 'stock.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Qty\nRice (50 kg bag),10\nBeans,4\n') },
    { name: 'book-page-1.png', mimeType: 'image/png', buffer: png },
  ])
  await sheet.getByRole('button', { name: 'Send 2 files' }).tap()
  await sheet.getByText(/^Sent\. We.ll load your products within 24 hours/).waitFor()
  await page.screenshot({ path: SHOTS + '2-sent.png' })
  await sheet.getByRole('button', { name: 'Done' }).tap()
  await checklist.getByText(/We have your list and we.re loading it/).waitFor()
  const request = psql(`SELECT source || '|' || status FROM setup_requests WHERE client_id = '${clientId}';`)
  assert(request === 'app|LIST_RECEIVED', `setup request: ${request}`)
  assert(psql(`SELECT count(*) FROM product_list_files WHERE client_id = '${clientId}';`) === '2', 'files not stored')
  await context.close()
})

await check('the team finds the list, downloads it, and opens the shop as Procurepaddy support, then leaves', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const page = await context.newPage()
  await page.goto(`${UI}/admin/login`)
  await page.getByLabel('Username').fill(admin)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.getByRole('link', { name: 'Setup Requests' }).click()
  const row = page.getByRole('listitem').filter({ hasText: SHOP })
  await row.waitFor()
  await row.locator('span').filter({ hasText: /^List received$/ }).waitFor()
  await row.getByText(/Waiting|Overdue/).first().waitFor()
  await row.getByRole('button', { name: '2 files sent with Send us your list' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), row.getByRole('button', { name: /stock\.csv/ }).click()])
  assert(download.suggestedFilename() === 'stock.csv', download.suggestedFilename())
  await page.screenshot({ path: SHOTS + '3-queue.png', fullPage: true })

  await row.getByRole('button', { name: 'Open their workspace' }).click()
  await page.waitForURL(/\/app\/products\/import/)
  const banner = page.getByRole('status').filter({ hasText: 'as Procurepaddy support' })
  await banner.waitFor()
  await page.screenshot({ path: SHOTS + '4-support.png' })
  await banner.getByRole('button', { name: 'Leave this shop' }).click()
  await page.waitForURL(/\/admin\/setup-requests/)
  await page.getByRole('heading', { name: 'Setup requests' }).waitFor()
  const support = psql(`SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.client_id = '${clientId}' AND u.username = 'procurepaddy-support';`)
  assert(support === 'PROCUREPADDY_SUPPORT', `support user: ${support}`)
  await context.close()
})

// Support loads a product with opening stock (as the import would), then the shop records a delivery.
const supportSession = (await api(`/api/superadmin/clients/${clientId}/support-session`, { token: adminToken, method: 'POST' })).json
const productForm = new FormData()
productForm.append('product', new Blob([JSON.stringify({ name: `Rice (50 kg bag) ${run}`, sku: `RICE-${run}`, unitPrice: 45000, lowStockThreshold: 2 })], { type: 'application/json' }))
const created = await fetch(`${API}/api/products`, { method: 'POST', headers: { Authorization: `Bearer ${supportSession.tokens.accessToken}` }, body: productForm })
const productId = psql(`SELECT id FROM products WHERE client_id = '${clientId}' AND sku = 'RICE-${run}';`)

await check('products loaded by support tick the first item; the shop’s own first delivery ticks the second', async () => {
  assert(created.ok && productId, `support could not create a product: ${created.status}`)
  const context = await ownerPhone()
  const page = await context.newPage()
  await page.goto(`${UI}/app`)
  const checklist = page.getByRole('region', { name: 'Set up your shop' })
  await checklist.getByText('1 product in.').waitFor({ timeout: 20000 })
  await checklist.getByText('1 of 4 done').waitFor()
  await checklist.getByRole('link', { name: 'Open quick mode' }).waitFor()

  const stockIn = await api(`/api/products/${productId}/stock/stock-in`, { token: owner.tokens.accessToken, method: 'POST', body: { quantity: 5, unitPrice: 40000 } })
  assert(stockIn.status < 300, `stock in: ${stockIn.status}`)
  await page.reload()
  await checklist.getByText('1 stock change recorded.').waitFor({ timeout: 20000 })
  await checklist.getByText('2 of 4 done').waitFor()
  await page.screenshot({ path: SHOTS + '5-ticking.png', fullPage: true })
  await context.close()
})

await check('the first-week list shows the shop activated and writes the message that’s due with its own numbers', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' }))
  const page = await context.newPage()
  await page.goto(`${UI}/admin/login`)
  await page.getByLabel('Username').fill(admin)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.getByRole('link', { name: 'First Week' }).click()
  await page.getByPlaceholder('Find a shop or Company ID').fill(companyId)
  const row = page.getByRole('listitem').filter({ hasText: SHOP })
  await row.waitFor()
  await row.getByText('Activated', { exact: true }).waitFor()
  await row.getByText(/^after /).waitFor()

  const [chat] = await Promise.all([context.waitForEvent('page'), row.getByRole('link', { name: 'Send on WhatsApp' }).click()])
  await chat.waitForURL(/wa\.me/)
  const text = decodeURIComponent(chat.url())
  assert(text.startsWith(`https://wa.me/${e164.slice(1)}?text=Hello ${SHOP}, welcome to Procurepaddy. Your Company ID is ${companyId}`), text)
  await chat.close()
  // Welcome sent; the next one due is "products are in", with the real count.
  await row.getByText(/your 1 product is in Procurepaddy/).waitFor()
  assert(psql(`SELECT count(*) FROM onboarding_messages WHERE client_id = '${clientId}' AND kind = 'WELCOME';`) === '1', 'welcome not recorded')
  // Not full-page: a local database holds every test shop of the last 30 days.
  await row.scrollIntoViewIfNeeded()
  await page.screenshot({ path: SHOTS + '6-first-week.png' })
  await context.close()
})

await check('axe finds nothing on the checklist or the first-week page (the list sheet is checked above)', async () => {
  const phone = await ownerPhone()
  const page = await phone.newPage()
  await page.goto(`${UI}/app`)
  await page.getByRole('region', { name: 'Set up your shop' }).waitFor({ timeout: 20000 })
  const dashboard = await axeScan(page)
  await phone.close()

  const laptop = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const adminPage = await laptop.newPage()
  await adminPage.goto(`${UI}/admin/login`)
  await adminPage.getByLabel('Username').fill(admin)
  await adminPage.getByLabel('Password').fill(PASSWORD)
  await adminPage.getByRole('button', { name: 'Log in' }).click()
  await adminPage.getByRole('link', { name: 'First Week' }).click()
  await adminPage.getByPlaceholder('Find a shop or Company ID').fill(companyId)
  await adminPage.getByRole('listitem').filter({ hasText: SHOP }).waitFor()
  const firstWeek = await axeScan(adminPage)
  await laptop.close()
  const all = [...dashboard, ...firstWeek]
  assert(all.length === 0, all.join(' | '))
})

psql(`DELETE FROM super_admins WHERE username = '${admin}'; DELETE FROM setup_requests WHERE client_id = '${clientId}';`)
await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
