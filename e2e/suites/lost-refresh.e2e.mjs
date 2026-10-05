// The bug from A1 testing, end to end: the reply to a token refresh is lost after the server
// rotated the token. Before the fix the next load logged the user out.
import { chromium } from 'playwright'
import { API, UI, launchOptions } from '../config.mjs'
const u = Math.random().toString(36).slice(2, 10)
const s = await fetch(API + '/api/clients/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Lost ' + u, adminEmail: `lost-${u}@example.com`, password: 'correct-horse-battery-staple', confirmPassword: 'correct-horse-battery-staple' }) }).then((r) => r.json())
const b = await chromium.launch(launchOptions)
const c = await b.newContext()
await c.addInitScript(([rt]) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem('sb.refreshToken', rt); localStorage.setItem('__seeded', '1') } }, [s.tokens.refreshToken])
const p = await c.newPage()
let failed = 0
let total = 0
const ok = (cond, msg) => { total++; console.log(cond ? 'PASS' : 'FAIL', msg); if (!cond) failed++ }

// 1. The server rotates the token, the reply never arrives.
let lost = 0
await p.route(`${API}/api/auth/refresh`, async (route) => {
  if (lost === 0) { lost++; await route.fetch(); return route.abort('connectionreset') }
  return route.continue()
})
await p.goto(UI + '/app/products')
await p.waitForTimeout(2500)
ok(lost === 1, 'first refresh reached the server and its reply was dropped')
const tokenAfterLoss = await p.evaluate(() => localStorage.getItem('sb.refreshToken'))
ok(tokenAfterLoss === s.tokens.refreshToken, 'phone still holds the token the server already retired')

// 2. Next load, normal network: the retired token must still get the user in.
await p.unroute(`${API}/api/auth/refresh`)
const refreshed = p.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'))
await p.reload()
const status = (await refreshed).status()
ok(status === 200, `refresh with the retired token answered ${status}`)
await p.getByRole('heading', { name: 'Inventory', level: 1 }).waitFor({ timeout: 10000 }).catch(() => {})
ok(p.url().endsWith('/app/products'), `still in the workspace (${p.url()})`)

// 3. And from there on it behaves normally.
const again = p.waitForResponse((r) => r.url().endsWith('/api/auth/refresh'))
await p.reload()
ok((await again).status() === 200, 'the session keeps refreshing normally afterwards')
await b.close()
console.log(`\n${total - failed}/${total} passed`)
process.exit(failed ? 1 : 0)
