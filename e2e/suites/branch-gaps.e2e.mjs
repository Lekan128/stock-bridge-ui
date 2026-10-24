// End-to-end checks for the multi-branch plan gaps closed after Phase 4 (MULTI_BRANCH_BUILD_PLAN.md
// §8.0e), against the production preview (4173) and the real API (8081). Two branches, Head Office and
// Oshodi:
//   1. Branches: people and address on each branch; "Add address and phone"; axe on both.
//   2. The first-run question, and Works at on Add user: axe on both.
//   3. Inventory in All branches: "Low at 1 branch", and the By branch column.
//   4. Low stock in All branches, grouped by the branch each product is low at.
//   5. The product page at a branch: "Only at Oshodi so far", and when it was last counted here.
//   6. A low-stock level for each branch, from the product's settings.
//   7. Expected deliveries: a Going to field, and the branch on each in All branches.
//   8. Stock movements in All branches: a Branch filter.
//   9. A stock sheet upload and quick mode say which branch.
//  10. On a phone, the branch chip opens a bottom sheet.
//  11. The evening digest switch under the branch table.
//  12. The branch this phone was at closes: it says so.
//  13. The stock-in receipt names its branch.
//  14. A saved price says it applies at every branch.
//  15. At a branch the person only views, nothing offers to record.
import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('branch-gaps')
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

async function login(clientIdentifier, username) {
  return (await api('/api/auth/login', { method: 'POST', body: { clientIdentifier, username, password: PASSWORD } })).json
}

/** Signed in, at `workingBranch` ('ALL', a branch id, or nothing remembered so the question is asked). */
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

async function ownerPage(workingBranch, viewport) {
  const session = await login(owner.user.clientIdentifier, email)
  const context = await contextFor(session, workingBranch, viewport)
  return { context, page: await context.newPage() }
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
const unique = randomUUID().slice(0, 8)
const email = `gaps-${unique}@example.com`
const owner = (
  await api('/api/clients/signup', {
    method: 'POST',
    body: { name: `E2E gaps ${unique}`, adminEmail: email, password: PASSWORD, confirmPassword: PASSWORD },
  })
).json
const token = owner.tokens.accessToken
const headOffice = (await api('/api/branches', { token })).json.branches[0]
const oshodi = (await api('/api/branches', { token, method: 'POST', body: { name: 'Oshodi', address: '12 Agege Motor Road' } })).json
const storekeeperRole = (await api('/api/roles', { token })).json.find?.((role) => role.name === 'STOREKEEPER')
async function createProduct(name, lowStockThreshold) {
  const form = new FormData()
  form.append('product', new Blob([JSON.stringify({ name, sku: `GP-${name}-${unique}`, unitOfMeasure: 'PIECE', lowStockThreshold })], { type: 'application/json' }))
  return (await api('/api/products', { token, method: 'POST', body: form })).json
}
const rice = await createProduct('Rice', 5)
const beans = await createProduct('Beans', 5)
await api(`/api/products/${rice.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 50, branchId: headOffice.id } })
await api(`/api/products/${rice.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 2, branchId: oshodi.id } })
await api(`/api/products/${beans.id}/stock/stock-in`, { token, method: 'POST', body: { quantity: 10, branchId: oshodi.id } })
await api(`/api/products/${beans.id}/stock/count`, { token, method: 'POST', body: { countedQuantity: 10, branchId: oshodi.id } })
if (storekeeperRole) {
  await api('/api/users', { token, method: 'POST', body: { username: `ade-${unique}`, password: PASSWORD, roleId: storekeeperRole.id, branchIds: [oshodi.id] } })
}

// ------------------------------------------------------------------------------------------ 1
await check('Branches: people and address on each branch, "Add address and phone", axe on both', async () => {
  const { context, page } = await ownerPage(headOffice.id)
  await page.goto(`${UI}/app/company/branches`)
  const row = page.getByRole('listitem').filter({ hasText: 'Oshodi' })
  await row.getByText('12 Agege Motor Road').waitFor()
  if (storekeeperRole) await row.getByText(/\b1 person\b/).waitFor()
  await page.waitForLoadState('networkidle')
  const found = (await axe(page)).map((v) => `Branches: ${v}`)
  await page.getByRole('button', { name: 'Add a branch' }).click()
  await page.getByRole('heading', { name: "What's the new branch called?" }).waitFor()
  await page.getByRole('button', { name: 'Add address and phone' }).click()
  await page.getByLabel('Address (optional)').waitFor()
  found.push(...(await axe(page)).map((v) => `Add a branch: ${v}`))
  assert(found.length === 0, found.join('\n    '))
  await context.close()
})

