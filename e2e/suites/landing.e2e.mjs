// The Procurepaddy landing page (LANDING_PAGE_PLAN.md, steps 2 to 4), against the production
// preview (4173, whose routing mirrors public/_redirects) and the real API (8081). The page is built
// two ways, so this suite builds and checks both: first with the founding offer on (as staging would
// build it), then the early-access page production serves until the offer is switched on. It leaves
// the early-access build in place.
//
// Step 4 is the funnel after the button: the shop that booked a setup only sets a password, logs in
// with its WhatsApp number, and the team's queue shows the request until somebody replies.
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { API, UI, launchOptions, psqlCommand, shotsPrefix } from '../config.mjs'

const UI_DIR = fileURLToPath(new URL('../../', import.meta.url))
const build = (env = {}) =>
  execSync('npm run build', { cwd: UI_DIR, env: { ...process.env, VITE_API_BASE_URL: API, ...env }, stdio: 'ignore' })
const psql = (sql) => execSync(psqlCommand, { input: sql }).toString().trim()
// Every script the page actually loads, including ones it imports on demand, gzipped.
const landingScriptBytes = async (path = '/') => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const scripts = new Set()
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === UI && url.pathname.endsWith('.js')) scripts.add(url.pathname)
  })
  await page.goto(`${UI}${path}`)
  await page.waitForLoadState('networkidle')
  await context.close()
  let total = 0
  for (const src of scripts) total += gzipSync(Buffer.from(await fetch(`${UI}${src}`).then((r) => r.arrayBuffer()))).length
  return total
}

const SHOTS = shotsPrefix('landing')
const TITLE = 'Inventory App for Nigerian Shops & Warehouses | Procurepaddy'

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


// ===================================================================== the founding offer (step 3)
build({ VITE_FOUNDING_OFFER: 'true', SITE_NOINDEX: 'true' })
const randomNumber = (prefix) => `${prefix}${Math.floor(1_000_000 + Math.random() * 8_999_999)}`
const testNumber = randomNumber('0803')
const foundingNumber = randomNumber('0806')
const e164 = (local) => `+234${local.slice(1)}`
const run = randomUUID().slice(0, 6)
const PASSWORD = 'correct-horse-battery-staple'
let signupHref = null

await check('founding: the offer page is real HTML, with the FAQ marked up and every button a link that works without JavaScript', async () => {
  const html = await fetch(`${UI}/`).then((r) => r.text())
  assert(/<h1[^>]*>Know exactly what.{0,20}s in your shop within 24 hours/.test(html), 'the H1 is not the founding headline')
  assert(html.includes('"@type":"FAQPage"') && html.includes('How is this different from just using Excel?'), 'FAQPage JSON-LD missing')
  assert(html.includes('content="noindex, nofollow"'), 'a staging build must be noindex')
  const ctas = [...html.matchAll(/<a[^>]*data-cta="([^"]+)"[^>]*>/g)]
  assert(ctas.length >= 7, `only ${ctas.length} CTAs`)
  assert(ctas.every((m) => m[0].includes('href="/signup"')), 'a CTA that does nothing without JavaScript')
  assert(html.replace(/<!-- -->/g, '').includes('Offer ends 1 February 2027'), 'the deadline is not in the HTML')
})

await check('founding: still under 70 KB of JavaScript, gzipped', async () => {
  const total = await landingScriptBytes()
  console.log(`    ${Math.round(total / 1024)} KB of JavaScript, gzipped`)
  assert(total < 70 * 1024, `${Math.round(total / 1024)} KB`)
})

