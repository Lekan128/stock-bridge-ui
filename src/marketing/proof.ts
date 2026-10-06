/**
 * Real shops' results (LANDING_PAGE_PLAN.md, step 6: "no placeholder proof left on the page"). Filled
 * from the field test (FIELD_TEST_KIT.md §6) and from founding shops, only with each owner's written
 * permission. Empty until then, and the page shows nothing in its place: an invented testimonial
 * costs more trust than none.
 *
 * Photos go in `public/marketing/shops/` (WebP, about 800px wide).
 */
export interface ShopResult {
  /** "Mama Tee Stores" */
  shop: string
  /** "Tolani Adeyemi, owner" */
  person: string
  /** Matches a `/for/` page, so the result also shows there: provision-stores, pharmacies… */
  trade: 'provision-stores' | 'supermarkets' | 'pharmacies' | 'building-materials' | 'wholesalers'
  /** "Mile 12, Lagos" */
  place: string
  /** The headline result, in numbers, as they said it: "Found ₦84,000 of rice missing in the first count." */
  result: string
  /** One or two sentences, their own words, lightly edited for length only. */
  quote: string
  photo?: { src: string; alt: string; width: number; height: number }
  /** When and how they agreed to be on the site ("signed form, 12 Oct 2026"). Never shown; kept for us. */
  permission: string
}

export const SHOP_RESULTS: ShopResult[] = []
