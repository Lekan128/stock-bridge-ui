/**
 * Every marketing page's address besides `/` (LANDING_PAGE_PLAN.md, steps 4 and 7). Plain data with
 * no imports, because `vite.config.ts` reads it too: the preview server and the service worker must
 * hand these to the network (the prerendered page), never to the app shell.
 *
 * Each is prerendered to `dist<path>.html` by `scripts/prerender.mjs`, which also refuses a build
 * where this list and the pages it knows how to render disagree.
 */
export const GUIDE_SLUGS = [
  'how-to-track-stock-in-a-shop',
  'how-to-do-a-stock-count',
  'how-to-stop-stock-going-missing',
  'opening-stock-how-to-start-your-records',
  'reorder-levels-explained',
  'fifo-for-small-shops',
  'bags-cartons-and-pieces',
  'how-to-know-your-real-cost-price',
  'keeping-stock-in-excel',
  'stock-records-without-internet',
] as const

export const TRADE_SLUGS = ['provision-stores', 'supermarkets', 'pharmacies', 'building-materials', 'wholesalers'] as const

export const MARKETING_PATHS: string[] = [
  '/founding',
  '/pricing',
  '/demo',
  '/about',
  '/compare/excel',
  '/compare/notebook',
  '/free-inventory-template',
  '/stock-count-sheet',
  ...TRADE_SLUGS.map((slug) => `/for/${slug}`),
  '/guides',
  ...GUIDE_SLUGS.map((slug) => `/guides/${slug}`),
]

/** The file a path is prerendered into, relative to `dist/`. */
export function marketingFile(path: string): string {
  return `${path.slice(1)}.html`
}
