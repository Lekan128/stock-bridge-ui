/**
 * One of a company's own product groups ("Grains", "Drinks") — `/api/company-categories`.
 *
 * Not the marketplace category a seller's listing is filed under (`features/storefront`,
 * `features/marketplace`): those belong to ProcurePaddy and are the same for everyone, while these
 * belong to one company and are only ever seen by it.
 */
export interface CompanyCategory {
  id: string
  name: string
  /** How many of the company's products are in it — what a delete confirmation has to state. */
  productCount: number
}

/** Body for create and rename. The server trims it, refuses blank or over 80, and 409s a duplicate. */
export interface CompanyCategoryPayload {
  name: string
}

/** Mirrors the server's limit, so the input can stop at it instead of failing after a round trip. */
export const CATEGORY_NAME_MAX_LENGTH = 80
