/** A request as the API takes it (STOCK_AREAS_PART_5.md): one area asking another of its branch for stock. */
export interface StockRequestPayload {
  /** Made on this phone, so a resend is recorded once. */
  id: string
  branchId?: string
  /** The area asked - the one that has it (the Store). */
  fromAreaId: string
  /** The area asking (the Kitchen). */
  toAreaId: string
  note?: string
  /** Whole numbers in `unit`, or the stock unit when `unit` is absent, as on every sheet. */
  lines: { productId: string; quantity: number; unit?: string }[]
  /** Set by the outbox: when it was asked on the phone. */
  occurredAt?: string
}

/** One request, as the Store's line, the Requests list and the Move it opens show it. */
export interface StockRequest {
  id: string
  branchId: string
  fromAreaId: string
  fromAreaName: string
  toAreaId: string
  toAreaName: string
  /** OPEN until every line is moved or none in the store (DONE), or CANCELLED. */
  status: 'OPEN' | 'DONE' | 'CANCELLED'
  askedById?: string
  askedByName?: string
  askedAt: string
  note?: string
  lines: StockRequestLine[]
  /** This person may move it: they work in the area asked. */
  canFill: boolean
  /** This person may take it back: they asked, or work in the asking area, and nothing has moved. */
  canCancel: boolean
  /** Who can move it, with a WhatsApp number - only to the person who asked, while it's open. */
  movers?: { id: string; name: string; whatsapp: string }[]
}

export interface StockRequestLine {
  productId: string
  productName: string
  unitOfMeasure?: string
  /** Asked, in the product's stock unit; `enteredQuantity`/`enteredUnit` as typed. */
  quantity: number
  enteredQuantity?: number
  enteredUnit?: string
  /** Moved so far, by moves that weren't undone or taken back. */
  moved: number
  /** The area asked said it has none. */
  noneInStore: boolean
}

/** "The Kitchen needs 2 cartons of tomato paste. The Store has none." - for the Low stock page. */
export interface NoneInStoreLine {
  requestId: string
  branchId: string
  productId: string
  productName: string
  unitOfMeasure?: string
  quantity: number
  enteredQuantity?: number
  enteredUnit?: string
  fromAreaName: string
  toAreaName: string
  askedByName?: string
  askedAt: string
}
