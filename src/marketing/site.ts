/**
 * What every marketing page says about itself to search engines, link previews and AI crawlers
 * (LANDING_PAGE_PLAN.md §5). Rendered into each page's <head> at build time by
 * `scripts/prerender.mjs`, so a crawler reads it without running JavaScript.
 */

/** The canonical origin. Set SITE_URL at build time for staging; production is the default. */
export const DEFAULT_SITE_URL = 'https://procurepaddy.com'

export const WHATSAPP_NUMBER = '+234 818 410 3312'
export const WHATSAPP_URL = 'https://wa.me/2348184103312'

export interface PageMeta {
  /** The path, e.g. `/` or `/pricing`. */
  path: string
  title: string
  description: string
}

export const HOME: PageMeta = {
  path: '/',
  // The H1 sells (conversion rule 2); the keyword lives here, where search engines weigh it most.
  title: 'Inventory App for Nigerian Shops & Warehouses | Procurepaddy',
  description:
    'Know what is in your shop and who recorded what, even with no network. Procurepaddy records every bag, carton and piece on your staff’s phones.',
}

/** With the founding offer on, the search result sells it too (plan §5: the result is an ad). */
export const HOME_FOUNDING: PageMeta = {
  ...HOME,
  description:
    'Know what is in your shop and who recorded what, even offline. We load your products in 24 hours. Free for 12 months for the first 100 shops.',
}

export interface HeadOptions {
  siteUrl: string
  /** Google Search Console's HTML-tag verification code, if set. */
  googleVerification?: string
  /** Bing Webmaster Tools' verification code, if set. */
  bingVerification?: string
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The page's <head> tags: title, description, canonical, social cards, verification, JSON-LD. */
export function headTags(page: PageMeta, options: HeadOptions, faq?: { question: string; answer: string }[]): string {
  const origin = options.siteUrl.replace(/\/$/, '')
  const url = `${origin}${page.path}`
  const image = `${origin}/icons/og-1200x630.png`
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Procurepaddy',
      url: origin,
      logo: `${origin}/icons/pwa-512.png`,
      contactPoint: { '@type': 'ContactPoint', telephone: WHATSAPP_NUMBER.replace(/\s/g, ''), contactType: 'customer support', areaServed: 'NG' },
    },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Procurepaddy', url: origin },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Procurepaddy',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Android, iOS, Web',
      description: page.description,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN' },
    },
    // No rich result since May 2026, but a clear, citable answer for search and AI (plan §3).
    ...(faq
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          },
        ]
      : []),
  ]
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Procurepaddy" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:locale" content="en_NG" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    options.googleVerification ? `<meta name="google-site-verification" content="${escapeHtml(options.googleVerification)}" />` : '',
    options.bingVerification ? `<meta name="msvalidate.01" content="${escapeHtml(options.bingVerification)}" />` : '',
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ]
  return tags.filter(Boolean).join('\n    ')
}

/** Every page the sitemap lists. Step 7's pages join this list as they are written. */
export const SITEMAP_PATHS = ['/']
