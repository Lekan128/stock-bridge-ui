// The marketing pages (LANDING_PAGE_PLAN.md, steps 6 and 7) as a search engine and a reader meet
// them, against the production preview (4173) and the API (8081). Runs after the landing suite, which
// leaves the production (early-access) build in place: what procurepaddy.com would serve.
import { chromium } from 'playwright'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { API, UI, launchOptions, shotsPrefix } from '../config.mjs'

const SHOTS = shotsPrefix('seo-pages')
const results = []
const browser = await chromium.launch(launchOptions)
async function check(name, fn) {
  try {
    await fn()
    results.push(['PASS', name])
    console.log('PASS', name)
  } catch (err) {
    results.push(['FAIL', name, err.message])
    console.log('FAIL', name, '\n   ', err.message.split('\n').slice(0, 3).join(' | '))
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

const sitemap = await fetch(`${UI}/sitemap.xml`).then((r) => r.text())
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
const pathOf = (url) => new URL(url).pathname
const pages = new Map()
for (const url of urls) pages.set(pathOf(url), await fetch(`${UI}${pathOf(url)}`).then(async (r) => ({ status: r.status, html: await r.text() })))
const attr = (html, re) => html.match(re)?.[1]
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1]))

await check('the sitemap lists every page: home, pricing, demo, about, 2 comparisons, 2 free tools, 5 trades, guides and 10 guides', async () => {
  assert(urls.length === 24, `${urls.length} urls`)
  assert(!urls.some((url) => url.includes('/founding')), '/founding is noindex and must not be in the sitemap')
  for (const [path, page] of pages) assert(page.status === 200, `${path}: ${page.status}`)
})

await check('every page: its own title and description, a canonical to itself, one H1, en-NG, breadcrumbs, indexable', async () => {
  const titles = new Set()
  const descriptions = new Set()
  for (const [path, { html }] of pages) {
    const title = attr(html, /<title>([^<]+)<\/title>/)
    const description = attr(html, /<meta name="description" content="([^"]+)"/)
    const canonical = attr(html, /<link rel="canonical" href="([^"]+)"/)
    assert(title && title.length <= 75, `${path}: title "${title}" (${title?.length})`)
    assert(description && description.length >= 70 && description.length <= 170, `${path}: description length ${description?.length}`)
    assert(new URL(canonical).pathname === path, `${path}: canonical ${canonical}`)
    assert((html.match(/<h1[\s>]/g) ?? []).length === 1, `${path}: ${(html.match(/<h1[\s>]/g) ?? []).length} H1s`)
    assert(html.includes('lang="en-NG"'), `${path}: lang`)
    assert(!html.includes('name="robots" content="noindex'), `${path}: noindex in a production build`)
    if (path !== '/') assert(jsonLd(html).some((item) => item['@type'] === 'BreadcrumbList'), `${path}: no BreadcrumbList`)
    titles.add(title)
    descriptions.add(description)
  }
  assert(titles.size === pages.size && descriptions.size === pages.size, 'titles or descriptions repeat')
})

await check('structured data: articles on guides, FAQ on pricing and the trade pages, a VideoObject on the demo', async () => {
  for (const [path, { html }] of pages) {
    const types = jsonLd(html).map((item) => item['@type'])
    if (path.startsWith('/guides/')) assert(types.includes('Article'), `${path}: no Article`)
    if (path === '/pricing' || path.startsWith('/for/') || path.startsWith('/compare/')) assert(types.includes('FAQPage'), `${path}: no FAQPage`)
  }
  const video = jsonLd(pages.get('/demo').html).find((item) => item['@type'] === 'VideoObject')
  assert(video && /^PT\d+M\d+S$/.test(video.duration), `VideoObject: ${JSON.stringify(video)}`)
})

await check('every internal link on every page leads somewhere real', async () => {
  const links = new Set()
  for (const { html } of pages.values()) {
    for (const m of html.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)) links.add(m[1] || '/')
  }
  const broken = []
  for (const link of links) {
    if (link.startsWith('/assets/') || link.startsWith('/icons/')) continue
    const res = await fetch(`${UI}${link}`, { redirect: 'manual' })
    if (res.status >= 400) broken.push(`${link} ${res.status}`)
  }
  console.log(`    ${links.size} distinct internal links`)
  assert(broken.length === 0, broken.join(', '))
  for (const path of [...pages.keys()].filter((p) => p !== '/')) {
    const linkedFrom = [...pages.entries()].filter(([other, { html }]) => other !== path && html.includes(`href="${path}"`)).length
    assert(linkedFrom >= 1, `${path} is linked from no other page`)
  }
})

