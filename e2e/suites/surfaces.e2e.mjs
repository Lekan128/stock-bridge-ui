// End-to-end checks for the surfaces pass (SURFACES_AUDIT.md at the project root), against the production
// preview (4173) and the real API (8081). Every form that moved from a centred Modal (or from replacing its
// page) into a Sheet is opened at laptop (1280×900) and phone (390×844) size, and must:
//   - be a side panel on the right, full height, on a laptop; a bottom sheet, full width, on a phone;
//   - keep its footer on screen and its title as the dialog's name;
//   - close on Escape, with nothing left open.
// One screenshot of each, open, lands in e2e/shots/surfaces-*.png.
import { chromium } from 'playwright'
import { randomUUID } from 'node:crypto'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'

const SHOTS = shotsPrefix('surfaces')
const PASSWORD = 'correct-horse-battery-staple'
const VIEWPORTS = { laptop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } }

const results = []
let browser
async function check(name, fn) {
  try {
    await fn()
    results.push(['PASS', name])
    console.log('PASS', name)
  } catch (err) {
    results.push(['FAIL', name, err.message])
    console.log('FAIL', name, '\n   ', err.message.split('\n').slice(0, 3).join('\n    '))
    let i = 0
    for (const ctx of browser.contexts()) for (const pg of ctx.pages()) {
      console.log('    page:', pg.url())
      await pg.screenshot({ path: SHOTS + `fail-${results.length}-${i++}.png` }).catch(() => {})
    }
  } finally {
    // A failed check leaves nothing open for the next one to trip over.
    for (const ctx of browser.contexts()) await ctx.close().catch(() => {})
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
const login = async (clientIdentifier, username, password = PASSWORD) =>
  (await api('/api/auth/login', { method: 'POST', body: { clientIdentifier, username, password } })).json

/** A page signed in as `session`, at `branch` if given. */
async function pageFor(session, viewport, branch) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(
    ([rt, userId, at]) => {
      if (!localStorage.getItem('__seeded')) {
        localStorage.setItem('sb.refreshToken', rt)
        if (at) localStorage.setItem(`pp.working-branch.${userId}`, at)
        localStorage.setItem('__seeded', '1')
      }
    },
    [session.tokens.refreshToken, session.user.id, branch ?? null],
  )
  return { context, page: await context.newPage() }
}

/**
 * Open a surface, check it is a Sheet of the right shape, screenshot it, close it with Escape. `open`
 * does whatever the person would do; `title` is the dialog's name.
 */
async function sheet(page, size, name, title, open) {
  await open()
  const dialog = page.getByRole('dialog', { name: title })
  await dialog.waitFor()
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))))
  const box = await dialog.boundingBox()
  const { width, height } = VIEWPORTS[size]
  if (size === 'laptop') {
    assert(Math.abs(box.x + box.width - width) < 2, `${name}: not against the right edge (${JSON.stringify(box)})`)
    assert(box.y < 2 && Math.abs(box.height - height) < 2, `${name}: not full height (${JSON.stringify(box)})`)
  } else {
    assert(box.x < 2 && Math.abs(box.width - width) < 2, `${name}: not full width (${JSON.stringify(box)})`)
    assert(Math.abs(box.y + box.height - height) < 2, `${name}: not against the bottom (${JSON.stringify(box)})`)
  }
  // The footer (the dialog's last child) is on screen, so its buttons can always be reached.
  const footer = await dialog.locator(':scope > div').last().boundingBox()
  assert(footer.y + footer.height <= height + 1, `${name}: footer below the screen`)
  // Focus starts inside it.
  assert(await dialog.evaluate((el) => el.contains(document.activeElement)), `${name}: focus is not in the sheet`)
  await page.screenshot({ path: `${SHOTS}${name}-${size}.png` })
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
}

browser = await chromium.launch(launchOptions)

