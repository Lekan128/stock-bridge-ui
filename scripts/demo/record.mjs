// Records the 2-minute demo (LANDING_PAGE_PLAN.md §2 "Watch it work", step 6's proof): the real app on
// a phone-sized screen, driven by this script, with a caption at the top saying what is happening.
// Nothing is staged but the shop: a fresh demo shop with real products, and a storekeeper, Amaka.
//
//   Needs the API (E2E_API, default :8081) and a production preview of the UI (E2E_UI, default :4173).
//   node scripts/demo/record.mjs
//
// Writes public/marketing/demo.webm, public/marketing/demo-poster.jpg and src/marketing/demo-chapters.json
// (the chapters and the length, which the /demo page and its VideoObject read).
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { renameSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { API, UI, launchOptions } from '../../e2e/config.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const TMP = `${ROOT}node_modules/.tmp/demo-video/`
const PASSWORD = 'correct-horse-battery-staple'
const unique = randomUUID().slice(0, 6)

async function api(path, { token, method = 'GET', body } = {}) {
  const form = body instanceof FormData
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !form ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

// ---------------------------------------------------------------------------- the demo shop
const owner = await api('/api/clients/signup', {
  method: 'POST',
  body: { name: 'Mama Tee Stores', adminEmail: `demo-${unique}@example.com`, phone: `0803${Math.floor(1_000_000 + Math.random() * 8_999_999)}`, password: PASSWORD },
})
const token = owner.tokens.accessToken
const company = owner.user.clientIdentifier
const products = {}
for (const [key, name, unit, pack, size, opening, low] of [
  ['rice', 'Rice (Mama Gold)', 'KG', 'BAG', 50, 400, 100],
  ['noodles', 'Indomie Chicken', 'PIECE', 'CARTON', 40, 160, 80],
  ['oil', 'Groundnut oil', 'LITER', 'KEG', 25, 30, 50],
  ['milk', 'Peak Milk (tin)', 'PIECE', 'CARTON', 48, 96, 24],
  ['sugar', 'Sugar (St Louis)', 'PIECE', null, null, 60, 20],
  ['semo', 'Semovita 1 kg', 'PIECE', null, null, 45, 10],
]) {
  const form = new FormData()
  const body = { name, sku: `${key.toUpperCase()}-${unique}`, unitOfMeasure: unit, lowStockThreshold: low, ...(pack ? { packagingUnit: pack, packagingSize: size } : {}) }
  form.append('product', new Blob([JSON.stringify(body)], { type: 'application/json' }))
  products[key] = await api('/api/products', { token, method: 'POST', body: form })
  await api(`/api/products/${products[key].id}/stock/stock-in`, { token, method: 'POST', body: { quantity: opening } })
}
const roles = await api('/api/roles', { token })
const storekeeper = roles.find((role) => role.name === 'STOREKEEPER')
await api('/api/users', { token, method: 'POST', body: { username: 'amaka', password: PASSWORD, roleId: storekeeper.id, firstName: 'Amaka', lastName: 'Obi' } })
const amaka = await api('/api/auth/login', { method: 'POST', body: { clientIdentifier: company, username: 'amaka', password: PASSWORD } })
// The owner, for the last scene: what Amaka recorded, seen from the owner's phone. A login of its own
// (refresh tokens rotate), and a first name, so the history reads like the shop's.
await api('/api/me', { token, method: 'PUT', body: { firstName: 'Tee', lastName: 'Adeyemi' } }).catch(() => undefined)
const ownerLogin = await api('/api/auth/login', { method: 'POST', body: { clientIdentifier: company, username: owner.user.username, password: PASSWORD } })

// ---------------------------------------------------------------------------- recording
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
const browser = await chromium.launch(launchOptions)
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  // The video is captured at the screen's own size (CSS pixels), whatever the pixel ratio: a larger
  // size only pads it with grey. (The poster screenshot does use the 2x ratio.)
  recordVideo: { dir: TMP, size: { width: 390, height: 844 } },
})
await context.addInitScript(
  ([rt, id]) => {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.setItem('sb.refreshToken', rt)
      localStorage.setItem('sb.lastClientIdentifier', id)
      sessionStorage.setItem('__seeded', '1')
    }
    window.__caption = (text) => {
      let box = document.getElementById('__demo-caption')
      if (!box) {
        box = document.createElement('div')
        box.id = '__demo-caption'
        box.setAttribute('aria-hidden', 'true')
        box.style.cssText =
          'position:fixed;left:10px;right:10px;top:10px;z-index:2147483647;background:rgba(8,32,91,.94);color:#fff;font:600 17px/1.35 "IBM Plex Sans Variable",system-ui,sans-serif;padding:12px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none'
        document.body.appendChild(box)
      }
      box.textContent = text
    }
  },
  [amaka.tokens.refreshToken, company],
)
const page = await context.newPage()
const t0 = Date.now()
const chapters = []
const wait = (ms) => page.waitForTimeout(ms)
async function caption(title, text, hold = 0) {
  chapters.push({ at: Math.round((Date.now() - t0) / 1000), title, caption: text })
  await page.evaluate((t) => window.__caption?.(t), text)
  if (hold) await wait(hold)
}
const search = () => page.getByPlaceholder('Scan, or type a name or code')
const keypad = async (keys) => {
  for (const key of keys) {
    await page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: key, exact: true }).click()
    await wait(260)
  }
}
const card = (heading, sub) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:14px;padding:0 28px;background:#08205B;color:#fff;font-family:system-ui,sans-serif">
  <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-.01em">Procurepaddy</p>
  <h1 style="margin:0;font-size:34px;line-height:1.1;font-weight:800">${heading}</h1>
  <p style="margin:0;font-size:18px;color:#D6E8FF;line-height:1.4">${sub}</p></body></html>`

await page.setContent(card('Your shop’s stock, on your phone.', 'A real recording of the app. The shop is a demo: Mama Tee Stores, and Amaka, its storekeeper.'))
chapters.push({ at: 0, title: 'Start', caption: 'A real recording of the app on a phone, in a demo shop: Mama Tee Stores, and Amaka, its storekeeper.' })
await wait(4000)

await page.goto(`${UI}/app/products`)
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor({ timeout: 30000 })
await page.waitForTimeout(3000)
await caption('The stock', 'Amaka’s phone: every product in the shop, how much is left, and what is running low.', 4500)

await page.getByRole('button', { name: 'Quick mode' }).click()
await search().waitFor()
await caption('A delivery', 'A delivery arrives: 2 bags of rice. Quick mode: find it, tap the amount.', 1500)
await search().pressSequentially('rice', { delay: 120 })
await page.getByRole('button', { name: /Rice \(Mama Gold\)/ }).click()
await wait(700)
await keypad(['2'])
await page.getByText('2 bags (100 kg)').first().waitFor()
await wait(900)
await page.screenshot({ path: `${ROOT}public/marketing/demo-poster.jpg`, type: 'jpeg', quality: 82 })
await page.getByRole('button', { name: 'Stock in 2 bags (100 kg)' }).click()
await page.locator('[role="status"] [data-stamp="synced"]').first().waitFor()
await caption('Bags and kilos', 'Recorded and sent. 2 bags is 100 kg: the app does the sum.', 3500)

await context.setOffline(true)
await caption('No network', 'Now the network drops. A customer buys 3 kg of rice. Amaka records it anyway.', 1500)
await page.getByRole('button', { name: 'Stock out', exact: true }).click()
await wait(500)
await search().pressSequentially('rice', { delay: 120 })
await page.getByRole('button', { name: /Rice \(Mama Gold\)/ }).click()
await wait(600)
await keypad(['3'])
await wait(600)
await page.getByRole('button', { name: /^Stock out 3 kg/ }).click()
await page.locator('[data-stamp="recorded"]').first().waitFor()
await caption('Saved on the phone', 'Saved on the phone, marked RECORDED. Nothing is lost, and there is nothing to retype.', 4000)

await context.setOffline(false)
await page.evaluate(() => window.dispatchEvent(new Event('online')))
await caption('Back online', 'Back online: it sends itself, exactly once. RECORDED turns SYNCED.', 0)
await page.locator('[data-stamp="synced"]').first().waitFor({ timeout: 30000 })
await wait(3000)

// Back to the list until the phone's figure includes the sale (500 + 0 − 3 after the delivery: 497).
// (The list folds a synced sale into its figure on its next catch-up with the server; opening the
// app again does that at once, so the scene isn't 15 seconds of waiting.)
await page.getByRole('button', { name: 'Exit' }).click()
await page.reload()
await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
await page.getByText('497', { exact: true }).first().waitFor({ timeout: 30000 })
await page.getByText('497', { exact: true }).first().scrollIntoViewIfNeeded()
await caption('Up to date', 'The stock list is right: 497 kg of rice.', 3000)
await page.getByRole('button', { name: 'Quick mode' }).click()
await search().waitFor()
await caption('A count', 'Count the shelf. The app expects 497 kg of rice; Amaka finds 487.', 1200)
await page.getByRole('button', { name: 'Count', exact: true }).click()
await wait(500)
await search().pressSequentially('rice', { delay: 120 })
await page.getByRole('button', { name: /Rice \(Mama Gold\)/ }).click()
await wait(600)
await keypad(['4', '8', '7'])
await page.getByText('vs what the app says').waitFor()
await page.locator('[data-stock-figure]').getByText('−10').waitFor({ timeout: 5000 })
await caption('What is missing', '10 kg is missing, shown straight away, while people still remember what happened.', 4500)
await page.getByRole('button', { name: /^Record count: 487 kg/ }).click()
await search().waitFor({ timeout: 6000 })
await wait(1000)

// The owner's phone: the same shop, signed in as the owner.
await page.evaluate(
  ([rt]) => {
    localStorage.removeItem('sb.sessionProfile.v1')
    localStorage.setItem('sb.refreshToken', rt)
  },
  [ownerLogin.tokens.refreshToken],
)
await page.goto(`${UI}/app/products/${products.rice.id}`)
await page.getByRole('heading', { name: /Rice \(Mama Gold\)/ }).first().waitFor({ timeout: 20000 })
const byAmaka = page.getByText('Amaka Obi').first()
await byAmaka.waitFor({ timeout: 20000 })
await byAmaka.scrollIntoViewIfNeeded()
await page.evaluate(() => window.scrollBy(0, 120))
await caption('Who did what', 'The owner’s phone: every change carries a name and a time. Amaka’s delivery, sale and count.', 5500)

await page.setContent(card('Get your free setup.', 'Send us your product list and we load it within 24 hours. procurepaddy.com · WhatsApp +234 818 410 3312'))
chapters.push({ at: Math.round((Date.now() - t0) / 1000), title: 'Get started', caption: 'Send us your product list and we load it within 24 hours.' })
await wait(4500)
const durationSeconds = Math.round((Date.now() - t0) / 1000)

await page.close()
await context.close()
await browser.close()
const recorded = readdirSync(TMP).find((file) => file.endsWith('.webm'))
renameSync(`${TMP}${recorded}`, `${ROOT}public/marketing/demo.webm`)
writeFileSync(`${ROOT}src/marketing/demo-chapters.json`, `${JSON.stringify({ durationSeconds, chapters }, null, 2)}\n`)
console.log(`recorded ${durationSeconds}s, ${chapters.length} chapters, demo shop ${company}`)
