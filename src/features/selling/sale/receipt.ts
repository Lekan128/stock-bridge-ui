import type { UnitOfMeasureOption } from '@/features/products/types'
import { formatNumber } from '@/features/products/unitCopy'
import { formatMoney } from '@/features/selling/money'
import { paymentLabel, type SalePaymentMethod } from '@/features/selling/sale/paymentMethod'
import { optionOf, unitsFor } from '@/features/selling/sale/saleLine'
import type { RecordedSale } from '@/features/selling/sale/useSaleBasket'
import type { SaleDetail } from '@/features/selling/sales/types'

/**
 * A sale's receipt, whichever way it is shown, printed or shared (selling till Steps 1-2): built from a
 * sale just recorded on this phone, or from one read back from the server (the Sales page, My sales today).
 */
export interface ReceiptData {
  saleId: string
  business: string
  branch?: string
  number: string
  when: string
  /** `side`: a side on a table's bill, printed under its meal (V99). */
  rows: { key: string; label: string; amount: number | null; side?: boolean }[]
  /** A table's bill: "Table 5", "VIP", or the name it was opened for. */
  billFor?: string
  total: number
  paymentMethod?: SalePaymentMethod | null
  /** Still on this phone, not yet on the server. */
  queued?: boolean
  /** The whole sale was cancelled. */
  cancelled?: boolean
}

/** The receipt's number: the last six of the sale id, as on a carbon-copy book. */
export function receiptNumber(saleId: string): string {
  return saleId.replace(/-/g, '').slice(-6).toUpperCase()
}

function whenText(at: number | string): string {
  return new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function receiptFromRecorded(sale: RecordedSale, catalogue: UnitOfMeasureOption[], business: string, branch?: string): ReceiptData {
  return {
    saleId: sale.saleId,
    business,
    branch,
    number: receiptNumber(sale.saleId),
    when: whenText(sale.recordedAt),
    rows: sale.lines
      .filter((line) => line.status !== 'refused')
      .map((recorded) => {
        const option = optionOf(recorded.line, unitsFor(recorded.line.product, catalogue))
        const unit = option.isStockUnit ? '' : ` ${option.label.toLowerCase()}`
        return {
          key: recorded.line.key,
          label: `${recorded.line.product.name} × ${formatNumber(recorded.line.quantity)}${unit}`,
          amount: recorded.amount,
        }
      }),
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    queued: sale.lines.some((line) => line.status === 'queued'),
  }
}

export function receiptFromDetail(sale: SaleDetail, business: string): ReceiptData {
  const live = sale.lines.filter((line) => !line.cancelled)
  const shown = live.length > 0 ? live : sale.lines
  // A table's bill (V99): each side right under the meal it goes with.
  const sidesOf = new Map<string, typeof shown>()
  for (const line of shown) {
    if (line.withLineId && shown.some((meal) => meal.movementId === line.withLineId)) {
      sidesOf.set(line.withLineId, [...(sidesOf.get(line.withLineId) ?? []), line])
    }
  }
  const ordered = shown
    .filter((line) => !(line.withLineId && shown.some((meal) => meal.movementId === line.withLineId)))
    .flatMap((line) => [line, ...(sidesOf.get(line.movementId) ?? [])])
  return {
    saleId: sale.saleId,
    business,
    branch: sale.branchName,
    billFor: sale.billFor,
    number: receiptNumber(sale.saleId),
    when: whenText(sale.occurredAt),
    rows: ordered.map((line) => {
      const quantity = line.enteredQuantity ?? line.quantity
      const unit = line.enteredUnit && line.enteredUnit !== line.unitOfMeasure ? ` ${line.enteredUnit.toLowerCase()}` : ''
      const side = line.withLineId != null && sidesOf.get(line.withLineId)?.includes(line) === true
      return {
        key: line.movementId,
        label: `${side ? '+ ' : ''}${line.productName} × ${formatNumber(quantity)}${unit}`,
        amount: line.saleAmount ?? null,
        side,
      }
    }),
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    cancelled: sale.cancelState === 'CANCELLED' || (sale.lineCount > 0 && sale.cancelledLineCount === sale.lineCount),
  }
}

/** The receipt as plain text - for WhatsApp, SMS or email; reads well on any phone, needs no link. */
export function receiptText(receipt: ReceiptData): string {
  return [
    receipt.business,
    ...(receipt.branch ? [receipt.branch] : []),
    ...(receipt.billFor ? [receipt.billFor] : []),
    `Receipt No. ${receipt.number}`,
    receipt.when,
    '',
    ...receipt.rows.map((row) => `${row.label} — ${row.amount != null ? formatMoney(row.amount) : 'no price'}`),
    '',
    `Total: ${formatMoney(receipt.total)}`,
    ...(receipt.paymentMethod ? [`Paid by: ${paymentLabel(receipt.paymentMethod)}`] : []),
    ...(receipt.cancelled ? ['', 'CANCELLED'] : []),
    '',
    'Thank you!',
  ].join('\n')
}

/**
 * Share (owner, 2026-11-16): the phone's own list - WhatsApp, SMS, email, anything - so the customer gets it
 * their way. Where the browser can't share (most laptops), the receipt is copied to paste into a chat.
 */
export async function shareReceipt(receipt: ReceiptData): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = receiptText(receipt)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `${receipt.business} receipt ${receipt.number}`, text })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
