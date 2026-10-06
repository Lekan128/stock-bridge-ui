/**
 * Every address in the ProcurePal marketplace, in one place.
 *
 * The marketplace lived at `/` until the Procurepaddy landing page took it (LANDING_PAGE_PLAN.md,
 * step 2). It now sits under `/marketplace`, and when ProcurePal moves to its own domain this is the
 * one file whose base changes. Links never spell these paths out by hand.
 *
 * The old addresses (`/product/…`, `/seller/…`, `/cart`, `/checkout…`, `/order-confirmation/…`,
 * `/?q=…`) redirect here with their query strings: on Netlify as 301s (`public/_redirects`), and in
 * the app itself (`LegacyMarketplaceRedirect`), because Monnify's return carries the payment
 * reference in the query string.
 */
export const MARKETPLACE_BASE = '/marketplace'

export const marketplacePaths = {
  home: MARKETPLACE_BASE,
  search: (term: string) => `${MARKETPLACE_BASE}?q=${encodeURIComponent(term)}`,
  category: (categoryId: string) => `${MARKETPLACE_BASE}?categoryId=${encodeURIComponent(categoryId)}`,
  product: (idOrSlug: string) => `${MARKETPLACE_BASE}/product/${idOrSlug}`,
  seller: (idOrSlug: string) => `${MARKETPLACE_BASE}/seller/${idOrSlug}`,
  cart: `${MARKETPLACE_BASE}/cart`,
  checkout: `${MARKETPLACE_BASE}/checkout`,
  checkoutProcessing: `${MARKETPLACE_BASE}/checkout/processing`,
  orderConfirmation: (orderId: string) => `${MARKETPLACE_BASE}/order-confirmation/${orderId}`,
} as const
