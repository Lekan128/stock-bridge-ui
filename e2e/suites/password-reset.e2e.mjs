// Self-service password reset by email, end to end (PASSWORD_RESET_PLAN.md): the "Forgot
// password?" link, the request screen and its "Check your email" state, every state of the page the
// emailed link opens, and a real reset that signs the person in and ends their other sessions.
//
// The raw link only ever exists in the email, so the suite inserts a token row whose hash it knows,
// exactly as the API mints one. Run the API with EMAIL_ENABLED=false: this suite signs up made-up
// addresses, and a real mail provider would bounce every one of them.
import { chromium } from 'playwright'
import { execSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { API, UI, launchOptions, psqlCommand, shotsPrefix } from '../config.mjs'

const psql = (sql) => execSync(psqlCommand, { input: sql }).toString().trim()
const shots = shotsPrefix('password-reset')
const PASSWORD = 'correct-horse-battery-staple'
const NEW_PASSWORD = 'a-brand-new-password'

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
const axeScan = async (page) => {
  // AuthCard fades in; mid-animation every text colour reads as low contrast, so scan the settled card.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)))
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () =>
    (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(
      (v) => `${v.id} ×${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`,
    ),
  )
}

let failed = 0
let total = 0
const ok = (cond, msg) => { total++; console.log(cond ? 'PASS' : 'FAIL', msg); if (!cond) failed++ }

const u = Math.random().toString(36).slice(2, 10)
const email = `reset-${u}@example.com`
const signup = await fetch(API + '/api/clients/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Reset Shop ' + u, adminEmail: email, password: PASSWORD, confirmPassword: PASSWORD }),
}).then((r) => r.json())
const companyId = signup.user.clientIdentifier
const companyName = signup.user.clientName
const userId = signup.user.id

/** A live reset link for this user, as the API would mint it. */
function mintLink() {
  const raw = 'e2e-' + randomUUID()
  const hash = createHash('sha256').update(raw).digest('hex')
  psql(`INSERT INTO password_reset_tokens (user_id, email_address, token_hash, expires_at)
        VALUES ('${userId}', '${email}', '${hash}', now() + interval '1 hour');`)
  return raw
}

const browser = await chromium.launch(launchOptions)
// Phone width: the flow has to work where people actually forget passwords.
const context = await browser.newContext({ viewport: { width: 360, height: 780 } })
const page = await context.newPage()

try {
  // 1. Log in → "Forgot password?" carries an email typed into the login field.
  await page.goto(UI + '/login')
  await page.getByLabel('Phone, email or username').fill(email)
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await page.getByRole('heading', { name: 'Reset your password' }).waitFor()
  ok(page.url().includes('/forgot-password?email='), `the link carried the email (${page.url()})`)
  ok((await page.getByLabel('Email address').inputValue()) === email, 'the email field arrived filled in')
  const formViolations = await axeScan(page)
  ok(formViolations.length === 0, `axe on the request form: ${formViolations.join(' | ') || 'clean'}`)
  await page.screenshot({ path: shots + '1-request.png', fullPage: true })

  // 2. Validation names the problem; no request is sent for a malformed address.
  await page.getByLabel('Email address').fill('not-an-email')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  ok(await page.getByText('Enter a valid email address').isVisible(), 'a malformed email is caught before sending')

  // 3. Sending switches the same card to "Check your email", worded so it reveals nothing.
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await page.getByRole('heading', { name: 'Check your email' }).waitFor()
  const status = await page.getByRole('status').innerText()
  ok(status.includes('If an account uses') && status.includes(email), 'the confirmation says "If an account uses …", not "we sent"')
  ok(status.includes('expires in 1 hour'), 'the confirmation states the link lifetime')
  ok(await page.getByRole('button', { name: /send it again in \d+s/ }).isDisabled(), 'resend waits out its cooldown')
  const live = psql(`SELECT count(*) FROM password_reset_tokens WHERE user_id = '${userId}' AND consumed_at IS NULL AND superseded_at IS NULL;`)
  ok(live === '1', `the API minted one live link for the account (${live})`)
  await page.screenshot({ path: shots + '2-check-email.png', fullPage: true })

  // 4. An unknown address gets the identical screen.
  await page.getByRole('button', { name: 'Use a different email' }).click()
  await page.getByLabel('Email address').fill(`nobody-${u}@example.com`)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await page.getByRole('heading', { name: 'Check your email' }).waitFor()
  ok(true, 'an unknown email reaches the same "Check your email" state')

  // 5. The emailed link: names the account, refuses a short password, and opening it twice is harmless.
  const raw = mintLink()
  await page.goto(UI + '/reset-password?token=' + encodeURIComponent(raw))
  await page.getByRole('heading', { name: 'Set a new password' }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: 'Set a new password' }).waitFor()
  ok(true, 'opening the link twice does not use it up')
  ok(await page.getByText(`For ${email} at ${companyName}.`).isVisible(), 'the page names the login and the company')
  const resetViolations = await axeScan(page)
  ok(resetViolations.length === 0, `axe on the new-password form: ${resetViolations.join(' | ') || 'clean'}`)
  await page.screenshot({ path: shots + '3-new-password.png', fullPage: true })
  await page.getByLabel('New password').fill('short')
  await page.getByRole('button', { name: 'Set new password' }).click()
  ok(await page.getByText('Use at least 8 characters').isVisible(), 'a short password is refused in place')

  // 6. Setting it signs the person in and ends the session that existed before.
  await page.getByLabel('New password').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Set new password' }).click()
  await page.waitForURL((url) => url.pathname.startsWith('/app'), { timeout: 15000 })
  ok(true, `signed in and sent to the workspace (${page.url()})`)
  ok(await page.getByText('Password changed. Any other devices have been logged out.').isVisible(), 'the toast confirms it')
  await page.screenshot({ path: shots + '4-signed-in.png', fullPage: true })
  const oldRefresh = await fetch(API + '/api/auth/refresh', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: signup.tokens.refreshToken }),
  })
  ok(oldRefresh.status === 401, `the session from before the reset is over (${oldRefresh.status})`)
  const login = (password) => fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientIdentifier: companyId, username: email, password }),
  }).then((r) => r.status)
  ok((await login(NEW_PASSWORD)) === 200, 'the new password logs in')
  ok((await login(PASSWORD)) === 401, 'the old password does not')

  // 7. The used link, and a link with no token, each land on a state with a way forward.
  const fresh = await browser.newContext({ viewport: { width: 360, height: 780 } })
  const other = await fresh.newPage()
  await other.goto(UI + '/reset-password?token=' + encodeURIComponent(raw))
  await other.getByRole('heading', { name: "This reset link doesn't work any more" }).waitFor()
  ok(await other.getByRole('link', { name: 'Send a new link' }).isVisible(), 'a used link offers "Send a new link"')
  await other.screenshot({ path: shots + '5-used-link.png', fullPage: true })
  await other.goto(UI + '/reset-password')
  await other.getByRole('heading', { name: 'This link is incomplete' }).waitFor()
  ok(true, 'a link with no token says it is incomplete')
  await fresh.close()
} catch (err) {
  ok(false, `unexpected: ${err.message}`)
  await page.screenshot({ path: shots + 'failure.png', fullPage: true }).catch(() => {})
}

await browser.close()
console.log(`\n${total - failed}/${total} passed`)
process.exit(failed ? 1 : 0)
