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

/** What an area that confirms got of a move (Part 4). */
export interface AreaMoveConfirmPayload {
  /** What arrived of each line, in the product's stock unit; a line left out arrived whole. */
  lines: { productId: string; got: number }[]
  /** What happened to whatever didn't arrive: still where it was moved from (the default), or damaged. */
  rest?: 'BACK' | 'DAMAGED'
  /** Set by the outbox when it goes late: when it was confirmed on the phone, and that it was offline. */
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
    /** What arrived, once a move that waited is confirmed (Part 4); absent before. */
    got?: number
    /** Of what didn't arrive, what was recorded as damaged. */
    damaged?: number
    /** The product's stock unit, which `quantity` and `got` are in. Absent from an older API. */
    unitOfMeasure?: string
  }[]
  /** It went to an area that confirms, so it waited (Part 4). Absent from an older API: no. */
  waits?: boolean
  confirmedByName?: string
  confirmedAt?: string
  /** This person may confirm it: it waits for an area they work in. */
  canConfirm?: boolean
  /** This person may take it back while it waits: they moved it, or work where it left from. */
  canCancel?: boolean
}
