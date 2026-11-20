import { createContext, useContext } from 'react'

/**
 * Where the selling screens send people (owner, 2026-11-19: quick mode is the same app, focused). In the usual app a
 * table opens /app/sell/bill; inside quick mode the same Tables, bill and receipt open inside quick mode, so its
 * buttons stay on top. The screens are the same either way.
 */
export interface SellingNav {
  /** Inside quick mode: no page heading of its own (quick mode has one), nothing that leaves it. */
  quick: boolean
  /** The Tables grid. */
  tables: string
  /** A bill: `table=…`, `id=…` or `name=…`. */
  bill: (query: string) => string
  /** A paid sale's receipt. */
  receipt: (saleId: string) => string
}

export const USUAL_SELLING_NAV: SellingNav = {
  quick: false,
  tables: '/app/sell',
  bill: (query) => `/app/sell/bill?${query}`,
  receipt: (saleId) => `/app/sales/${saleId}`,
}

export const QUICK_SELLING_NAV: SellingNav = {
  quick: true,
  tables: '/app/quick?mode=tables',
  bill: (query) => `/app/quick?mode=tables&${query}`,
  receipt: (saleId) => `/app/quick?mode=tables&receipt=${saleId}`,
}

export const SellingNavContext = createContext<SellingNav>(USUAL_SELLING_NAV)

export function useSellingNav(): SellingNav {
  return useContext(SellingNavContext)
}
