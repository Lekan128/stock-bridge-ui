// End-to-end checks for multiple branches, Phase 2 - sending and receiving stock (MULTI_BRANCH_UX_PLAN.md
// rules 7-9, sections 5.4-5.7), against the production preview (4173) and the real API (8081).
//   1. The owner sends from the product's Send screen; the waybill has a number and Share.
//   2. The storekeeper at the other branch is told it is on the way, and receives it in one tap.
//   3. Received short: a smaller number asks why, and the missing stays in view.
//   4. Offline: the waybill is kept on the phone, and goes - and gets its number - once back online.
//   5. A one-branch company has no Transfers in its menu (rule 1).
import { chromium } from 'playwright'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'
import { randomUUID } from 'node:crypto'

const SHOTS = shotsPrefix('transfers')
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
  form.append('product', new Blob([JSON.stringify({ name, sku: `TR-${name.slice(0, 4)}-${unique}`, unitOfMeasure: 'PIECE' })], { type: 'application/json' }))
  return (await api('/api/products', { token, method: 'POST', body: form })).json
}

/** A browser context signed in with a fresh session, at a chosen working branch. */
async function contextFor(session, workingBranchId, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(
    ([rt, userId, branchId]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        if (branchId) localStorage.setItem(`pp.working-branch.${userId}`, branchId)
        localStorage.setItem('__seeded', '1')
      }
    },
    [session.tokens.refreshToken, session.user.id, workingBranchId ?? null],
  )
  return context
}

async function figures(token, productId) {
  const detail = (await api(`/api/products/${productId}`, { token })).json
  return Object.fromEntries((detail.branchStock ?? []).map((entry) => [entry.branchId, entry]))
}

async function waitFor(predicate, what, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`timed out waiting for ${what}`)
}

browser = await chromium.launch(launchOptions)

// --------------------------------------------------------------------------------------- setup
const owner = await signup('transfers')
const ownerToken = owner.tokens.accessToken
const beans = await createProduct(ownerToken, owner.unique, 'Beans')
const headOffice = (await api('/api/branches', { token: ownerToken })).json.branches[0]
const oshodi = (await api('/api/branches', { token: ownerToken, method: 'POST', body: { name: 'Oshodi' } })).json
await api(`/api/products/${beans.id}/stock/stock-in`, {
  token: ownerToken,
  method: 'POST',
  body: { quantity: 20, branchId: headOffice.id },
})
const roles = (await api('/api/roles', { token: ownerToken })).json
const storekeeper = roles.find((role) => role.name === 'STOREKEEPER')
await api('/api/users', {
  token: ownerToken,
  method: 'POST',
  body: { username: `ade-${owner.unique}`, password: PASSWORD, roleId: storekeeper.id, branchIds: [oshodi.id] },
})

// ------------------------------------------------------------------------------------------ 1
let firstWaybill
await check('the owner sends from the Send screen; the waybill has a number and Share on WhatsApp', async () => {
  const session = await login(owner.user.clientIdentifier, owner.email)
  const context = await contextFor(session, headOffice.id)
  const page = await context.newPage()
  await page.goto(`${UI}/app/transfers/send?product=${beans.id}`)
  await page.getByRole('heading', { name: 'Send stock' }).waitFor()
  await page.getByText(beans.name).first().waitFor()
  await page.getByLabel('To', { exact: true }).selectOption(oshodi.id)
  await page.getByLabel(/How many/).fill('5')
  await page.getByRole('button', { name: 'Send 1 item to Oshodi' }).click()
  await page.getByText('On the way to Oshodi.').waitFor()
  await page.getByRole('button', { name: 'Share on WhatsApp' }).waitFor()
  firstWaybill = (await page.getByRole('heading', { level: 1 }).innerText()).trim()
  assert(/^WB-[A-Z]+-\d{4}$/.test(firstWaybill), `waybill number "${firstWaybill}"`)

  const at = await figures(ownerToken, beans.id)
  assert(at[headOffice.id].quantityOnHand === 15, `Head Office holds ${at[headOffice.id].quantityOnHand}, expected 15`)
  assert(at[oshodi.id].quantityOnHand === 0, `Oshodi holds ${at[oshodi.id].quantityOnHand}, expected 0`)
  assert(at[oshodi.id].onTheWay === 5, `on the way to Oshodi ${at[oshodi.id].onTheWay}, expected 5`)
  await context.close()
})