// ------------------------------------------------------------------------------------------ 2
await check('the first-run question and Works at on Add user have no WCAG 2.2 A/AA violations', async () => {
  const { context, page } = await ownerPage(null)
  await page.goto(`${UI}/app`)
  await page.getByRole('heading', { name: 'Which branch are you at?' }).waitFor()
  const found = (await axe(page)).map((v) => `Question: ${v}`)
  const question = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Which branch are you at?' }) })
  await question.getByRole('radio', { name: /Head Office/ }).check()
  await question.getByRole('button', { name: 'Continue' }).click()
  await page.goto(`${UI}/app/users`)
  await page.getByRole('button', { name: 'Add user' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('Works at').waitFor()
  found.push(...(await axe(page)).map((v) => `Works at: ${v}`))
  assert(found.length === 0, found.join('\n    '))
  await context.close()
})

// ------------------------------------------------------------------------------------------ 3
await check('Inventory in All branches: "Low at 1 branch", and the By branch column', async () => {
  const { context, page } = await ownerPage('ALL')
  await page.goto(`${UI}/app/products`)
  const row = page.locator('tr').filter({ hasText: `Rice` })
  await row.getByText('Low at 1 branch').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'By branch' }).click()
  await page.getByRole('columnheader', { name: 'By branch' }).waitFor()
  const byBranch = row.getByRole('list', { name: /by branch$/ })
  await byBranch.getByText('Oshodi').waitFor()
  assert((await byBranch.innerText()).includes('50'), `by branch: ${await byBranch.innerText()}`)
  await context.close()
})

// ------------------------------------------------------------------------------------------ 4
await check('Low stock in All branches is grouped by the branch it is low at', async () => {
  const { context, page } = await ownerPage('ALL')
  await page.goto(`${UI}/app/products/low-stock`)
  const group = page.locator('[data-low-group]').filter({ hasText: 'Oshodi' })
  await group.getByRole('heading', { name: /Oshodi/ }).waitFor()
  assert((await group.innerText()).includes('Rice'), 'Rice is not under Oshodi')
  // Head Office holds 50 Rice and no Beans (0 against a level of 5): Beans is low there, Rice isn't.
  const headOfficeGroup = page.locator('[data-low-group]').filter({ has: page.getByRole('heading', { name: /^Head Office/ }) })
  const headOfficeText = await headOfficeGroup.innerText()
  assert(headOfficeText.includes('Beans') && !headOfficeText.includes('Rice'), `Head Office group: ${headOfficeText}`)
  await context.close()
})

// ------------------------------------------------------------------------------------------ 5
await check('the product page at a branch: "Only at Oshodi so far", and when it was counted here', async () => {
  const { context, page } = await ownerPage(oshodi.id)
  await page.goto(`${UI}/app/products/${beans.id}`)
  await page.getByText('Only at Oshodi so far').waitFor()
  await page.getByText(/^Counted here /).waitFor()
  await context.close()
})

// ------------------------------------------------------------------------------------------ 6
await check("a low-stock level for each branch, from the product's settings", async () => {
  const { context, page } = await ownerPage(headOffice.id)
  await page.goto(`${UI}/app/products/${rice.id}/edit`)
  await page.getByRole('button', { name: 'Different for each branch' }).click()
  await page.getByLabel('Low-stock level at Oshodi').fill('12')
  await page.getByRole('button', { name: 'Save branch levels' }).click()
  await page.getByText('Branch levels saved.').waitFor()
  const detail = (await api(`/api/products/${rice.id}`, { token })).json
  const at = detail.branchStock.find((entry) => entry.branchId === oshodi.id)
  assert(at.ownLowStockThreshold === 12, `own level at Oshodi: ${at.ownLowStockThreshold}`)
  await context.close()
})

// ------------------------------------------------------------------------------------------ 7
await check('expected deliveries: a Going to field, and the branch on each in All branches', async () => {
  await api('/api/expected-deliveries', {
    token,
    method: 'POST',
    body: { branchId: oshodi.id, lines: [{ productId: rice.id, unit: 'PIECE', quantity: 3 }] },
  })
  const { context, page } = await ownerPage('ALL')
  await page.goto(`${UI}/app/products/expected/new`)
  const goingTo = page.getByLabel('Going to')
  await goingTo.waitFor()
  assert((await goingTo.locator('option').allInnerTexts()).includes('Oshodi'), 'Oshodi is not offered')
  await page.goto(`${UI}/app/products/expected`)
  await page.getByText('Going to Oshodi').first().waitFor()
  await context.close()
})

// ------------------------------------------------------------------------------------------ 8
await check('Stock movements in All branches can be filtered to one branch', async () => {
  const { context, page } = await ownerPage('ALL')
  await page.goto(`${UI}/app/stock-movements`)
  const filter = page.getByLabel('Branch', { exact: true })
  await filter.waitFor()
  const listed = page.waitForResponse((res) => res.url().includes('/api/stock/movements?') && res.url().includes(`branchId=${oshodi.id}`))
  await filter.selectOption({ label: 'Oshodi' })
  await listed
  await context.close()
})

