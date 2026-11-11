// End-to-end checks for multiple branches, Phase 4 - a chain (MULTI_BRANCH_UX_PLAN.md §4.1, §6, Avatar C),
// against the production preview (4173) and the real API (8081). A company with 12 branches:
//   1. The branch menu finds a branch by typing, Enter picks it, and long names are whole in the menu.
//   2. At a branch, Inventory reads that branch's figure (the phone holds one branch past 10).
//   3. One low-stock level for the selected products at this branch.
//   4. axe on the open branch menu.
import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('chain')
const PASSWORD = 'correct-horse-battery-staple'
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const LONG = 'Ikota Shopping Complex, Lekki Phase 2'

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

async function login(clientIdentifier, username) {
  return (await api('/api/auth/login', { method: 'POST', body: { clientIdentifier, username, password: PASSWORD } })).json
}

async function contextFor(session, workingBranch) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
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

browser = await chromium.launch(launchOptions)

// --------------------------------------------------------------------------------------- setup
const unique = randomUUID().slice(0, 8)
const email = `chain-${unique}@example.com`
const owner = (
  await api('/api/clients/signup', {
    method: 'POST',
    body: { name: `E2E chain ${unique}`, adminEmail: email, password: PASSWORD, confirmPassword: PASSWORD },
  })
).json
const token = owner.tokens.accessToken
const headOffice = (await api('/api/branches', { token })).json.branches[0]
const names = [LONG, ...Array.from({ length: 10 }, (_, i) => `Store ${i + 2}`)]
const branches = []
for (const name of names) branches.push((await api('/api/branches', { token, method: 'POST', body: { name } })).json)
const lekki = branches[0]
const products = []
for (const name of ['Malta', 'Stout']) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `CH-${name}-${unique}`, unitOfMeasure: 'PIECE', lowStockThreshold: 5 })], { type: 'application/json' }))
  products.push((await api('/api/products', { token, method: 'POST', body: form })).json)
}
await api(`/api/products/${products[0].id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 40, branchId: headOffice.id } })
await api(`/api/products/${products[0].id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 7, branchId: lekki.id } })

// ------------------------------------------------------------------------------------------ 1
await check('the branch menu finds a branch by typing, Enter picks it, and long names are whole in the menu', async () => {
  const session = await login(owner.user.clientIdentifier, email)
  const context = await contextFor(session, headOffice.id)
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  await page.getByRole('button', { name: /^Branch: Head Office/ }).click()
  const menu = page.getByRole('menu', { name: 'Branches' })
  await menu.getByText(LONG, { exact: true }).waitFor()
  const search = page.getByLabel('Find a branch')
  assert(await search.evaluate((el) => el === document.activeElement), 'the search field does not have focus')
  await search.fill('ikota')
  await search.press('Enter')
  await page.getByText(`Now at ${LONG}`).waitFor()
  const chip = page.getByRole('button', { name: `Branch: ${LONG}. Change branch` })
  await chip.waitFor()
  assert((await chip.innerText()).includes('…'), 'the chip does not shorten a long name')
  await context.close()
})

// ------------------------------------------------------------------------------------------ 2
await check("at a branch, Inventory reads that branch's figure", async () => {
  const session = await login(owner.user.clientIdentifier, email)
  const context = await contextFor(session, lekki.id)
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  const row = page.locator('tr').filter({ hasText: 'Malta' })
  await row.waitFor()
  await row.getByText(/^7\b/).first().waitFor({ timeout: 30000 })
  await context.close()
})

// ------------------------------------------------------------------------------------------ 3
await check('one low-stock level for the selected products at this branch', async () => {
  const session = await login(owner.user.clientIdentifier, email)
  const context = await contextFor(session, lekki.id)
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  for (const name of ['Malta', 'Stout']) {
    await page.locator('tr').filter({ hasText: name }).getByRole('checkbox').check()
  }
  await page.getByRole('button', { name: 'Set low-stock level' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Warn when there are this many or fewer').fill('12')
  await dialog.getByRole('button', { name: 'Set for 2 products' }).click()
  await page.getByText(`Low-stock level 12 at ${LONG} for 2 products.`).waitFor()
  const detail = (await api(`/api/products/${products[1].id}`, { token })).json
  const at = detail.branchStock.find((entry) => entry.branchId === lekki.id)
  assert(at.lowStockThreshold === 12, `level at Lekki is ${at.lowStockThreshold}`)
  await context.close()
})

// ------------------------------------------------------------------------------------------ 4
await check('axe: the open branch menu has no WCAG 2.2 A/AA violations', async () => {
  const session = await login(owner.user.clientIdentifier, email)
  const context = await contextFor(session, headOffice.id)
  const page = await context.newPage()
  await page.goto(`${UI}/app/products`)
  await page.getByRole('button', { name: /^Branch: Head Office/ }).click()
  await page.getByRole('menu', { name: 'Branches' }).waitFor()
  await page.addScriptTag({ path: AXE })
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return result.violations.map((v) => `${v.id} ×${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)
  })
  assert(violations.length === 0, violations.join('\n    '))
  await context.close()
})

await browser.close()
const failed = results.filter(([status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
