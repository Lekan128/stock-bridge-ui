/**
 * Charges and taxes (API V100, selling till Step 10): the same arithmetic as the API's ChargeService, so the till shows
 * what a sale comes to before it's recorded. Each charge is worked out on the food and drinks, never on another
 * charge, to the naira. Added on top: a % of them, or the fixed amount. In the prices: taken out together - the fixed
 * ones first, then the %s on what's left (7.5% VAT in a ₦1,075 price is ₦75).
 */
export interface Charge {
  id: string
  branchId?: string
  name: string
  kind: 'PERCENT' | 'AMOUNT'
  value: number
  included: boolean
  applies: 'EVERY_SALE' | 'TABLE_BILLS'
  active?: boolean
  sortOrder?: number
}

/** A charge on one sale, with what it came to. */
export interface SaleCharge {
  chargeId?: string
  name: string
  kind: 'PERCENT' | 'AMOUNT'
  value: number
  included: boolean
  amount: number
}

const halfUp = (value: number) => Math.round(value + Number.EPSILON)

export function chargeAmounts(subtotal: number, charges: Pick<Charge, 'kind' | 'value' | 'included'>[]): number[] {
  if (!(subtotal > 0)) return charges.map(() => 0)
  const fixedIn = charges.filter((c) => c.included && c.kind === 'AMOUNT').reduce((sum, c) => sum + Number(c.value), 0)
  const rateIn = charges.filter((c) => c.included && c.kind === 'PERCENT').reduce((sum, c) => sum + Number(c.value), 0)
  const base = Math.max(0, subtotal - fixedIn) / (1 + rateIn / 100)
  return charges.map((c) => (c.kind === 'AMOUNT' ? Number(c.value) : halfUp(((c.included ? base : subtotal) * Number(c.value)) / 100)))
}

/** The charges priced on a subtotal, and what the customer pays: it plus every charge added on top. */
export function priceCharges(subtotal: number, charges: Charge[]): { charges: SaleCharge[]; toPay: number } {
  const amounts = chargeAmounts(subtotal, charges)
  const priced = charges.map((c, i) => ({ chargeId: c.id, name: c.name, kind: c.kind, value: Number(c.value), included: c.included, amount: amounts[i] }))
  return { charges: priced, toPay: subtotal + priced.filter((c) => !c.included).reduce((sum, c) => sum + c.amount, 0) }
}

/** "VAT 7.5%", "Cover charge" - how a charge reads on a bill or receipt. */
export function chargeLabel(charge: Pick<SaleCharge, 'name' | 'kind' | 'value'>): string {
  return charge.kind === 'PERCENT' ? `${charge.name} ${Number(charge.value)}%` : charge.name
}
