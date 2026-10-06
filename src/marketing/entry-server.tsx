import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { EarlyAccessLanding } from '@/marketing/EarlyAccessLanding'
import { FoundingLanding } from '@/marketing/FoundingLanding'
import { FOUNDING_OFFER } from '@/marketing/config'
import { FAQ } from '@/marketing/faq'
import { FOUNDERS } from '@/marketing/founders'
import { PAGES, checkPaths } from '@/marketing/pages/registry'
import { marketingFile } from '@/marketing/paths'
import { HOME, HOME_FOUNDING, headTags, type HeadOptions } from '@/marketing/site'

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

/**
 * Every other marketing page (step 7): pricing, comparisons, the trade pages, the free tools,
 * about, the demo and the guides, each into its own HTML file.
 */
export function renderPages(options: HeadOptions): { path: string; file: string; id: string; html: string; head: string }[] {
  checkPaths()
  return PAGES.map((page) => ({
    path: page.meta.path,
    file: marketingFile(page.meta.path),
    id: page.id,
    html: renderToString(<StrictMode>{page.render()}</StrictMode>),
    head: headTags(page.meta, options, {
      faq: page.faq,
      breadcrumbs: page.crumbs,
      jsonLd: page.jsonLd?.(options),
    }),
  }))
}

/**
 * One page, by its path, for the dev server (`vite.config.ts`), so `npm run dev` serves every
 * marketing page as the build does instead of an empty shell. Null for a path that isn't one.
 */
export function renderPath(path: string, options: HeadOptions): { html: string; head: string; id?: string } | null {
  if (path === '/') return renderHome(options)
  if (path === '/founding') return renderFounding(options) ?? renderHome(options)
  const page = PAGES.find((candidate) => candidate.meta.path === path)
  if (!page) return null
  return {
    id: page.id,
    html: renderToString(<StrictMode>{page.render()}</StrictMode>),
    head: headTags(page.meta, options, { faq: page.faq, breadcrumbs: page.crumbs, jsonLd: page.jsonLd?.(options) }),
  }
}

/** What the sitemap lists: every indexable marketing page (not /founding, which is noindex). */
export const SITEMAP_PATHS = ['/', ...PAGES.map((page) => page.meta.path)]
