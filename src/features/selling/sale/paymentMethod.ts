/**
 * How the customer paid (SELLING_TILL_PLAN.md Step 1). CARD is the POS machine - called "Card" on
 * screen, since "POS" in Nigeria is also the cash agent on the street.
 */
export type SalePaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'SPLIT'

/** The ways a customer can pay. SPLIT is only ever a table's bill paid in parts (V101), never chosen. */
export const PAYMENT_METHODS: SalePaymentMethod[] = ['CASH', 'TRANSFER', 'CARD']

export const PAYMENT_LABELS: Record<SalePaymentMethod, string> = { CASH: 'Cash', TRANSFER: 'Transfer', CARD: 'Card', SPLIT: 'Split' }

export function paymentLabel(method: SalePaymentMethod | null | undefined): string {
  return method == null ? 'Not recorded' : PAYMENT_LABELS[method]
}