// ------------------------------------------------------------------------------------------ 9
await check('a stock sheet upload and quick mode say which branch', async () => {
  const { context, page } = await ownerPage('ALL')
  await page.goto(`${UI}/app/products/import/new?kind=STOCK_IN`)
  await page.getByRole('heading', { name: 'Which branch is this stock for?' }).waitFor()
  await context.close()
  const at = await ownerPage(oshodi.id)
  await at.page.goto(`${UI}/app/quick`)
  await at.page.getByRole('heading', { name: 'Quick mode · Oshodi' }).waitFor()
  await at.context.close()
})

// ----------------------------------------------------------------------------------------- 10
await check('on a phone, the branch chip opens a bottom sheet', async () => {
  const { context, page } = await ownerPage(headOffice.id, { width: 390, height: 844 })
  await page.goto(`${UI}/app/products`)
  await page.getByRole('button', { name: /^Branch: Head Office/ }).click()
  const sheet = page.locator('[data-branch-sheet]')
  await sheet.waitFor()
  const box = await sheet.boundingBox()
  assert(box && Math.abs(box.y + box.height - 844) <= 1 && box.width >= 389, `sheet at ${JSON.stringify(box)}`)
  await page.getByRole('menuitemradio', { name: /Oshodi/ }).click()
  await page.getByText('Now at Oshodi').waitFor()
  await context.close()
})

// ----------------------------------------------------------------------------------------- 11
await check('the evening digest: "Email me this every evening" under the branch table', async () => {
  const { context, page } = await ownerPage('ALL')
  await page.goto(`${UI}/app`)
  const box = page.getByLabel('Email me this every evening')
  await box.waitFor()
  // Ticked once the server has it, not before.
  await box.click()
  await page.getByText("You'll get this by email every evening.").waitFor()
  assert(await box.isChecked(), 'the box is not ticked')
  const now = (await api('/api/analytics/branches/digest', { token })).json
  assert(now.enabled === true, `digest: ${JSON.stringify(now)}`)
  await context.close()
})

// ----------------------------------------------------------------------------------------- 13
await check('the stock-in receipt names the branch it was recorded at', async () => {
  const { context, page } = await ownerPage(oshodi.id)
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('button', { name: 'Stock in', exact: true }).first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel(/how many|quantity/i).first().fill('3')
  await sheet.getByRole('button', { name: 'Continue', exact: true }).click()
  await sheet.getByRole('button', { name: 'Confirm', exact: true }).click()
  const branchLine = page.locator('[data-receipt-branch]')
  await branchLine.waitFor()
  assert((await branchLine.innerText()).includes('Oshodi'), `receipt says: ${await branchLine.innerText()}`)
  await context.close()
})

// ----------------------------------------------------------------------------------------- 14
await check('a price saved at a multi-branch company says it applies at every branch', async () => {
  await api('/api/company/selling', { token, method: 'PUT', body: { sellsStock: true } })
  const { context, page } = await ownerPage(headOffice.id)
  await page.goto(`${UI}/app/products/${beans.id}/edit`)
  await page.getByLabel(/Selling price/).first().fill('5000')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.getByText(/^Saved\. ₦5,000 .+ at all 2 branches\.$/).waitFor()
  await context.close()
})

// ----------------------------------------------------------------------------------------- 15
await check('at a branch the person only views, nothing offers to record', async () => {
  const roleId = (await api('/api/roles', {
    token,
    method: 'POST',
    body: { name: `Area ${unique}`, description: 'Sees every branch', permissionCodes: ['VIEW_PRODUCTS', 'STOCK_IN', 'STOCK_OUT', 'VIEW_ALL_BRANCHES'] },
  })).json.id
  await api('/api/users', { token, method: 'POST', body: { username: `area-${unique}`, password: PASSWORD, roleId, branchIds: [headOffice.id] } })
  const session = await login(owner.user.clientIdentifier, `area-${unique}`)
  const context = await contextFor(session, oshodi.id)
  const page = await context.newPage()
  await page.goto(`${UI}/app/products/${rice.id}`)
  await page.getByRole('button', { name: /^Branch: Oshodi/ }).waitFor()
  await page.getByText('View only').first().waitFor()
  assert((await page.getByRole('button', { name: 'Stock in', exact: true }).count()) === 0, 'Stock in offered at a view-only branch')
  assert((await page.getByRole('button', { name: 'Stock out', exact: true }).count()) === 0, 'Stock out offered at a view-only branch')
  await context.close()
})

// ----------------------------------------------------------------------------------------- 12
await check('the branch this phone was at closes: it says so', async () => {
  const ikeja = (await api('/api/branches', { token, method: 'POST', body: { name: 'Ikeja' } })).json
  await api(`/api/branches/${ikeja.id}/close`, { token, method: 'POST' })
  const { context, page } = await ownerPage(ikeja.id)
  await page.goto(`${UI}/app/products`)
  await page.getByText("Ikeja has closed. This phone isn't at it any more.").waitFor()
  await context.close()
})

await browser.close()
const failed = results.filter(([status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
