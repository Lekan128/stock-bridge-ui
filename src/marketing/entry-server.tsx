import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { EarlyAccessLanding } from '@/marketing/EarlyAccessLanding'
import { FoundingLanding } from '@/marketing/FoundingLanding'
import { FOUNDING_OFFER } from '@/marketing/config'
import { FAQ } from '@/marketing/faq'
import { FOUNDERS } from '@/marketing/founders'
import { HOME, HOME_FOUNDING, SITEMAP_PATHS, headTags, type HeadOptions } from '@/marketing/site'

/**
 * Build-time rendering for the marketing pages (LANDING_PAGE_PLAN.md §5): `scripts/prerender.mjs`
 * calls this after `vite build`, so `/` ships as real HTML that a crawler reads without running
 * JavaScript. With the founding offer on, the browser then hydrates only the page's Islands.
 */
export function renderHome(options: HeadOptions): { html: string; head: string; foundingOffer: boolean; hasFounders: boolean } {
  return {
    html: renderToString(<StrictMode>{FOUNDING_OFFER ? <FoundingLanding /> : <EarlyAccessLanding />}</StrictMode>),
    head: FOUNDING_OFFER ? headTags(HOME_FOUNDING, options, FAQ) : headTags(HOME, options),
    foundingOffer: FOUNDING_OFFER,
    hasFounders: FOUNDERS != null,
  }
}

/**
 * `/founding`: the same offer with no way out but the button, for ads and outreach (conversion
 * rule 6). Canonical to `/` and always noindex (the prerender adds that), so it never competes with
 * the home page in search. Null while the founding offer is off: the prerender then sends
 * `/founding` to `/`.
 */
export function renderFounding(options: HeadOptions): { html: string; head: string } | null {
  if (!FOUNDING_OFFER) return null
  return {
    html: renderToString(<StrictMode><FoundingLanding variant="founding" /></StrictMode>),
    head: headTags(HOME_FOUNDING, options),
  }
}

export { SITEMAP_PATHS }
