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
  /** The request it fills (Part 5): the area asked moving to the area that asked. */
  requestId?: string
  /** Set by the outbox when the move goes late: when it happened on the phone, and that it was offline. */
  occurredAt?: string
  recordedOffline?: boolean
}

/** What happened to what didn't arrive (Parts 4 and 6): still where it was moved from, or written off there. */
export type MoveRest = 'BACK' | 'DAMAGED' | 'EXPIRED' | 'LOST' | 'OTHER'

/** What an area that confirms got of a move (Part 4). */
export interface AreaMoveConfirmPayload {
  /** What arrived of each line, in the product's stock unit; a line left out arrived whole. Each short line says
   *  what happened to the rest (Part 6). */
  lines: { productId: string; got: number; rest?: MoveRest }[]
  /** For lines that don't say: still where it was moved from (the default), or written off. */
  rest?: MoveRest
  /** The confirmer's words about what didn't arrive (owner, 2026-11-01). */
  note?: string
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
    /** What happened to what didn't arrive (Part 6). */
    restReason?: MoveRest
    /** Given back or reported by an area that uses stock up (Part 6), oldest first. */
    returns?: AreaReturn[]
    /** What's left of it to give back or report. */
    returnable?: number
  }[]
  /** It went to an area that confirms, so it waited (Part 4). Absent from an older API: no. */
  waits?: boolean
  confirmedByName?: string
  confirmedAt?: string
  /** This person may confirm it: it waits for an area they work in. */
  canConfirm?: boolean
  /** This person may take it back while it waits: they moved it, or work where it left from. */
  canCancel?: boolean
  /** The confirmer's words about what didn't arrive (Part 6). */
  confirmNote?: string
  /** This person may give back or report part of it: a give to an area they work in that uses stock up, lately. */
  canReturn?: boolean
}

export type ReturnReason = 'SPOILT' | 'EXPIRED' | 'DAMAGED' | 'OTHER'

/** Given back, or reported, by an area that uses stock up (STOCK_AREAS_PART_6.md). `quantity` in the stock unit. */
export interface AreaReturn {
  kind: 'GIVE_BACK' | 'REPORT'
  quantity: number
  reason?: ReturnReason
  note?: string
  byName?: string
  at: string
}

/** A give back or a report as the API takes it. `id` is made on this phone, so a resend is recorded once. */
export interface AreaReturnPayload {
  id: string
  productId: string
  kind: 'GIVE_BACK' | 'REPORT'
  /** Whole numbers in `unit`, or the stock unit when it's absent. */
  quantity: number
  unit?: string
  reason?: ReturnReason
  note?: string
  occurredAt?: string
  recordedOffline?: boolean
}
