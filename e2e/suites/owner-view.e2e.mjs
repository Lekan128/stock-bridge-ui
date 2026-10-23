// End-to-end checks for multiple branches, Phase 3 - the owner's view (MULTI_BRANCH_UX_PLAN.md §5.7, §5.8,
// §10), against the production preview (4173) and the real API (8081).
//   1. "Every depot from home in under 10 s": All branches opens on the branch table, every branch's
//      figures in one place, in under 10 seconds.
//   2. A figure opens its screen at that branch, and says so ("Opened at Oshodi").
//   3. Phones: a branch whose phone has writes waiting says so.
//   4. On a phone the table is one card per branch.
//   5. Losses: missing on the way and expired stock, at cost; By branch in All branches.
//   6. A one-branch company's Losses page has no branch word (rule 1).
//   7. axe on the branch table and Losses.
import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('owner-view')
const PASSWORD = 'correct-horse-battery-staple'
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')

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
  const email = `${label}-${unique}@example.com`
  const response = await api('/api/clients/signup', {
    method: 'POST',
    body: { name: `E2E ${label} ${unique}`, adminEmail: email, password: PASSWORD, confirmPassword: PASSWORD },
  })
  return { ...response.json, unique, email }
}

async function login(clientIdentifier, username) {
  return (await api('/api/auth/login', { method: 'POST', body: { clientIdentifier, username, password: PASSWORD } })).json
}

async function createProduct(token, unique, name) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `OV-${name.slice(0, 4)}-${unique}`, unitOfMeasure: 'PIECE' })], { type: 'application/json' }))
  return (await api('/api/products', { token, method: 'POST', body: form })).json
}

async function contextFor(session, workingBranch, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(
    ([rt, userId, branch]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        if (branch) localStorage.setItem(`pp.working-branch.${userId}`, branch)
        localStorage.setItem('__seeded', '1')
      }
    },
    [session.tokens.refreshToken, session.user.id, workingBranch ?? null],
  )
  return context
}

