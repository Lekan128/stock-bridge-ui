// Phase H accessibility: axe (WCAG 2.2 A/AA) on the screens a storekeeper uses, at phone and laptop
// sizes, plus what axe cannot see - focus into and back out of a sheet, the sync pill and stamps
// announced, 44 px touch targets in quick mode (plan §6, Phase H).
import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'

const SHOTS = shotsPrefix('a11y')
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const REPORT_ONLY = process.env.A11Y_REPORT === '1'

const results = []
let browser
async function check(name, fn) {
  try {
    await fn()
    results.push(['PASS', name])
    console.log('PASS', name)
  } catch (err) {
    results.push(['FAIL', name, err.message])
    console.log('FAIL', name, '\n   ', err.message.split('\n').slice(0, 12).join('\n    '))
    let i = 0
    for (const ctx of browser.contexts()) for (const pg of ctx.pages()) {
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
    body: {
      name: `E2E A11y ${unique}`,
      adminEmail: `a11y-${unique}@example.com`,
      password: 'correct-horse-battery-staple',
      confirmPassword: 'correct-horse-battery-staple',
    },
  })
).json
const token = signup.tokens.accessToken
async function createProduct(name, opening, low) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `AX-${name.replace(/\W+/g, '').slice(0, 8)}-${unique}`, unitOfMeasure: 'KG', packagingUnit: 'BAG', packagingSize: 50, lowStockThreshold: low })], { type: 'application/json' }))
  const product = (await api('/api/products', { token, method: 'POST', body: form })).json
  if (opening) await api(`/api/products/${product.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: opening } })
  return product
}
const rice = await createProduct('Rice (a11y)', 1000, 250)
await createProduct('Beans (a11y)', 100, 250)
await createProduct('Salt (a11y)', 0, 50)

browser = await chromium.launch(launchOptions)
let refreshToken = signup.tokens.refreshToken
async function profile(viewport) {
  const context = await browser.newContext({ viewport, ...(viewport.width < 500 ? { isMobile: true, hasTouch: true } : {}) })
  await context.addInitScript(
    ([rt]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('__seeded', '1')
      }
    },
    [refreshToken],
  )
  const page = await context.newPage()
  return { context, page }
}
async function keepToken(page) {
  refreshToken = (await page.evaluate(() => localStorage.getItem('sb.refreshToken'))) ?? refreshToken
}

/** axe on what is on screen now; returns violations as readable lines. */
async function axe(page, label) {
  // Colours are judged at rest: mid-animation (a stamp landing, a sheet sliding in) everything is
  // partly transparent and reads as low contrast.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
  await page.addScriptTag({ path: AXE })
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 4).map((n) => `${n.target.join(' ')}${n.any[0]?.message ? ` — ${n.any[0].message}` : ''}`),
      count: v.nodes.length,
    }))
  })
  const lines = violations.flatMap((v) => [`[${v.impact}] ${v.id} ×${v.count}: ${v.help}`, ...v.nodes.map((n) => `    ${n}`)])
  if (lines.length) console.log(`  axe ${label}:\n    ${lines.join('\n    ')}`)
  return violations
}
function assertClean(violations, label) {
  if (REPORT_ONLY) return
  assert(violations.length === 0, `${label}: ${violations.map((v) => `${v.id} ×${v.count}`).join(', ')}`)
}

// ------------------------------------------------------------------------------- axe, by screen
const SCREENS = [
  { name: 'Inventory', path: '/app/products', ready: (p) => p.getByRole('link', { name: 'Rice (a11y)' }).first().waitFor() },
  { name: 'Product', path: `/app/products/${rice.id}`, ready: (p) => p.getByRole('heading', { name: 'Rice (a11y)', level: 1 }).waitFor() },
  { name: 'Dashboard', path: '/app', ready: (p) => p.getByRole('heading', { name: /Stock health/ }).waitFor() },
  { name: 'Quick mode', path: '/app/quick', ready: (p) => p.getByRole('heading', { name: 'Quick mode' }).waitFor() },
  { name: 'Record a delivery', path: '/app/products/receive', ready: (p) => p.getByRole('heading', { level: 1, name: /delivery/i }).waitFor() },
]
for (const [size, viewport] of [
  ['phone', { width: 390, height: 844 }],
  ['laptop', { width: 1280, height: 860 }],
]) {
  const { context, page } = await profile(viewport)
  for (const screen of SCREENS) {
    await check(`axe, ${screen.name} (${size})`, async () => {
      await page.goto(UI + screen.path)
      await screen.ready(page)
      await page.waitForTimeout(600)
      assertClean(await axe(page, `${screen.name} (${size})`), screen.name)
    })
  }
  await keepToken(page)
  await context.close()
}

// ------------------------------------------------------------------------- beyond axe, on a phone
const { context, page } = await profile({ width: 390, height: 844 })
await page.goto(`${UI}/app/products/${rice.id}`)
await page.getByRole('heading', { name: 'Rice (a11y)', level: 1 }).waitFor()

await check('a sheet takes focus when it opens, keeps it, and gives it back when it closes', async () => {
  const trigger = page.getByRole('region', { name: 'Stock actions' }).getByRole('button', { name: 'Stock in' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  assert(await dialog.evaluate((d) => d.contains(document.activeElement)), 'focus did not move into the sheet')
  assertClean(await axe(page, 'Stock in sheet (phone)'), 'Stock in sheet')
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    assert(await dialog.evaluate((d) => d.contains(document.activeElement)), `Tab ${i + 1} left the sheet`)
  }
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  const back = await page.evaluate(() => document.activeElement?.textContent?.trim())
  assert(back === 'Stock in', `focus went back to "${back}", not the Stock in button`)
})

await check('the sync pill and the receipt stamps are announced', async () => {
  // The pill says nothing while all is caught up, and announces each change of state: going
  // offline must reach a screen reader through a live region.
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await page
    .locator('[role="status"]')
    .filter({ hasText: /^Offline$/ })
    .first()
    .waitFor({ state: 'attached', timeout: 5000 })
    .catch(() => {
      throw new Error('going offline was not announced in a live region')
    })
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.getByRole('region', { name: 'Stock actions' }).getByRole('button', { name: 'Stock in' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Quantity').fill('1')
  await dialog.getByRole('button', { name: 'Continue' }).click()
  await dialog.getByRole('button', { name: 'Confirm' }).click()
  await dialog.locator('[data-receipt="synced"]').waitFor()
  // The stamp is the picture; the receipt's live region says the same in words, once, as it
  // changes (wrapping the stamp too would read it out twice).
  const said = await dialog.locator('[role="status"]').allInnerTexts()
  assert(said.some((text) => /Recorded on the server/.test(text)), `the receipt's state was not announced: ${JSON.stringify(said)}`)
  assertClean(await axe(page, 'Stock receipt (phone)'), 'Stock receipt')
  await dialog.getByRole('button', { name: 'Done' }).click()
})

