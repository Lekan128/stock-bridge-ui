// End-to-end checks for the collapsed sidebar's hover peek (2026-11-10).
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'

const SHOTS = shotsPrefix('sidebar')
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
const owner = await signup('sidebar')
const context = await contextFor(owner)
const page = await context.newPage()
const panel = () => page.locator('aside[data-sidebar-peek], aside').first()
const label = (name) => page.locator('aside').first().getByText(name, { exact: true })

await check('collapsed, it opens over the page after half a second of hover, and closes when the pointer leaves', async () => {
  await page.goto(`${UI}/app/products`)
  await page.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor()
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await page.waitForTimeout(300)
  assert(!(await label('Stock Movements').isVisible()), 'labels still shown when collapsed')
  const mainBefore = await page.locator('main').boundingBox()
  const box = await panel().boundingBox()
  // Passing over quickly does nothing.
  await page.mouse.move(box.x + box.width / 2, box.y + 300)
  await page.waitForTimeout(200)
  await page.mouse.move(box.x + 600, box.y + 300)
  await page.waitForTimeout(500)
  assert(!(await label('Stock Movements').isVisible()), 'a quick pass opened it')
  // Resting on it opens it, over the page: the page doesn't move.
  await page.mouse.move(box.x + box.width / 2, box.y + 300)
  await label('Stock Movements').waitFor({ timeout: 2000 })
  assert(await page.locator('aside[data-sidebar-peek]').count() === 1, 'not a peek')
  const mainDuring = await page.locator('main').boundingBox()
  assert(Math.abs(mainDuring.x - mainBefore.x) < 1, `the page moved from ${mainBefore.x} to ${mainDuring.x}`)
  await page.screenshot({ path: SHOTS + '1-peek.png' })
  // Leaving closes it, and it is still collapsed.
  await page.mouse.move(box.x + 700, box.y + 300)
  await page.waitForTimeout(700)
  assert(!(await label('Stock Movements').isVisible()), 'it stayed open after the pointer left')
  await page.getByRole('button', { name: 'Expand sidebar' }).waitFor()
})

await check('a link in the peek goes there and the peek closes; » keeps it open', async () => {
  const box = await panel().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + 300)
  await label('Stock Movements').waitFor({ timeout: 2000 })
  await page.locator('aside').first().getByRole('link', { name: 'Stock Movements' }).click()
  await page.waitForURL(/stock-movements/)
  await page.mouse.move(box.x + 700, box.y + 300)
  await page.waitForTimeout(700)
  assert(!(await label('Stock Movements').isVisible()), 'the peek stayed open after choosing a page')
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await page.mouse.move(box.x + 900, box.y + 300)
  await page.waitForTimeout(700)
  await label('Stock Movements').waitFor()
  assert(await page.locator('aside[data-sidebar-peek]').count() === 0, 'pinned open, but still a peek')
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
