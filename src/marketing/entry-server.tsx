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

export { SITEMAP_PATHS }