async function axe(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return result.violations.map((v) => `${v.id} ×${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)
  })
}

browser = await chromium.launch(launchOptions)

// --------------------------------------------------------------------------------------- setup
const owner = await signup('owner-view')
const ownerToken = owner.tokens.accessToken
await api('/api/company/selling', { token: ownerToken, method: 'PUT', body: { sellsStock: true } })
const rice = await createProduct(ownerToken, owner.unique, 'Rice')
const headOffice = (await api('/api/branches', { token: ownerToken })).json.branches[0]
const oshodi = (await api('/api/branches', { token: ownerToken, method: 'POST', body: { name: 'Oshodi' } })).json
for (const [branchId, quantity] of [[headOffice.id, 20], [oshodi.id, 6]]) {
  await api(`/api/products/${rice.id}/stock/stock-in`, { token: ownerToken, method: 'POST', body: { quantity, unitPrice: 100, branchId } })
}
await api(`/api/products/${rice.id}/stock/stock-out`, { token: ownerToken, method: 'POST', body: { quantity: 1, unitPrice: 300, branchId: oshodi.id } })
const sent = (
  await api('/api/stock-transfers', {
    token: ownerToken,
    method: 'POST',
    body: { id: randomUUID(), fromBranchId: headOffice.id, toBranchId: oshodi.id, carriedByName: 'Tunde', lines: [{ productId: rice.id, quantity: 4 }] },
  })
).json
await api(`/api/stock-transfers/${sent.id}/receipts`, {
  token: ownerToken,
  method: 'POST',
  body: { id: randomUUID(), lines: [{ productId: rice.id, received: 3, missing: 1, damaged: 0 }] },
})
await api(`/api/products/${rice.id}/stock/stock-out`, {
  token: ownerToken,
  method: 'POST',
  body: { quantity: 2, reason: 'EXPIRED', branchId: headOffice.id },
})
// A phone at Oshodi with two writes waiting, as it says on the catalogue's change feed.
{
  const cursor = (await api('/api/products/sync/snapshot?limit=1', { token: ownerToken })).json.cursor
  await api(`/api/products/sync/changes?cursor=${encodeURIComponent(cursor)}&device=${randomUUID()}&waiting=2&branch=${oshodi.id}`, { token: ownerToken })
}

// ------------------------------------------------------------------------------------------ 1
await check('every depot from home in under 10 s: All branches opens on the branch table', async () => {
  const session = await login(owner.user.clientIdentifier, owner.email)
  const context = await contextFor(session, 'ALL')
  const page = await context.newPage()
  const started = Date.now()
  await page.goto(`${UI}/app`)
  const table = page.locator('[data-branch-table] table')
  await table.getByRole('row', { name: /Oshodi/ }).waitFor()
  const took = Date.now() - started
  assert(took < 10_000, `took ${took} ms`)
  console.log(`    branch table in ${took} ms`)
  const oshodiRow = await table.getByRole('row', { name: /Oshodi/ }).innerText()
  assert(oshodiRow.includes('₦'), `no money in the Oshodi row: ${oshodiRow}`)
  assert(/\b1\b/.test(oshodiRow), `no missing in the Oshodi row: ${oshodiRow}`)
  await table.getByRole('row', { name: /^All/ }).waitFor()
  await context.close()
})

// ------------------------------------------------------------------------------------------ 2
await check('a figure opens its screen at that branch, and says so', async () => {
  const session = await login(owner.user.clientIdentifier, owner.email)
  const context = await contextFor(session, 'ALL')
  const page = await context.newPage()
  await page.goto(`${UI}/app`)
  await page.getByRole('button', { name: 'Sales today at Oshodi' }).click()
  await page.getByText('Opened at Oshodi.').waitFor()
  await page.waitForURL(/\/app\/sales/)
  await page.getByRole('button', { name: /^Branch: Oshodi/ }).waitFor()
  await context.close()
})

// ------------------------------------------------------------------------------------------ 3
await check('phones: a branch whose phone has writes waiting says so', async () => {
  const session = await login(owner.user.clientIdentifier, owner.email)
  const context = await contextFor(session, 'ALL')
  const page = await context.newPage()
  await page.goto(`${UI}/app`)
  const row = page.locator('[data-branch-table] table').getByRole('row', { name: /Oshodi/ })
  await row.getByText('2 waiting').waitFor()
  await context.close()
})

// ------------------------------------------------------------------------------------------ 4
await check('on a phone the table is one card per branch, same figures', async () => {
  const session = await login(owner.user.clientIdentifier, owner.email)
  const context = await contextFor(session, 'ALL', { width: 390, height: 844 })
  const page = await context.newPage()
  await page.goto(`${UI}/app`)
  const cards = page.getByRole('list', { name: 'Your branches' }).getByRole('listitem')
  await cards.first().waitFor()
  assert((await cards.count()) === 3, `${await cards.count()} cards, expected 2 branches and All`)
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  assert(width <= 390, `the page scrolls sideways (${width}px)`)
  await context.close()
})

// ------------------------------------------------------------------------------------------ 5
await check('losses: missing on the way and expired stock, at cost; By branch in All branches', async () => {
  const session = await login(owner.user.clientIdentifier, owner.email)
  const context = await contextFor(session, 'ALL')
  const page = await context.newPage()
  await page.goto(`${UI}/app/losses`)
  const total = page.locator('[data-losses-total]')
  await total.waitFor()
  const text = await total.innerText()
  assert(text.includes('₦300'), `total: ${text}`)
  assert(text.includes('1 missing on the way') && text.includes('2 expired'), `breakdown: ${text}`)
  await page.getByRole('tab', { name: 'By branch' }).click()
  const list = page.getByRole('list', { name: 'Losses' })
  await list.getByText('Oshodi').waitFor()
  await list.getByText('Head Office').waitFor()
  await page.getByRole('tab', { name: 'By person' }).click()
  await list.getByText('Tunde (carried)').waitFor()
  await context.close()
})

// ------------------------------------------------------------------------------------------ 6
await check('a one-branch company: Losses has no branch word (rule 1)', async () => {
  const solo = await signup('solo-losses')
  const context = await contextFor(solo)
  const page = await context.newPage()
  await page.goto(`${UI}/app/losses`)
  await page.getByRole('heading', { name: 'Losses' }).waitFor()
  await page.waitForLoadState('networkidle')
  const text = (await page.locator('main').innerText()).toLowerCase()
  assert(!text.includes('branch'), 'the word "branch" is on the page')
  await context.close()
})

// ------------------------------------------------------------------------------------------ 7
await check('axe: the branch table (laptop and phone) and Losses have no WCAG 2.2 A/AA violations', async () => {
  const found = []
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const session = await login(owner.user.clientIdentifier, owner.email)
    const context = await contextFor(session, 'ALL', viewport)
    const page = await context.newPage()
    await page.goto(`${UI}/app`)
    await page.locator('[data-branch-table]').waitFor()
    await page.waitForLoadState('networkidle')
    found.push(...(await axe(page)).map((v) => `Dashboard ${viewport.width}: ${v}`))
    await page.goto(`${UI}/app/losses`)
    await page.locator('[data-losses-total]').waitFor()
    found.push(...(await axe(page)).map((v) => `Losses ${viewport.width}: ${v}`))
    await context.close()
  }
  assert(found.length === 0, found.join('\n    '))
})

await browser.close()
const failed = results.filter(([status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