// --------------------------------------------------------------------------------------- setup
const unique = randomUUID().slice(0, 8)
const email = `surfaces-${unique}@example.com`
const signup = async (name, adminEmail) =>
  (
    await api('/api/clients/signup', {
      method: 'POST',
      body: { name, adminEmail, password: PASSWORD, confirmPassword: PASSWORD },
    })
  ).json
const owner = await signup(`E2E Surfaces ${unique}`, email)
const token = owner.tokens.accessToken
const roles = (await api('/api/roles', { token })).json
const storekeeper = (roles.content ?? roles).find((role) => role.name === 'STOREKEEPER')
await api('/api/users', { token, method: 'POST', body: { username: `ade-${unique}`, password: PASSWORD, roleId: storekeeper.id } })
const form = new FormData()
form.append(
  'product',
  new Blob([JSON.stringify({ name: 'Rice', sku: `SF-RICE-${unique}`, unitOfMeasure: 'KG', lowStockThreshold: 5 })], {
    type: 'application/json',
  }),
)
const rice = (await api('/api/products', { token, method: 'POST', body: form })).json
const supplier = (await api('/api/company-vendors', { token, method: 'POST', body: { name: 'Dangote Mills', contactPhone: '08030000000' } })).json
await api(`/api/products/${rice.id}/stock/stock-in`, {
  token,
  method: 'POST',
  body: { quantity: 100, companyVendorId: supplier.id, packagingUnit: 'BAG', packagingSize: 50 },
})
// A pack on file (the bag of 50 kg), so the supplier offers "Add price break".
const riceSupplier = (await api(`/api/products/${rice.id}/vendors`, { token })).json[0]
await api(`/api/products/${rice.id}/vendors/${riceSupplier.id}/packs`, {
  token,
  method: 'POST',
  body: { packagingUnit: 'BAG', packagingSize: 50 },
})

// A second company with two branches, for the low-stock level at one branch.
const multiEmail = `surfaces-multi-${unique}@example.com`
const multi = await signup(`E2E Surfaces Multi ${unique}`, multiEmail)
const multiToken = multi.tokens.accessToken
const headOffice = (await api('/api/branches', { token: multiToken })).json.branches[0]
await api('/api/branches', { token: multiToken, method: 'POST', body: { name: 'Oshodi' } })
const multiForm = new FormData()
multiForm.append(
  'product',
  new Blob([JSON.stringify({ name: 'Malta', sku: `SF-MALTA-${unique}`, unitOfMeasure: 'PIECE', lowStockThreshold: 5 })], {
    type: 'application/json',
  }),
)
await api('/api/products', { token: multiToken, method: 'POST', body: multiForm })

// The super admin's view of the first company, and an application waiting for them.
const superToken = (await api('/api/superadmin/auth/login', { method: 'POST', body: { username: 'admin', password: 'changeme' } })).json
  .tokens.accessToken
const tenantId = (await api(`/api/superadmin/clients?search=${encodeURIComponent(`Surfaces ${unique}`)}`, { token: superToken })).json
  .content.find((client) => client.name === `E2E Surfaces ${unique}`).id
const applicant = `Surfaces Foods ${unique}`
await api('/api/vendor-waitlist', {
  method: 'POST',
  body: { businessName: applicant, email: `apply-${unique}@example.com`, contactPhone: '08031234567' },
})

