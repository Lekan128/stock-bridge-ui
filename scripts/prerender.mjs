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
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = `${root}dist/`
const ssr = `${root}dist-ssr/`

const siteUrl = (process.env.SITE_URL || 'https://procurepaddy.com').replace(/\/$/, '')
const noindex = process.env.SITE_NOINDEX === 'true'

const { renderHome, SITEMAP_PATHS } = await import(pathToFileURL(`${ssr}entry-server.js`).href)
const { html, head, foundingOffer, hasFounders } = renderHome({
  siteUrl,
  googleVerification: process.env.GOOGLE_SITE_VERIFICATION,
  bingVerification: process.env.BING_SITE_VERIFICATION,
})

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
  `prerendered / (${foundingOffer ? 'founding offer' : 'early access'}) for ${siteUrl}${noindex ? ' (noindex)' : ''}; wrote sitemap.xml and robots.txt`,
)
