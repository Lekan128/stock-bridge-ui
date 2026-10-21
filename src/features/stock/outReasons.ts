import type { OutReason } from '@/features/products/types'

/**
 * The reasons a stock-out can be given, in the order they are offered (`SELLING_PRICE_PLAN.md`
 * §6.3): the everyday ones first, "Sold" near the end because most companies that only use their
 * stock never pick it, "Other" last. One list for the stock-out sheet, quick mode, the history and
 * the movements report, so a reason reads the same everywhere it appears.
 */
export const OUT_REASONS: readonly { value: OutReason; label: string }[] = [
  { value: 'USED', label: 'Used' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'LOST', label: 'Lost or stolen' },
  { value: 'RETURNED_TO_SUPPLIER', label: 'Returned to supplier' },
  { value: 'SALE', label: 'Sold' },
  { value: 'OTHER', label: 'Other' },
]

/** How a reason reads in a sentence or a cell: "Expired", "Lost or stolen". */
export function outReasonLabel(reason: OutReason): string {
  return OUT_REASONS.find((option) => option.value === reason)?.label ?? reason
}

/** What a stock-out with no reason is called where one has to be named - a filter, a report. */
export const NO_REASON_LABEL = 'No reason given'