await check('quick mode: every control is at least 44 × 44 px', async () => {
  await page.goto(`${UI}/app/quick`)
  await page.getByRole('heading', { name: 'Quick mode' }).waitFor()
  const search = page.locator('#quick-search')
  await search.fill('rice (a11y)')
  await page.getByRole('button', { name: /Rice \(a11y\)/ }).click()
  await page.getByRole('group', { name: 'Keypad' }).waitFor()
  assertClean(await axe(page, 'Quick mode keypad (phone)'), 'Quick mode keypad')
  // Full screen over the workspace: nothing behind it can be reached by Tab or read out.
  const quick = page.getByRole('dialog', { name: 'Quick mode' })
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab')
    assert(await quick.evaluate((d) => d.contains(document.activeElement)), `Tab ${i + 1} left quick mode`)
  }
  assert(await page.evaluate(() => document.getElementById('root')?.inert === true), 'the workspace behind quick mode is not inert')
  const small = await quick.evaluate((dialog) =>
    [...dialog.querySelectorAll('button, a[href], input, select, [role="button"]')]
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect()
        return { name: (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }
      })
      .filter((t) => t.w < 44 || t.h < 44),
  )
  await page.screenshot({ path: SHOTS + 'quick-keypad.png' })
  assert(small.length === 0, `under 44 px: ${small.map((t) => `"${t.name}" ${t.w}×${t.h}`).join(', ')}`)
})
await context.close()

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