await check('founding: the live numbers show, the stamp turns SYNCED, and nothing errors', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${UI}/`)
  await page.locator('[data-scarcity]').first().getByText(/Founding setups left: \d+ of 100/).waitFor()
  await page.locator('[data-receipt="synced"]').waitFor({ timeout: 5000 })
  assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
  await context.close()
})

await check('founding: a button opens two fields; a wrong number is explained; a right one books the setup', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto(`${UI}/`)
  await page.locator('[data-island="setup"] dialog').waitFor({ state: 'attached' })
  await page.locator('[data-cta="hero"]').tap()
  const dialog = page.getByRole('dialog', { name: 'Get your free setup' })
  await dialog.waitFor()
  const fields = await dialog.locator('input:not([name="website"])').count()
  assert(fields === 2, `${fields} fields`)
  await dialog.getByLabel('Business name').fill(`E2E Landing Stores ${run}`)
  await dialog.getByLabel('WhatsApp number').fill('12345')
  await dialog.getByRole('button', { name: 'Book my setup' }).tap()
  await dialog.getByRole('alert').getByText('Enter a Nigerian mobile number, like 0803 123 4567.').waitFor()
  await dialog.getByLabel('WhatsApp number').fill(testNumber)
  await dialog.getByRole('button', { name: 'Book my setup' }).tap()
  const booked = page.getByRole('dialog', { name: "You're booked in." })
  await booked.waitFor()
  await booked.getByText(/booked for the week of|founding places are taken/).waitFor()
  const next = await booked.getByRole('link', { name: 'Create your password' }).getAttribute('href')
  assert(next.startsWith('/signup?setup='), next)
  signupHref = next
  const stored = psql(`SELECT business_name || '|' || whatsapp FROM setup_requests WHERE whatsapp = '+234${testNumber.slice(1)}';`)
  assert(stored === `E2E Landing Stores ${run}|+234${testNumber.slice(1)}`, `stored: ${stored}`)
  await page.screenshot({ path: SHOTS + '3-booked.png' })
  await context.close()
})

await check('founding: on a phone the sticky button appears after the hero and steps aside for an in-page one', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto(`${UI}/`)
  const sticky = page.locator('[data-cta="sticky"]')
  assert(!(await sticky.isVisible()), 'sticky bar shown over the hero')
  await page.locator('#how').scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 900)
  await sticky.waitFor({ state: 'visible', timeout: 5000 })
  await page.locator('[data-cta="offer"]').scrollIntoViewIfNeeded()
  await sticky.waitFor({ state: 'hidden', timeout: 5000 })
  await context.close()
})

await check('founding: axe finds nothing at phone or laptop size (WCAG 2.2 AA), with the form open too', async () => {
  const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto(`${UI}/`)
    await page.locator('[data-receipt="synced"]').waitFor({ timeout: 5000 }).catch(() => {})
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
    await page.addScriptTag({ path: AXE })
    const run = () =>
      page.evaluate(async () =>
        (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(
          (v) => `${v.id} ×${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`,
        ),
      )
    const page1 = await run()
    await page.locator('[data-cta="hero"]').click()
    await page.getByRole('dialog', { name: 'Get your free setup' }).waitFor()
    const dialog = await run()
    assert(page1.length === 0 && dialog.length === 0, `${viewport.width}px: ${[...page1, ...dialog].join(' | ')}`)
    await context.close()
  }
})


// ===================================================================== capture, then sign up (step 4)
await check('/founding is the offer with no way out but the button: no navigation, never indexed, canonical to /', async () => {
  const html = await fetch(`${UI}/founding`).then((r) => r.text())
  assert(/<h1[^>]*>Know exactly what/.test(html), 'not the offer page')
  assert(html.includes('<meta name="robots" content="noindex'), 'not noindex')
  assert(/<link rel="canonical" href="https?:\/\/[^"]+\/"/.test(html), 'canonical is not /')
  assert(!html.includes('aria-label="Procurepaddy home"'), 'the logo links home')
  assert(!html.includes('href="#faq"'), 'the header or footer still has navigation')
  assert(!html.includes('Talk to us about Procurepaddy Business'), 'the Business line is a second offer')
  assert(html.includes('href="/login"'), 'Log in should stay')

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto(`${UI}/founding`)
  await page.locator('[data-island="setup"] dialog').waitFor({ state: 'attached' })
  await page.locator('[data-cta="hero"]').tap()
  const dialog = page.getByRole('dialog', { name: 'Get your free setup' })
  await dialog.getByLabel('Business name').fill(`E2E Founding Ad ${run}`)
  await dialog.getByLabel('WhatsApp number').fill(foundingNumber)
  await dialog.getByRole('button', { name: 'Book my setup' }).tap()
  await page.getByRole('dialog', { name: "You're booked in." }).waitFor()
  const source = psql(`SELECT source FROM setup_requests WHERE whatsapp = '${e164(foundingNumber)}';`)
  assert(source === 'founding', `source: ${source}`)
  await page.screenshot({ path: SHOTS + '4-founding.png', fullPage: true })
  await context.close()
})

await check('the booked shop only sets a password; its Company ID is made for it; it logs in with its number', async () => {
  assert(signupHref, 'no sign-up link from the booking check')
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto(`${UI}${signupHref}`)
  await page.getByRole('heading', { name: 'Create your password' }).waitFor()
  assert((await page.getByLabel('Business name').inputValue()) === `E2E Landing Stores ${run}`, 'business name not filled in')
  assert((await page.getByLabel('WhatsApp number').inputValue()) === testNumber, 'number not filled in')
  await page.getByText(`e2e-landing-stores-${run}`).waitFor()
  await page.getByText('We load your products within 24 hours').waitFor()
  assert((await page.locator('input[type="password"]').count()) === 1, 'asked for the password twice')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Show' }).tap()
  assert((await page.getByLabel('Password').getAttribute('type')) === 'text', 'Show did not show the password')
  await page.screenshot({ path: SHOTS + '5-signup.png', fullPage: true })
  await page.getByRole('button', { name: 'Create my account' }).tap()

  const checklist = page.getByRole('region', { name: 'Set up your shop' })
  await checklist.waitFor({ timeout: 15000 })
  const companyId = (await checklist.locator('.font-mono').first().textContent()).trim()
  assert(companyId === `e2e-landing-stores-${run}`, `company id ${companyId}`)
  await checklist.getByText(`0803 ${testNumber.slice(4, 7)} ${testNumber.slice(7)}`).waitFor()
  await checklist.getByRole('button', { name: 'Send us your list' }).waitFor()
  await page.screenshot({ path: SHOTS + '6-welcome.png', fullPage: true })

  const linked = psql(
    `SELECT c.slug FROM setup_requests r JOIN clients c ON c.id = r.client_id WHERE r.whatsapp = '${e164(testNumber)}';`,
  )
  assert(linked === companyId, `the setup request is not linked to the account: "${linked}"`)
  await context.close()

  // A fresh phone: Company ID, the number as people type it, the password.
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const login = await fresh.newPage()
  await login.goto(`${UI}/login`)
  await login.getByLabel('Company ID').fill(companyId)
  await login.getByLabel('Phone, email or username').fill(`0803 ${testNumber.slice(4, 7)} ${testNumber.slice(7)}`)
  await login.getByLabel('Password').fill(PASSWORD)
  await login.getByRole('button', { name: 'Log in' }).tap()
  await login.waitForURL(/\/app/)
  await fresh.close()
})

await check('the team’s queue shows each request until somebody replies, and the reply opens WhatsApp with the message typed', async () => {
  const admin = `e2e-admin-${run}`
  psql(
    `INSERT INTO super_admins (username, password_hash) SELECT '${admin}', u.password_hash FROM users u JOIN clients c ON c.id = u.client_id WHERE c.slug = 'e2e-landing-stores-${run}' LIMIT 1;`,
  )
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' }))
    const page = await context.newPage()
    await page.goto(`${UI}/admin/login`)
    await page.getByLabel('Username').fill(admin)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: /Log in|Sign in/ }).click()
    await page.getByRole('link', { name: 'Setup Requests' }).click()
    await page.getByRole('heading', { name: 'Setup requests' }).waitFor()

    const row = page.getByRole('listitem').filter({ hasText: `E2E Founding Ad ${run}` })
    await row.waitFor()
    await row.getByText(/Waiting|Overdue/).first().waitFor()
    await row.getByText('/founding (ads, outreach)').waitFor()
    assert(/\(\d+\) Setup requests/.test(await page.title()), `the tab does not show the waiting count: ${await page.title()}`)
    await page.screenshot({ path: SHOTS + '7-queue.png', fullPage: true })

    const [chat] = await Promise.all([context.waitForEvent('page'), row.getByRole('link', { name: 'Reply on WhatsApp' }).click()])
    await chat.waitForURL(/wa\.me/)
    const chatUrl = decodeURIComponent(chat.url())
    assert(chatUrl.startsWith(`https://wa.me/${e164(foundingNumber).slice(1)}?text=Hello E2E Founding Ad ${run}, this is Procurepaddy.`), chatUrl)
    await chat.close()

    await page.getByRole('button', { name: /^In progress/ }).click()
    const moved = page.getByRole('listitem').filter({ hasText: `E2E Founding Ad ${run}` })
    await moved.waitFor()
    assert((await moved.getByLabel(/^Status of/).inputValue()) === 'CONTACTED', 'not marked contacted')
    const contacted = psql(`SELECT contacted_at IS NOT NULL FROM setup_requests WHERE whatsapp = '${e164(foundingNumber)}';`)
    assert(contacted === 't', 'contacted_at not stamped')

    // The account the other shop created shows on its row.
    await page.getByRole('button', { name: /^All/ }).click()
    await page.getByRole('listitem').filter({ hasText: `E2E Landing Stores ${run}` }).getByRole('link', { name: `Account: e2e-landing-stores-${run}` }).waitFor()
    await context.close()
  } finally {
    psql(`DELETE FROM super_admins WHERE username = '${admin}';`)
  }
})

