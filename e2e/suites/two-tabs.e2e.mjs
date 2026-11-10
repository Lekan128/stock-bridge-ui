// Two tabs, two companies, one browser (the production bug of 2026-11-10). The refresh token is
// shared by every tab, so once tab 2 signed in as company B, tab 1's next token refresh came back
// as B and was adopted silently: tab 1 kept company A's name, cache and on-device catalogue while
// syncing B's products into them, and A's Inventory list showed B's products (at 0, as B's were).
// Now a tab whose session changes underneath it starts again as whoever is signed in.
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'

const SHOTS = shotsPrefix('two-tabs')
const PASSWORD = 'correct-horse-battery-staple'
let failed = 0
let total = 0
const ok = (cond, msg) => { total++; console.log(cond ? 'PASS' : 'FAIL', msg); if (!cond) failed++ }

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
  const { json } = await api('/api/clients/signup', {
    method: 'POST',
    body: { name: `${label} ${unique}`, adminEmail: `tabs-${label.toLowerCase()}-${unique}@example.com`, password: PASSWORD, confirmPassword: PASSWORD },
  })
  const created = { ...json }
  return { ...created, product: await addProduct(created, `${label} only ${unique}`) }
}
async function addProduct(c, name) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `TT-${randomUUID().slice(0, 8)}`, unitOfMeasure: 'KG' })], { type: 'application/json' }))
  const created = await api('/api/products', { token: c.tokens.accessToken, method: 'POST', body: form })
  if (created.status >= 300) throw new Error(`create ${name}: ${created.status}`)
  return name
}
/** A fresh refresh token for the company's owner, as a login in another tab would leave behind. */
async function loginRefreshToken(c) {
  const { json } = await api('/api/auth/login', {
    method: 'POST',
    body: { clientIdentifier: c.user.clientIdentifier, username: c.user.username, password: PASSWORD },
  })
  return json.tokens.refreshToken
}
const visible = (page, text) => page.getByText(text, { exact: true }).first().isVisible().catch(() => false)
/** Every product name in this tab's on-device catalogue, whatever the database is called. */
const catalogueNames = (page) =>
  page.evaluate(async () => {
    const names = []
    for (const { name } of await indexedDB.databases()) {
      if (!name?.startsWith('procurepaddy-catalog:')) continue
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(name)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      for (const store of db.objectStoreNames) {
        const rows = await new Promise((resolve) => {
          const req = db.transaction(store).objectStore(store).getAll()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve([])
        })
        for (const row of rows) if (typeof row?.name === 'string') names.push(`${name} ${row.name}`)
      }
      db.close()
    }
    return names
  })

const a = await company('Alpha')
const b = await company('Bravo')
const browser = await chromium.launch(launchOptions)

async function tabAsA() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  await context.addInitScript(([rt]) => {
    if (!localStorage.getItem('__seeded')) { localStorage.setItem('sb.refreshToken', rt); localStorage.setItem('__seeded', '1') }
  }, [await loginRefreshToken(a)])
  const page = await context.newPage()
  await page.goto(UI + '/app/products')
  await page.getByText(a.product, { exact: true }).first().waitFor({ timeout: 20000 })
  // Let the on-device copy finish its first load, so the next sync is a change feed with A's cursor.
  await page.waitForTimeout(2500)
  return { context, page }
}

// 1. The refresh itself: B's refresh token lands in storage with no signal to this tab (no profile
//    write), then A's access token is refused. The refresh that follows comes back as B.
{
  const { context, page } = await tabAsA()
  const bToken = await loginRefreshToken(b)
  await page.evaluate((rt) => localStorage.setItem('sb.refreshToken', rt), bToken)
  let refused = 0
  await page.route(`${API}/api/products/sync/**`, (route) => (refused++ === 0 ? route.fulfill({ status: 401, body: '{}' }) : route.continue()))
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.getByText(b.product, { exact: true }).first().waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2000)
  ok(refused >= 1, 'the sync was refused and a refresh followed')

  // B carries on loading products (the setup team, a colleague) while tab 1 stays open: before the
  // fix, tab 1's next sync pulled them into company A's copy and onto A's Inventory list.
  const later = await addProduct(b, `Bravo later ${randomUUID().slice(0, 8)}`)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(3000)
  const showsA = await visible(page, a.product)
  const showsLater = await visible(page, later)
  ok(!(showsA && showsLater), `never both companies' products on one list (A ${showsA}, B ${showsLater})`)
  ok(showsLater && !showsA, 'the tab started again as company B')
  const rows = await catalogueNames(page)
  // A catalogue database is named procurepaddy-catalog:<company>:<user>.
  const aCopyWithB = rows.filter((row) => row.split(' ')[0].endsWith(`:${a.user.id}`) && row.endsWith(later))
  ok(aCopyWithB.length === 0, `no copy of A's catalogue holds B's product (${aCopyWithB.join('; ') || 'none'})`)
  ok(await page.evaluate(() => localStorage.getItem('sb.refreshToken')) != null, "B's session was kept, not signed out")
  await page.screenshot({ path: SHOTS + 'refresh.png' })
  await context.close()
}

// 2. The fast path: tab 2 signs in as B, and tab 1 starts again as B straight away, before any
//    token of its own expires.
{
  const { context, page } = await tabAsA()
  const second = await context.newPage()
  const bToken = await loginRefreshToken(b)
  await second.goto(UI + '/login')
  await second.evaluate((rt) => localStorage.setItem('sb.refreshToken', rt), bToken)
  await second.goto(UI + '/app/products')
  await second.getByText(b.product, { exact: true }).first().waitFor({ timeout: 20000 })
  await page.getByText(b.product, { exact: true }).first().waitFor({ timeout: 10000 }).catch(() => {})
  ok(await visible(page, b.product), 'tab 1 now shows company B')
  ok(!(await visible(page, a.product)), "tab 1 no longer shows company A's products")
  await page.screenshot({ path: SHOTS + 'storage.png' })
  await context.close()
}

await browser.close()
console.log(`\n${total - failed}/${total} passed`)
process.exit(failed ? 1 : 0)
