/**
 * A waybill as both branches see it - `/api/stock-transfers` (MULTI_BRANCH_BUILD_PLAN.md §5,
 * MULTI_BRANCH_UX_PLAN.md §5.4-5.7). Quantities are in the product's stock unit; `enteredUnit` and
 * `enteredQuantity` are the line as it was typed ("10 crates"), for the waybill.
 */
export type TransferStatus = 'ON_THE_WAY' | 'PARTLY_RECEIVED' | 'RECEIVED' | 'RECEIVED_SHORT' | 'CANCELLED'

export interface TransferLine {
  productId: string
  productName: string
  sku: string
  unitOfMeasure?: string
  quantitySent: number
  quantityReceived: number
  quantityMissing: number
  quantityDamaged: number
  onTheWay: number
  enteredUnit?: string
  enteredQuantity?: number
  /** "10 crates", "240 pieces" - the line as the waybill prints it. */
  sentText?: string
}

export interface Transfer {
  id: string
  /** "WB-BOL-0042" - given by the server, so a waybill saved offline has none yet. */
  waybill: string
  number: number
  fromBranchId: string
  fromBranchName: string
  toBranchId: string
  toBranchName: string
  status: TransferStatus
  sentByName?: string
  sentAt: string
  carriedByName?: string
  carriedByPhone?: string
  note?: string
  receivedByName?: string
  receivedAt?: string
  /** Missing or damaged and not yet checked: shown at both ends until somebody says what happened. */
  missing: number
  missingCheckedByName?: string
  missingCheckedAt?: string
  missingNote?: string
  lines: TransferLine[]
  /** The waybill as plain text for WhatsApp. */
  shareText: string
}

export interface SendPayload {
  /** Made on the phone: it is the waybill's id, so sending it twice records it once. */
  id: string
  fromBranchId: string
  toBranchId: string
  occurredAt?: string
  carriedByName?: string
  carriedByPhone?: string
  note?: string
  /** `quantity` in `unit` (a pack code, "CRATE"), or in the stock unit when `unit` is absent. */
  lines: { productId: string; quantity: number; unit?: string }[]
  /** "It's already there - record it as received" (UX §5.6). */
  receiveNow?: boolean
}

export interface ReceiptPayload {
  /** Made on the phone, so a receipt sent twice is recorded once. */
  id: string
  occurredAt?: string
  asSent?: boolean
  lines?: { productId: string; received: number; missing: number; damaged: number }[]
}

export function isOpen(transfer: Pick<Transfer, 'status'>): boolean {
  return transfer.status === 'ON_THE_WAY' || transfer.status === 'PARTLY_RECEIVED'
}

export const STATUS_LABEL: Record<TransferStatus, string> = {
  ON_THE_WAY: 'On the way',
  PARTLY_RECEIVED: 'Part received',
  RECEIVED: 'Received',
  RECEIVED_SHORT: 'Received short',
  CANCELLED: 'Cancelled',
}