psql(`DELETE FROM setup_requests WHERE whatsapp IN ('${e164(testNumber)}', '${e164(foundingNumber)}');`)

// ===================================================================== early access (step 2)
build()

await check('/ is real HTML a crawler can read: title, description, canonical, H1, JSON-LD', async () => {
  const html = await fetch(`${UI}/`).then((r) => r.text())
  assert(html.includes(`<title>${TITLE.replace('&', '&amp;')}</title>`), 'title missing')
  assert(/<meta name="description" content="[^"]{80,}"/.test(html), 'description missing or short')
  assert(/<link rel="canonical" href="https?:\/\/[^"]+\/"/.test(html), 'canonical missing')
  assert(/<h1[^>]*>Know exactly what/.test(html), 'the H1 is not in the HTML')
  assert(html.includes('"@type":"SoftwareApplication"') && html.includes('"priceCurrency":"NGN"'), 'JSON-LD missing')
  assert(html.includes('lang="en-NG"'), 'lang is not en-NG')
})

await check('robots.txt keeps crawlers out of the app and points at the sitemap, which lists /', async () => {
  const robots = await fetch(`${UI}/robots.txt`).then((r) => r.text())
  assert(robots.includes('Disallow: /app') && robots.includes('Disallow: /marketplace/checkout'), robots)
  assert(/Sitemap: https?:\/\/\S+\/sitemap\.xml/.test(robots), 'no sitemap line')
  const sitemap = await fetch(`${UI}/sitemap.xml`).then((r) => r.text())
  assert(/<loc>https?:\/\/[^<]+\/<\/loc>/.test(sitemap), sitemap)
})

