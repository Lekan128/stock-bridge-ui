import { createPortal } from 'react-dom'
import { useAuth } from '@/auth/useAuth'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { formatNumber } from '@/features/products/unitCopy'
import { formatMoney } from '@/features/selling/money'
import { PaymentChip } from '@/features/selling/sale/payment'
import { paymentLabel } from '@/features/selling/sale/paymentMethod'
import { optionOf, unitsFor } from '@/features/selling/sale/saleLine'
import type { RecordedSale, useSaleBasket } from '@/features/selling/sale/useSaleBasket'

type Catalogue = ReturnType<typeof useSaleBasket>['catalogue']

/** The receipt's number: the last six of the sale id, as on a carbon-copy book. */
function receiptNumber(saleId: string): string {
  return saleId.replace(/-/g, '').slice(-6).toUpperCase()
}

function rowsOf(sale: RecordedSale, catalogue: Catalogue) {
  return sale.lines
    .filter((line) => line.status !== 'refused')
    .map((recorded) => {
      const option = optionOf(recorded.line, unitsFor(recorded.line.product, catalogue))
      const unit = option.isStockUnit ? '' : ` ${option.label.toLowerCase()}`
      return {
        key: recorded.line.key,
        label: `${recorded.line.product.name} × ${formatNumber(recorded.line.quantity)}${unit}`,
        amount: recorded.amount,
      }
    })
}

function useHeader(sale: RecordedSale) {
  const { client } = useAuth()
  const branch = useOptionalWorkingBranch()
  return {
    business: client?.name ?? 'Sale',
    branch: branch?.isMultiBranch ? branch.nameOf(branch.working?.id) : undefined,
    when: new Date(sale.recordedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
    queued: sale.lines.some((line) => line.status === 'queued'),
  }
}

/**
 * A sale's receipt as a customer would read it (Step 1 fixes): the business, the number and time, what was
 * bought, the total and how it was paid. No "SYNCED" or "server": a sale still on the phone just says it
 * will send when online.
 */
export function SaleReceiptCard({ sale, catalogue }: { sale: RecordedSale; catalogue: Catalogue }) {
  const header = useHeader(sale)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-4 tabular-nums" data-receipt={header.queued ? 'recorded' : 'synced'}>
      <p className="text-center text-base font-semibold text-neutral-900">{header.business}</p>
      <p className="text-center text-xs text-neutral-500">
        {header.branch && `${header.branch} · `}No. {receiptNumber(sale.saleId)} · {header.when}
      </p>
      <dl className="mt-1 flex flex-col border-y border-dashed border-neutral-300 py-2">
        {rowsOf(sale, catalogue).map((row) => (
          <div key={row.key} className="flex justify-between gap-3 py-0.5 text-sm">
            <dt className="min-w-0 text-neutral-800">{row.label}</dt>
            <dd className="shrink-0 text-neutral-900">{row.amount != null ? formatMoney(row.amount) : 'No price'}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-between text-base font-semibold text-neutral-900">
        <span>Total</span>
        <span>{formatMoney(sale.total)}</span>
      </div>
      <div className="flex items-center justify-between text-sm text-neutral-700">
        <span>Paid by</span>
        <PaymentChip method={sale.paymentMethod} />
      </div>
      {header.queued && <p className="text-xs text-neutral-500">Saved on this phone. It will send when you are online.</p>}
    </div>
  )
}

/** The same receipt, laid out for a receipt printer - hidden on screen, printed by {@link printReceipt}. */
export function PrintableReceipt({ sale, catalogue }: { sale: RecordedSale; catalogue: Catalogue }) {
  const header = useHeader(sale)
  return createPortal(
    <div className="sale-print" aria-hidden="true">
      <div style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase' }}>{header.business}</div>
      {header.branch && <div style={{ textAlign: 'center' }}>{header.branch}</div>}
      <div style={{ textAlign: 'center' }}>
        No. {receiptNumber(sale.saleId)} · {header.when}
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      {rowsOf(sale, catalogue).map((row) => (
        <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{row.label}</span>
          <span>{row.amount != null ? formatMoney(row.amount) : '-'}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>TOTAL</span>
        <span>{formatMoney(sale.total)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Paid by</span>
        <span>{paymentLabel(sale.paymentMethod)}</span>
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      <div style={{ textAlign: 'center' }}>Thank you</div>
    </div>,
    document.body,
  )
}