await check('the free template is a real spreadsheet that Procurepaddy imports as it is', async () => {
  const file = await fetch(`${UI}/downloads/procurepaddy-inventory-template.xlsx`)
  const bytes = Buffer.from(await file.arrayBuffer())
  assert(file.ok && bytes.subarray(0, 2).toString() === 'PK', 'not an xlsx')
  const count = await fetch(`${UI}/downloads/procurepaddy-stock-count-sheet.xlsx`)
  assert(count.ok && Buffer.from(await count.arrayBuffer()).subarray(0, 2).toString() === 'PK', 'count sheet not an xlsx')
  const shop = await fetch(`${API}/api/clients/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `E2E Template ${Date.now()}`, adminEmail: `template-${Date.now()}@example.com`, phone: `0803${Math.floor(1_000_000 + Math.random() * 8_999_999)}`, password: 'correct-horse-battery-staple' }),
  }).then((r) => r.json())
  const form = new FormData()
  form.append('file', new Blob([bytes]), 'procurepaddy-inventory-template.xlsx')
  form.append('kind', 'PRODUCT_CATALOG')
  const session = await fetch(`${API}/api/imports`, { method: 'POST', headers: { Authorization: `Bearer ${shop.tokens.accessToken}` }, body: form }).then((r) => r.json())
  assert(session.status === 'READY' && session.needsMapping === false && session.errorCount === 0, `import: ${JSON.stringify(session).slice(0, 200)}`)
})

await check('the demo video and its poster are served', async () => {
  const video = await fetch(`${UI}/marketing/demo.webm`)
  assert(video.ok && (video.headers.get('content-type') ?? '').includes('webm'), `video ${video.status} ${video.headers.get('content-type')}`)
  assert(Number(video.headers.get('content-length') ?? (await video.arrayBuffer()).byteLength) > 500_000, 'video too small')
  assert((await fetch(`${UI}/marketing/demo-poster.jpg`)).ok, 'poster missing')
})

await check('on a phone: no page scrolls sideways or errors, and a guide loads well under 70 KB of JavaScript', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  for (const path of pages.keys()) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    const scripts = new Set()
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.origin === UI && url.pathname.endsWith('.js')) scripts.add(url.pathname)
    })
    await page.goto(`${UI}${path}`)
    await page.waitForLoadState('networkidle')
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    assert(width <= 390, `${path} is ${width}px wide`)
    assert(errors.length === 0, `${path}: ${errors.join(' | ')}`)
    if (path === '/guides/how-to-do-a-stock-count') {
      let total = 0
      for (const src of scripts) total += gzipSync(Buffer.from(await fetch(`${UI}${src}`).then((r) => r.arrayBuffer()))).length
      console.log(`    a guide: ${Math.round(total / 1024)} KB of JavaScript`)
      assert(total < 70 * 1024, `${Math.round(total / 1024)} KB`)
      await page.screenshot({ path: SHOTS + 'guide.png', fullPage: true })
    }
    await page.close()
  }
  await context.close()
})

await check('the pricing calculator answers with the visitor’s own numbers', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  const page = await context.newPage()
  await page.goto(`${UI}/pricing`)
  await page.getByLabel('Stock you sell in a month (₦)').fill('5000000')
  await page.getByLabel('How much goes missing (%)').fill('2')
  await page.getByText('₦100,000').first().waitFor()
  await page.getByText('That is 10 times what Procurepaddy costs.').waitFor()
  await context.close()
})

await check('the count sheet prints on its own', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${UI}/stock-count-sheet`)
  await page.emulateMedia({ media: 'print' })
  const visible = await page.evaluate(() => ({
    sheet: getComputedStyle(document.querySelector('.count-sheet')).visibility,
    heading: getComputedStyle(document.querySelector('h1')).visibility,
  }))
  assert(visible.sheet === 'visible' && visible.heading === 'hidden', JSON.stringify(visible))
  await context.close()
})

await check('axe finds nothing on each kind of page (WCAG 2.2 AA), on a phone', async () => {
  const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  const found = []
  for (const path of ['/pricing', '/demo', '/about', '/compare/excel', '/free-inventory-template', '/stock-count-sheet', '/for/pharmacies', '/guides', '/guides/fifo-for-small-shops']) {
    const page = await context.newPage()
    await page.goto(`${UI}${path}`)
    await page.waitForLoadState('networkidle')
    await page.addScriptTag({ path: AXE })
    const violations = await page.evaluate(async () =>
      (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(
        (v) => `${v.id} ×${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`,
      ),
    )
    found.push(...violations.map((v) => `${path}: ${v}`))
    await page.close()
  }
  await context.close()
  assert(found.length === 0, found.join(' | '))
})

await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
