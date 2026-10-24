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
