import type { SaleCancelReason } from '@/features/selling/sales/types'

/** The four reasons, as the counter shows them (selling till Step 3). */
export const CANCEL_REASON_LABELS: Record<SaleCancelReason, string> = {
  WRONG_ITEM: 'Wrong item',
  WRONG_AMOUNT: 'Wrong amount',
  CHANGED_MIND: 'Customer changed mind',
  OTHER: 'Something else',
}

/** How long the person who recorded a sale may cancel it alone - the server's two minutes, less a little. */
export const CANCEL_ALONE_FOR_MS = 110_000