// ------------------------------------------------------------------------------------------ 2
await check('the storekeeper at Oshodi sees it on the way and receives it in one tap', async () => {
  const session = await login(owner.user.clientIdentifier, `ade-${owner.unique}`)
  const context = await contextFor(session)
  const page = await context.newPage()
  await page.goto(`${UI}/app`)
  const row = page.getByText('1 item on the way from Head Office')
  await row.waitFor()
  await page.getByRole('link', { name: 'Receive' }).first().click()
  await page.getByRole('heading', { name: firstWaybill }).waitFor()
  await page.getByRole('button', { name: 'Received as sent' }).click()
  await page.getByText('Received', { exact: true }).first().waitFor()

  await waitFor(async () => (await figures(ownerToken, beans.id))[oshodi.id].quantityOnHand === 5, 'Oshodi to hold 5')
  const at = await figures(ownerToken, beans.id)
  assert(at[oshodi.id].onTheWay === 0, `still ${at[oshodi.id].onTheWay} on the way`)
  const detail = (await api(`/api/products/${beans.id}`, { token: ownerToken })).json
  assert(detail.quantityOnHand === 20, `company total ${detail.quantityOnHand}, expected 20`)
  await context.close()
})

// ------------------------------------------------------------------------------------------ 3
await check('received short: a smaller number asks why, and what is missing stays in view', async () => {
  const sent = (
    await api('/api/stock-transfers', {
      token: ownerToken,
      method: 'POST',
      body: { id: randomUUID(), fromBranchId: headOffice.id, toBranchId: oshodi.id, lines: [{ productId: beans.id, quantity: 4 }] },
    })
  ).json
  const session = await login(owner.user.clientIdentifier, `ade-${owner.unique}`)
  const context = await contextFor(session)
  const page = await context.newPage()
  await page.goto(`${UI}/app/transfers/${sent.id}`)
  await page.getByRole('button', { name: 'Received as sent' }).waitFor()
  await page.getByLabel('Received', { exact: true }).fill('3')
  await page.getByText('1 short:').waitFor()
  assert(await page.getByRole('radio', { name: 'Missing' }).isChecked(), 'Missing is not the default reason')
  await page.getByRole('button', { name: 'Receive 3 of 4' }).click()
  await page.locator('[data-transfer-missing]').waitFor()

  const after = (await api(`/api/stock-transfers/${sent.id}`, { token: ownerToken })).json
  assert(after.status === 'RECEIVED_SHORT', `status ${after.status}`)
  assert(after.missing === 1, `missing ${after.missing}`)
  await context.close()
})

// ------------------------------------------------------------------------------------------ 4
await check('offline: the waybill is kept on the phone and goes, with its number, once back online', async () => {
  const session = await login(owner.user.clientIdentifier, owner.email)
  const context = await contextFor(session, headOffice.id)
  const page = await context.newPage()
  await page.goto(`${UI}/app/transfers/send?product=${beans.id}`)
  await page.getByText(beans.name).first().waitFor()
  await page.getByLabel('To', { exact: true }).selectOption(oshodi.id)
  await page.getByLabel(/How many/).fill('2')
  const before = (await api('/api/stock-transfers', { token: ownerToken })).json.totalElements
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Send 1 item to Oshodi' }).click()
  await page.getByText('Saved on this phone · not sent yet', { exact: false }).waitFor()
  assert((await api('/api/stock-transfers', { token: ownerToken })).json.totalElements === before, 'sent while offline')

  await context.setOffline(false)
  await waitFor(
    async () => (await api('/api/stock-transfers', { token: ownerToken })).json.totalElements === before + 1,
    'the waybill to reach the server',
    60_000,
  )
  await page.getByRole('heading', { name: /^WB-/ }).waitFor({ timeout: 30_000 })
  await context.close()
})

// ------------------------------------------------------------------------------------------ 5
await check('a one-branch company has no Transfers in its menu (rule 1)', async () => {
  const solo = await signup('solo-transfers')
  const context = await contextFor(solo)
  const page = await context.newPage()
  await page.goto(`${UI}/app`)
  await page.getByRole('link', { name: 'Inventory' }).first().waitFor()
  assert((await page.getByRole('link', { name: 'Transfers' }).count()) === 0, 'Transfers is in the menu')
  await context.close()
})

await browser.close()
const failed = results.filter(([status]) => status === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