await check('the landing page JavaScript stays under 70 KB gzipped', async () => {
  const total = await landingScriptBytes()
  console.log(`    ${Math.round(total / 1024)} KB of JavaScript, gzipped`)
  assert(total < 70 * 1024, `${Math.round(total / 1024)} KB`)
})

await check('it loads, hydrates without errors, is set in Plex, and its doors lead to sign up and log in', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${UI}/`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.waitForLoadState('networkidle')
  assert(errors.length === 0, `console errors: ${errors.join(' | ')}`)
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  assert(font.startsWith('"IBM Plex Sans Variable"'), font)
  assert((await page.getByRole('link', { name: 'Create your free account' }).first().getAttribute('href')) === '/signup', 'sign-up link')
  assert((await page.getByRole('link', { name: 'Log in' }).getAttribute('href')) === '/login', 'log-in link')
  const registered = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))
  assert(!registered, 'the landing page registered a service worker')
  await page.screenshot({ path: SHOTS + '1-phone.png', fullPage: true })
  await context.close()
})

await check('the marketplace’s old addresses move under /marketplace with their query strings', async () => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${UI}/?q=rice`)
  await page.waitForURL(/\/marketplace\?q=rice$/)
  await page.goto(`${UI}/product/some-product?ref=wa`)
  await page.waitForURL(/\/marketplace\/product\/some-product\?ref=wa$/)
  // Monnify's return: the payment reference must survive (the page then asks a stranger to log in).
  await page.goto(`${UI}/checkout/return?paymentReference=PR-123&transactionReference=T-9`)
  await page.waitForURL((url) => decodeURIComponent(url.href).includes('/marketplace/checkout/return?paymentReference=PR-123&transactionReference=T-9'))
  await page.goto(`${UI}/cart`)
  await page.waitForURL(/\/marketplace\/cart$/)
  await context.close()
})

// A company that has used the workspace on this browser.
const unique = randomUUID().slice(0, 8)
const signup = await fetch(`${API}/api/clients/signup`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: `E2E Landing ${unique}`,
    adminEmail: `landing-${unique}@example.com`,
    password: 'correct-horse-battery-staple',
    confirmPassword: 'correct-horse-battery-staple',
  }),
}).then((r) => r.json())

await check('someone signed in here is offered their workspace, and an installed app still shows the real page at /', async () => {
  const context = await browser.newContext()
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
  await page.goto(`${UI}/app`)
  await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, { timeout: 15000 })
  await page.goto(`${UI}/`)
  await page.getByRole('heading', { level: 1, name: /Know exactly what/ }).waitFor()
  assert((await page.title()) === TITLE, `got "${await page.title()}": the service worker answered / with the app`)
  const workspace = page.getByRole('link', { name: 'Open your workspace' }).first()
  await workspace.waitFor()
  assert((await workspace.getAttribute('href')) === '/app', 'workspace link')
  await page.screenshot({ path: SHOTS + '2-signed-in.png' })
  await context.close()
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