for (const size of Object.keys(VIEWPORTS)) {
  const viewport = VIEWPORTS[size]

  // ----------------------------------------------------------------------- batch 1: people and roles
  await check(`${size}: people and roles`, async () => {
    const { context, page } = await pageFor(await login(owner.user.clientIdentifier, email), viewport)
    await page.goto(`${UI}/app/users`)
    await sheet(page, size, 'add-user', 'Add user', () => page.getByRole('button', { name: 'Add user' }).first().click())
    const actions = page.getByRole('button', { name: `Actions for ade-${unique}` }).first()
    await sheet(page, size, 'edit-user', `Edit ade-${unique}`, async () => {
      await actions.click()
      await page.getByRole('menuitem', { name: 'Edit' }).click()
    })
    await sheet(page, size, 'reset-password', `Reset password for ade-${unique}`, async () => {
      await actions.click()
      await page.getByRole('menuitem', { name: 'Reset password' }).click()
    })
    await page.goto(`${UI}/app/roles`)
    await sheet(page, size, 'new-role', 'New role', () => page.getByRole('button', { name: 'New role' }).first().click())
    await context.close()
  })

  // ------------------------------------------------------------- batch 2: products, packs, categories
  await check(`${size}: products, packs and categories`, async () => {
    const { context, page } = await pageFor(await login(owner.user.clientIdentifier, email), viewport)
    await page.goto(`${UI}/app/products`)
    await sheet(page, size, 'add-product', 'Add a product', () => page.getByRole('button', { name: 'Add product' }).filter({ visible: true }).first().click())
    await sheet(page, size, 'manage-categories', 'Manage categories', async () => {
      // On a phone this is the "⋯" in the bar along the bottom, whose menu opens upwards.
      await page.getByRole('button', { name: 'More inventory actions' }).filter({ visible: true }).first().click()
      await page.getByRole('menuitem', { name: 'Manage categories' }).click()
    })
    await page.goto(`${UI}/app/products/${rice.id}?tab=vendors`)
    await page.getByRole('button', { name: 'Show packs' }).first().click()
    await sheet(page, size, 'add-pack', /^Add pack/, () => page.getByRole('button', { name: 'Add pack' }).first().click())
    await sheet(page, size, 'add-price-break', /^Add price break/, async () => {
      await page.getByRole('button', { name: /Bag of 50 kg/ }).first().click()
      await page.getByRole('button', { name: 'Add price break' }).first().click()
    })
    await page.goto(`${UI}/app/products/new`)
    await sheet(page, size, 'request-unit', 'Request a new unit', () =>
      page.getByRole('button', { name: "Can't find your unit?" }).first().click(),
    )
    await context.close()
  })

  await check(`${size}: a low-stock level at one branch`, async () => {
    const { context, page } = await pageFor(await login(multi.user.clientIdentifier, multiEmail), viewport, headOffice.id)
    await page.goto(`${UI}/app/products`)
    // On a phone, rows are selected by a long press's "Select" mode; the table's checkbox is the laptop's.
    if (size === 'laptop') {
      await page.locator('tr').filter({ hasText: 'Malta' }).getByRole('checkbox').check()
      await sheet(page, size, 'branch-level', `Low-stock level at ${headOffice.name}`, () =>
        page.getByRole('button', { name: 'Set low-stock level' }).click(),
      )
    }
    await context.close()
  })

  // ------------------------------------------------------ batch 3: addresses, marketplace, storefront
  await check(`${size}: addresses`, async () => {
    const { context, page } = await pageFor(await login(owner.user.clientIdentifier, email), viewport)
    await page.goto(`${UI}/app/addresses`)
    await sheet(page, size, 'address', 'Add delivery address', () => page.getByRole('button', { name: 'Add address' }).first().click())
    await context.close()
  })

  await check(`${size}: marketplace details and categories (ProcurePal)`, async () => {
    const { context, page } = await pageFor(await login('procurepal', 'admin', 'Demo1234!'), viewport)
    await page.goto(`${UI}/app/marketplace/products`)
    await sheet(page, size, 'marketplace-details', 'Marketplace details', () => page.getByRole('button', { name: 'Edit' }).first().click())
    await page.goto(`${UI}/app/marketplace/products?tab=categories`)
    await sheet(page, size, 'category', 'New category', () => page.getByRole('button', { name: 'New category' }).first().click())
    await context.close()
  })

  if (size === 'phone') {
    await check('phone: the storefront filter panel', async () => {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      await page.goto(`${UI}/marketplace`)
      await sheet(page, size, 'storefront-filters', 'Filter products', () => page.getByRole('button', { name: 'Filters' }).click())
      await context.close()
    })
  }

  // ------------------------------------------------------------------------------- batch 4: admin
  await check(`${size}: admin`, async () => {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto(`${UI}/admin/login`)
    await page.getByLabel('Username').fill('admin')
    await page.getByLabel('Password').fill('changeme')
    await page.getByRole('button', { name: 'Log in' }).click()
    await page.waitForURL(/\/admin(?!\/login)/)

    await page.goto(`${UI}/admin/procurepal-users`)
    await sheet(page, size, 'admin-add-user', 'Add ProcurePal user', () => page.getByRole('button', { name: 'Add User' }).click())
    // The admin tables are wider than a phone (a desk tool), so their row menus are checked on a laptop.
    if (size === 'laptop') {
      const actions = page.getByRole('button', { name: /^Actions for / }).first()
      await sheet(page, size, 'admin-edit-user', /^Edit /, async () => {
        await actions.click()
        await page.getByRole('menuitem', { name: 'Edit' }).click()
      })
      await sheet(page, size, 'admin-reset-password', /^Reset password for /, async () => {
        await actions.click()
        await page.getByRole('menuitem', { name: 'Reset password' }).click()
      })
    }

    await page.goto(`${UI}/admin/vendors`)
    await sheet(page, size, 'admin-add-vendor', 'Add a vendor', () => page.getByRole('button', { name: 'Add vendor' }).first().click())

    await page.goto(`${UI}/admin/vendor-waitlist`)
    await sheet(page, size, 'admin-approve', /^Approve /, () => page.getByRole('button', { name: 'Approve', exact: true }).first().click())

    await page.goto(`${UI}/admin/tenants/${tenantId}`)
    await sheet(page, size, 'admin-edit-company', `Edit E2E Surfaces ${unique}`, () => page.getByRole('button', { name: 'Edit' }).first().click())
    if (size === 'laptop') {
      await sheet(page, size, 'admin-tenant-user', /ade-|surfaces-/, () =>
        page.locator('tr, li').filter({ hasText: `ade-${unique}` }).first().click(),
      )
    }
    await context.close()
  })

  // --------------------------------------------------------------- batch 5: branches, on this phone
  await check(`${size}: Add a branch and Edit a branch keep the list in view`, async () => {
    const { context, page } = await pageFor(await login(owner.user.clientIdentifier, email), viewport)
    await page.goto(`${UI}/app/company/branches`)
    await page.getByRole('heading', { name: 'Branches' }).waitFor()
    await sheet(page, size, 'add-branch', 'Add a branch', async () => {
      await page.getByRole('button', { name: 'Add a branch' }).click()
      await page.getByRole('heading', { name: 'First, what do you call the place you already have?' }).waitFor()
    })
    // The page under it is still the Branches page, not replaced by the flow.
    await page.getByRole('heading', { name: 'Branches' }).waitFor()
    // Second step, from the footer's Next; nothing is renamed when the name is left as it is.
    await page.getByRole('button', { name: 'Add a branch' }).click()
    const flow = page.getByRole('dialog', { name: 'Add a branch' })
    await flow.getByRole('button', { name: 'Next' }).click()
    await flow.getByRole('heading', { name: "What's the new branch called?" }).waitFor()
    await page.screenshot({ path: `${SHOTS}add-branch-name-${size}.png` })
    await flow.getByRole('button', { name: 'Cancel' }).click()
    await flow.waitFor({ state: 'detached' })
    const branchName = (await api('/api/branches', { token })).json.branches[0].name
    await sheet(page, size, 'edit-branch', `Edit ${branchName}`, () => page.getByRole('button', { name: 'Edit', exact: true }).first().click())
    await context.close()
  })

  await check(`${size}: On this phone`, async () => {
    const { context, page } = await pageFor(await login(owner.user.clientIdentifier, email), viewport)
    await page.goto(`${UI}/app/products`)
    await sheet(page, size, 'sync-centre', 'On this phone', () => page.getByRole('button', { name: /Open sync details/ }).first().click())
    await context.close()
  })
}

await browser.close()
const passed = results.filter(([status]) => status === 'PASS').length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
