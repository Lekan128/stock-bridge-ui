/** A move between two areas of a branch as the API takes it (STOCK_AREAS_PART_2.md). */
export interface AreaMovePayload {
  /** Made on this phone, so a resend is recorded once. */
  id: string
  branchId?: string
  fromAreaId: string
  toAreaId: string
  note?: string
  /** Whole numbers in `unit`, or the stock unit when `unit` is absent, as on every sheet. */
  lines: { productId: string; quantity: number; unit?: string }[]
  /** Set by the outbox when the move goes late: when it happened on the phone, and that it was offline. */
  occurredAt?: string
  recordedOffline?: boolean
}

/** One move, as the screens and the Moves list show it. */
export interface AreaMove {
  id: string
  branchId: string
  fromAreaId: string
  fromAreaName: string
  toAreaId: string
  toAreaName: string
  /** False: a give to an area that uses what it's given - each line was recorded as Used there. */
  toKeepsStock: boolean
  status: 'DONE' | 'VOIDED' | 'WAITING' | 'CONFIRMED_SHORT' | 'CANCELLED'
  movedById?: string
  movedByName?: string
  movedAt: string
  note?: string
  /** Until when this person may undo it; absent once they can't (`== null`). */
  undoUntil?: string
  lines: {
    productId: string
    productName: string
    /** In the product's stock unit. */
    quantity: number
    enteredQuantity?: number
    enteredUnit?: string
    used: boolean
  }[]
}
