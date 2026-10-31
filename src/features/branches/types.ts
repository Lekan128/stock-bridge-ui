/** One branch as the signed-in person sees it — `GET /api/branches` (MULTI_BRANCH_UX_PLAN.md §4). */
export interface Branch {
  id: string
  name: string
  phone?: string
  address?: string
  /** The main branch: where marketplace orders arrive, and where people with no branch of their own work. */
  main: boolean
  active: boolean
  closedAt?: string
  /** Whether this person may record stock here now. False for a branch they only see, or a closed one. */
  canRecord: boolean
  /** Only for people who can manage branches. Absent otherwise (`== null`, never `=== null`). */
  productsInStock?: number
  stockWorth?: number
  /** How many people work there. Only for people who can manage branches. */
  people?: number
  /**
   * Its areas (STOCK_AREAS_PLAN.md §4), open ones first: just its Store at a branch that hasn't added
   * any, and then the app shows no area word (rule 1). Absent from an older API, and on the answer to a
   * change (the list is read again).
   */
  areas?: Area[]
}

/** One place inside a branch where stock is kept or used: Store, Kitchen, Bar. */
export interface Area {
  id: string
  name: string
  /** False: it uses what it's given (Housekeeping). It never holds a figure, and no sheet records there. */
  keepsStock: boolean
  /** Where deliveries arrive. One per branch. */
  delivery: boolean
  active: boolean
  closedAt?: string
  /** How many products it holds any of - people who manage branches, at a branch with areas. */
  productsInStock?: number
  /** Whether the signed-in person works here (V64, STOCK_AREAS_PART_3.md). Absent from an older API: yes. */
  worksHere?: boolean
  /**
   * Stock is worked with here (Kitchen, Bar - Part 3.5): a count that comes up short is what was used. False
   * where it's stored (a count's shortfall is missing), and where it keeps no stock.
   */
  shortIsUsed?: boolean
}

/** A product in one area - the product page's and the sync rows' `areaStock` (V60). */
export interface AreaFigure {
  areaId: string
  branchId: string
  quantityOnHand: number
  /** The product page only (Part 3.5): when this area last counted it. */
  lastCountedAt?: string
  /** The area has had this product - holds it, or ran out of it (Part 3.6). Absent from an older API. */
  carried?: boolean
}

export interface BranchList {
  branches: Branch[]
  /** The company has, or has had, more than one branch. False: no branch word anywhere (rule 1). */
  multiBranch: boolean
  /** May open every branch, and "All branches". */
  seesEverywhere: boolean
  /** May record at every branch (owners, "Work at all branches"). */
  recordsEverywhere: boolean
  /** May add a branch now: can manage branches, and the pilot lets this company. */
  mayAddBranch: boolean
  /**
   * Every open branch by name, for Send stock's "To" (UX §5.4) - a storekeeper sends to a branch they
   * don't otherwise see. Empty for someone who can't send stock. Absent from an older API.
   */
  sendTo?: { id: string; name: string }[]
  /** How many open branches the company has, whether or not this person sees them. Absent from an older API. */
  openBranches?: number
  /** May add areas inside a branch now: can manage branches, and the areas pilot lets this company. */
  mayAddArea?: boolean
}

/** A product at one branch — the sync rows' and the product page's `branchStock`. */
export interface BranchFigure {
  branchId: string
  quantityOnHand: number
  lowStockThreshold?: number
  isLowStock: boolean
  stockStatus: 'OK' | 'LOW' | 'OUT'
  /** Sent here on open waybills, not yet received. Never in `quantityOnHand` (UX rule 5). */
  onTheWay?: number
  /** The product page only: when this branch last counted it. */
  lastCountedAt?: string
  /** The product page only: this branch's own level, absent when it uses the product's. */
  ownLowStockThreshold?: number
}

/** Where this phone is: one branch, or every branch the person sees. */
export const ALL_BRANCHES = 'ALL' as const
export type WorkingBranchChoice = string | typeof ALL_BRANCHES
