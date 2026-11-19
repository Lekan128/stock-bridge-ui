import { createPortal } from 'react-dom'
import { formatMoney } from '@/features/selling/money'
import { PaymentChip } from '@/features/selling/sale/payment'
import { paymentLabel } from '@/features/selling/sale/paymentMethod'
import { inPrices, onTop, type ReceiptData } from '@/features/selling/sale/receipt'
import { chargeLabel } from '@/features/selling/charges'

/**
 * A sale's receipt as a customer would read it (Step 1 fixes): the business, the number and time, what was
 * bought, the total and how it was paid. No "SYNCED" or "server": a sale still on the phone just says it
 * will send when online.
 */
export function SaleReceiptCard({ receipt }: { receipt: ReceiptData }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-4 tabular-nums"
      data-receipt={receipt.queued ? 'recorded' : 'synced'}
    >
      <p className="text-center text-base font-semibold text-neutral-900">{receipt.business}</p>
      <p className="text-center text-xs text-neutral-500">
        {receipt.branch && `${receipt.branch} · `}
        {receipt.billFor && `${receipt.billFor} · `}No. {receipt.number} · {receipt.when}
      </p>
      <dl className={`mt-1 flex flex-col border-y border-dashed border-neutral-300 py-2 ${receipt.cancelled ? 'text-neutral-500 line-through' : ''}`}>
        {receipt.rows.map((row) => (
          <div key={row.key} className={`flex justify-between gap-3 py-0.5 text-sm ${row.side ? 'pl-4' : ''}`}>
            <dt className={`min-w-0 ${row.side ? 'text-neutral-600' : 'text-neutral-800'}`}>{row.label}</dt>
            <dd className="shrink-0 text-neutral-900">{row.amount != null ? formatMoney(row.amount) : 'No price'}</dd>
          </div>
        ))}
      </dl>
      {/* Charges and taxes added on top (V100): the food and drinks, then each, then the total paid. */}
      {onTop(receipt).length > 0 && (
        <dl className="flex flex-col text-sm">
          <div className="flex justify-between gap-3 py-0.5">
            <dt className="text-neutral-600">Food and drinks</dt>
            <dd className="text-neutral-900">{formatMoney(receipt.total)}</dd>
          </div>
          {onTop(receipt).map((charge) => (
            <div key={charge.name} className="flex justify-between gap-3 py-0.5">
              <dt className="text-neutral-600">{chargeLabel(charge)}</dt>
              <dd className="text-neutral-900">{formatMoney(charge.amount)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className={`flex justify-between text-base font-semibold text-neutral-900 ${receipt.cancelled ? 'line-through' : ''}`}>
        <span>Total</span>
        <span>{formatMoney(receipt.toPay ?? receipt.total)}</span>
      </div>
      {inPrices(receipt).map((charge) => (
        <div key={charge.name} className="-mt-1 flex justify-between text-xs text-neutral-500">
          <span>Includes {chargeLabel(charge)}</span>
          <span>{formatMoney(charge.amount)}</span>
        </div>
      ))}
      {receipt.parts ? (
        <dl className="flex flex-col gap-1 text-sm text-neutral-700" aria-label="Paid in parts">
          {receipt.parts.map((part, index) => (
            <div key={index} className="flex items-center justify-between">
              <dt>
                <PaymentChip method={part.method} />
              </dt>
              <dd className="tabular-nums">{formatMoney(part.amount)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        receipt.paymentMethod && (
          <div className="flex items-center justify-between text-sm text-neutral-700">
            <span>Paid by</span>
            <PaymentChip method={receipt.paymentMethod} />
          </div>
        )
      )}
      {receipt.cancelled && <p className="text-center text-sm font-semibold tracking-wider text-danger-700 uppercase">Cancelled</p>}
      {receipt.queued && <p className="text-xs text-neutral-500">Saved on this phone. It will send when you are online.</p>}
    </div>
  )
}

/** The same receipt, laid out for a receipt printer - hidden on screen, printed by `printReceipt`. */
export function PrintableReceipt({ receipt }: { receipt: ReceiptData }) {
  return createPortal(
    <div className="sale-print" aria-hidden="true">
      <div style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase' }}>{receipt.business}</div>
      {receipt.branch && <div style={{ textAlign: 'center' }}>{receipt.branch}</div>}
      {receipt.billFor && <div style={{ textAlign: 'center', fontWeight: 700 }}>{receipt.billFor}</div>}
      <div style={{ textAlign: 'center' }}>
        No. {receipt.number} · {receipt.when}
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      {receipt.rows.map((row) => (
        <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingLeft: row.side ? 12 : 0 }}>
          <span>{row.label}</span>
          <span>{row.amount != null ? formatMoney(row.amount) : '-'}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      {onTop(receipt).length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Food and drinks</span>
            <span>{formatMoney(receipt.total)}</span>
          </div>
          {onTop(receipt).map((charge) => (
            <div key={charge.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{chargeLabel(charge)}</span>
              <span>{formatMoney(charge.amount)}</span>
            </div>
          ))}
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>TOTAL</span>
        <span>{formatMoney(receipt.toPay ?? receipt.total)}</span>
      </div>
      {inPrices(receipt).map((charge) => (
        <div key={charge.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Includes {chargeLabel(charge)}</span>
          <span>{formatMoney(charge.amount)}</span>
        </div>
      ))}
      {receipt.parts
        ? receipt.parts.map((part, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{paymentLabel(part.method)}</span>
              <span>{formatMoney(part.amount)}</span>
            </div>
          ))
        : receipt.paymentMethod && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Paid by</span>
              <span>{paymentLabel(receipt.paymentMethod)}</span>
            </div>
          )}
      {receipt.cancelled && <div style={{ textAlign: 'center', fontWeight: 700 }}>CANCELLED</div>}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
      <div style={{ textAlign: 'center' }}>Thank you</div>
    </div>,
    document.body,
  )
}
