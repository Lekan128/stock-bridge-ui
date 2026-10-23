// End-to-end checks for multiple branches, Phase 1 (MULTI_BRANCH_UX_PLAN.md rules 1-3, sections 4 and
// 5.2), against the production preview (4173) and the real API (8081).
//   1. A one-branch company sees no branch word anywhere but Company settings (rule 1).
//   2. The second branch: the one-time question, the chip, the sheet's title, the write landing there.
//   3. A storekeeper at one branch: the name as plain text, no question, writes land at their branch.
//   4. "All branches": a stock sheet asks "Which branch?" before it can be saved.
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('branches')
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

async function signup(label) {
  const unique = randomUUID().slice(0, 8)
  const response = await api('/api/clients/signup', {
    method: 'POST',
    body: { name: `E2E ${label} ${unique}`, adminEmail: `${label}-${unique}@example.com`, password: PASSWORD, confirmPassword: PASSWORD },
  })
  return { ...response.json, unique }
}

async function createProduct(token, unique, name) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `BR-${name.slice(0, 4)}-${unique}`, unitOfMeasure: 'PIECE' })], { type: 'application/json' }))
  return (await api('/api/products', { token, method: 'POST', body: form })).json
}

/** A browser context signed in with this refresh token, as the other suites seed one. */
async function contextFor(refreshToken, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(
    ([rt]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        localStorage.setItem('__seeded', '1')
      }
    },
    [refreshToken],
  )
  return context
}

/** The visible text of the page, lower-cased, without the sidebar's fixed nav labels. */
async function visibleText(page) {
  return (await page.locator('main').innerText()).toLowerCase() + ' ' + (await page.locator('header').first().innerText()).toLowerCase()
}

browser = await chromium.launch(launchOptions)

// ------------------------------------------------------------------------------------------ 1
await check('a one-branch company sees no branch word anywhere but Company settings (rule 1)', async () => {
  const shop = await signup('one-branch')
  const product = await createProduct(shop.tokens.accessToken, shop.unique, 'Rice')
  const context = await contextFor(shop.tokens.refreshToken)
  const page = await context.newPage()
  const screens = ['/app', '/app/products', `/app/products/${product.id}`, '/app/stock-movements', '/app/users']
  for (const path of screens) {
    await page.goto(UI + path)
    await page.waitForLoadState('networkidle')
    const text = await visibleText(page)
    assert(!text.includes('branch'), `"branch" on ${path}`)
  }
  await page.goto(`${UI}/app/products/${product.id}`)
  await page.getByRole('button', { name: 'Stock in', exact: true }).first().click()
  await page.getByRole('dialog').waitFor()
  assert(!(await page.getByRole('dialog').innerText()).toLowerCase().includes('branch'), 'the stock-in sheet names a branch')
  assert((await page.getByRole('button', { name: /^Branch:/ }).count()) === 0, 'a branch chip is shown')
  await page.goto(UI + '/app/company')
  await page.getByRole('link', { name: /Branches/ }).waitFor()
  await context.close()
})

// ------------------------------------------------------------------------------------------ 2
const owner = await signup('two-branch')
const ownerToken = owner.tokens.accessToken
const rice = await createProduct(ownerToken, owner.unique, 'Beans')
await api(`/api/products/${rice.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity: 12 } })
const oshodi = (await api('/api/branches', { token: ownerToken, method: 'POST', body: { name: 'Oshodi' } })).json

await check('the second branch: the question once, the chip, the sheet title, and the stock lands there', async () => {
  const context = await contextFor(owner.tokens.refreshToken)
  const page = await context.newPage()
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: 'Which branch are you at?' }).waitFor()
  await page.getByLabel('Oshodi').check()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: /^Branch: Oshodi/ }).waitFor()

  await page.getByRole('button', { name: 'Stock in', exact: true }).first().click()
  await page.getByRole('dialog').getByText('Stock in · Oshodi').waitFor()
  await page.getByRole('dialog').getByLabel(/how many|quantity/i).first().fill('5')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.getByRole('dialog').getByText(/recorded|saved/i).first().waitFor()

  const detail = (await api(`/api/products/${rice.id}`, { token: ownerToken })).json
  const at = Object.fromEntries((detail.branchStock ?? []).map((entry) => [entry.branchId, entry.quantityOnHand]))
  assert(at[oshodi.id] === 5, `Oshodi holds ${at[oshodi.id]}, expected 5`)
  assert(detail.quantityOnHand === 17, `company figure ${detail.quantityOnHand}, expected 17`)

  await page.reload()
  await page.getByRole('button', { name: /^Branch: Oshodi/ }).waitFor()
  assert((await page.getByRole('heading', { name: 'Which branch are you at?' }).count()) === 0, 'asked again after a reload')
  await context.close()
})

// ------------------------------------------------------------------------------------------ 3
await check('a storekeeper at one branch: the name as plain text, no question, writes land at their branch', async () => {
  const roles = (await api('/api/roles', { token: ownerToken })).json
  const storekeeper = roles.find((role) => role.name === 'STOREKEEPER')
  const created = await api('/api/users', {
    token: ownerToken,
    method: 'POST',
    body: { username: `ade-${owner.unique}`, password: PASSWORD, roleId: storekeeper.id, branchIds: [oshodi.id] },
  })
  assert(created.status === 201, `user not created: ${created.status}`)
  const login = (await api('/api/auth/login', {
    method: 'POST',
    body: { clientIdentifier: owner.user.clientIdentifier, username: `ade-${owner.unique}`, password: PASSWORD },
  })).json
  const context = await contextFor(login.tokens.refreshToken)
  const page = await context.newPage()
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('heading', { name: rice.name, level: 1 }).waitFor()
  assert((await page.getByRole('heading', { name: 'Which branch are you at?' }).count()) === 0, 'asked which branch')
  assert((await page.getByRole('button', { name: /^Branch:/ }).count()) === 0, 'offered a branch menu')
  await page.locator('header').getByText('Oshodi').waitFor()

  await page.getByRole('button', { name: 'Stock in', exact: true }).first().click()
  await page.getByRole('dialog').getByText('Stock in · Oshodi').waitFor()
  await context.close()
})

// ------------------------------------------------------------------------------------------ 4
await check('"All branches": a stock sheet asks which branch before it can be saved', async () => {
  const context = await contextFor(owner.tokens.refreshToken)
  await context.addInitScript(([userId]) => localStorage.setItem(`pp.working-branch.${userId}`, 'ALL'), [owner.user.id])
  const page = await context.newPage()
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('button', { name: /^Branch: All branches/ }).waitFor()
  await page.getByRole('button', { name: 'Stock in', exact: true }).first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByText('Which branch?').waitFor()
  await sheet.getByRole('radio', { name: 'Oshodi' }).click()
  await sheet.getByText('Stock in · Oshodi').waitFor()
  await context.close()
})

await browser.close()
const failed = results.filter(([status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
