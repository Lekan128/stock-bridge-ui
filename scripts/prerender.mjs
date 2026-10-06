// Prerenders the marketing pages after `vite build` (LANDING_PAGE_PLAN.md, step 2).
//
//   1. `vite build`                         the app (index.html) and the landing page (landing.html)
//   2. `vite build --ssr src/marketing/…`   the same React components, for Node, into dist-ssr/
//   3. this script                          renders them into dist/landing.html's <head> and #root,
//                                           and writes dist/sitemap.xml and dist/robots.txt
//
// Netlify serves dist/landing.html at / (public/_redirects). Settings, all optional:
//   SITE_URL                   canonical origin (default https://procurepaddy.com; set it for staging)
//   GOOGLE_SITE_VERIFICATION   Search Console's HTML-tag code
//   BING_SITE_VERIFICATION     Bing Webmaster Tools' code
//   SITE_NOINDEX=true          staging: tell crawlers to stay away entirely
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = `${root}dist/`
const ssr = `${root}dist-ssr/`

const siteUrl = (process.env.SITE_URL || 'https://procurepaddy.com').replace(/\/$/, '')
const noindex = process.env.SITE_NOINDEX === 'true'

const { renderHome, renderFounding, renderPages, SITEMAP_PATHS } = await import(pathToFileURL(`${ssr}entry-server.js`).href)
const headOptions = {
  siteUrl,
  googleVerification: process.env.GOOGLE_SITE_VERIFICATION,
  bingVerification: process.env.BING_SITE_VERIFICATION,
}
const { html, head, foundingOffer, hasFounders } = renderHome(headOptions)

// Conversion rule 8: a real face and name before the offer goes live. A staging or preview build
// (noindex) may show the page without them; production may not.
if (foundingOffer && !hasFounders && !noindex) {
  throw new Error(
    'The founding offer is on but src/marketing/founders.ts is empty. Add the founders before a production build, or build with SITE_NOINDEX=true.',
  )
}

const template = readFileSync(`${dist}landing.html`, 'utf8')
for (const marker of ['<!--marketing-head-->', '<!--marketing-html-->']) {
  if (!template.includes(marker)) throw new Error(`landing.html is missing ${marker}`)
}
const robotsMeta = noindex ? '<meta name="robots" content="noindex, nofollow" />\n    ' : ''
// The page's one typeface, fetched alongside the CSS rather than after it, so headings render in
// Plex sooner (Lighthouse's first paint on a phone).
const plex = readdirSync(`${dist}assets`).find((file) => /^ibm-plex-sans-latin-standard-normal-.*\.woff2$/.test(file))
const fontPreload = plex ? `<link rel="preload" href="/assets/${plex}" as="font" type="font/woff2" crossorigin />\n    ` : ''
writeFileSync(
  `${dist}landing.html`,
  template.replace('<!--marketing-head-->', robotsMeta + fontPreload + head).replace('<!--marketing-html-->', html),
)

// /founding (conversion rule 6): the offer with no navigation, for ads and outreach. Never indexed,
// whatever the build: it is the home page's offer again, and canonical to it. With the offer off
// there is nothing to show, so it sends visitors to the home page.
const founding = renderFounding(headOptions)
const neverIndex = '<meta name="robots" content="noindex, follow" />\n    '
writeFileSync(
  `${dist}founding.html`,
  founding
    ? template
        .replace('<!--marketing-head-->', (noindex ? robotsMeta : neverIndex) + fontPreload + founding.head)
        .replace('<!--marketing-html-->', founding.html)
    : `<!doctype html><html lang="en-NG"><head><meta charset="utf-8" /><meta name="robots" content="noindex" /><link rel="canonical" href="${siteUrl}/" /><meta http-equiv="refresh" content="0; url=/" /><title>Procurepaddy</title></head><body><a href="/">Procurepaddy</a></body></html>\n`,
)

// Every other marketing page (step 7): each into dist/<path>.html, with its own head, and a
// data-page on <html> for anything only that page needs (the count sheet's print styles).
const pages = renderPages(headOptions)
for (const page of pages) {
  const out = `${dist}${page.file}`
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(
    out,
    template
      .replace('data-surface="marketing"', `data-surface="marketing" data-page="${page.id}"`)
      .replace('<!--marketing-head-->', robotsMeta + fontPreload + page.head)
      .replace('<!--marketing-html-->', page.html),
  )
}

// Netlify: each page is served as itself, ahead of the app shell's catch-all (public/_redirects
// ends with /* /index.html). Written into the copy in dist, just before that last rule.
const redirects = readFileSync(`${dist}_redirects`, 'utf8')
const catchAll = '# Everything else is the app.'
if (!redirects.includes(catchAll)) throw new Error(`public/_redirects is missing "${catchAll}"`)
const rules = pages.map((page) => `${page.path}  /${page.file}  200!`).join('\n')
writeFileSync(
  `${dist}_redirects`,
  redirects.replace(catchAll, `# The marketing pages, written by scripts/prerender.mjs.\n${rules}\n\n${catchAll}`),
)

const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  `${dist}sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_PATHS.map((path) => `  <url><loc>${siteUrl}${path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`,
)

writeFileSync(
  `${dist}robots.txt`,
  noindex
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *
Allow: /
# The workspace, admin and anything personal: nothing for a search engine there.
Disallow: /app
Disallow: /admin
Disallow: /login
Disallow: /signup
Disallow: /verify-email
Disallow: /marketplace/cart
Disallow: /marketplace/checkout
Disallow: /marketplace/order-confirmation

Sitemap: ${siteUrl}/sitemap.xml
`,
)

rmSync(ssr, { recursive: true, force: true })
console.log(
  `prerendered / (${foundingOffer ? 'founding offer' : 'early access'}), /founding${founding ? '' : ' (redirect)'} and ${pages.length} more pages for ${siteUrl}${noindex ? ' (noindex)' : ''}; wrote sitemap.xml, robots.txt and the _redirects rules`,
)
