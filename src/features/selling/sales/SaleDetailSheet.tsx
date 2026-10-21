import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Sheet } from '@/components/Sheet'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { formatNumber, pluraliseUnitNoun, stockUnitWord } from '@/features/products/unitCopy'
import { formatMoney, parseMoneyInput } from '@/features/selling/money'
import { salesReportApi } from '@/features/selling/sales/salesReportApi'
import type { SaleDetail, SaleLineDetail } from '@/features/selling/sales/types'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

/** Undo is the server's for two minutes (D8); offered a little less, so it never fails at the edge. */
const UNDO_FOR_MS = 110_000

export interface SaleDetailSheetProps {
  saleId: string | null
  onClose: () => void
  /** Something about the sale changed - the report behind the sheet reads again. */
  onChanged: () => void
}

/**
 * One sale, line by line (`SELLING_PRICE_PLAN.md` §6.11, §4.3a). The fixes a sale can take, all of
 * which only ever ADD rows: Undo while it is still that fresh; afterwards Cancel the sale or one
 * line, which puts the stock back where it came from; and Add price to a line saved without one.
 * Cancelled lines stay, struck through, with who cancelled them - "sell, keep the cash, cancel" is
 * the leak this screen exists to make visible.
 *
 * Every fix changes a shared record, so each needs a connection, and says so (Pattern C part 5).
 */
export function SaleDetailSheet({ saleId, onClose, onChanged }: SaleDetailSheetProps) {
  const { showToast } = useToast()
  const { user } = useAuth()
  const online = useOnlineStatus()
  const [sale, setSale] = useState<SaleDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<SaleLineDetail | 'all' | null>(null)
  const [pricing, setPricing] = useState<string | null>(null)
  const [priceText, setPriceText] = useState('')

  useEffect(() => {
    if (!saleId) return
    let cancelled = false
    setSale(null)
    setError(null)
    salesReportApi
      .sale(saleId)
      .then((answer) => !cancelled && setSale(answer))
      .catch((err: unknown) => !cancelled && setError(isAppError(err) ? err.message : "Couldn't load this sale."))
    return () => {
      cancelled = true
    }
  }, [saleId])

  async function run(key: string, action: () => Promise<SaleDetail | null>, done: string) {
    setBusy(key)
    setError(null)
    try {
      const next = await action()
      if (next) setSale(next)
      showToast(done, 'success')
      onChanged()
      return true
    } catch (err) {
      setError(isAppError(err) ? err.message : "Couldn't do that. Try again.")
      return false
    } finally {
      setBusy(null)
    }
  }

  const live = sale ? sale.lines.filter((line) => !line.cancelled) : []
  // Undo is the recorder's own, while fresh (the server's rule): anyone else - an owner checking a
  // cashier's sale - goes straight to Cancel, which is recorded with their name.
  const canUndo =
    sale != null &&
    live.length > 0 &&
    user?.type === 'tenant' &&
    sale.recordedByUserId === user.id &&
    Date.now() - new Date(sale.occurredAt).getTime() < UNDO_FOR_MS
  const when = sale
    ? new Date(sale.occurredAt).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })
    : ''

  return (
    <>
      <Sheet
        open={saleId != null}
        onClose={onClose}
        size="md"
        title="Sale"
        footer={
          sale && live.length > 0 ? (
            <>
              {/* One way to take a sale back at a time: Undo while it is fresh (as if it never
                  happened), Cancel after that (recorded, with who). Side by side they read as the
                  same button. */}
              {canUndo && (
                <Button
                  variant="secondary"
                  disabled={!online || busy != null}
                  loading={busy === 'undo'}
                  onClick={() =>
                    void run(
                      'undo',
                      async () => {
                        const answer = await salesReportApi.undo(sale.saleId)
                        const refused = answer.lines.filter((line) => !line.undone)
                        if (refused.length) throw new Error(refused.map((line) => `${line.productName}: ${line.reason}`).join(' '))
                        onClose()
                        return null
                      },
                      'Sale undone. Nothing of it is recorded.',
                    )
                  }
                >
                  Undo sale
                </Button>
              )}
              {/* Quiet, not a red slab: this sheet is mostly for reading a sale, and the confirm that
                  follows is where the weight belongs. */}
              {!canUndo && (
                <Button
                  variant="secondary"
                  disabled={!online || busy != null}
                  onClick={() => setConfirmCancel('all')}
                  className="text-danger-700! hover:text-danger-800!"
                >
                  Cancel sale
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {!sale && !error && <p className="text-sm text-neutral-500">Loading…</p>}
        {sale && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-600">
              {when}
              {sale.recordedByName && ` · recorded by ${sale.recordedByName}`}
            </p>
            <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {sale.lines.map((line) => (
                <li key={line.movementId} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`min-w-0 ${line.cancelled ? 'text-neutral-500 line-through' : ''}`}>
                      <span className="block text-sm font-medium text-neutral-900">{line.productName}</span>
                      <span className="block text-sm text-neutral-600 tabular-nums">{lineText(line)}</span>
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${line.cancelled ? 'text-neutral-500 line-through' : 'text-neutral-900'}`}>
                      {line.saleAmount != null ? formatMoney(line.saleAmount) : 'No price'}
                    </span>
                  </div>
                  {line.cancelled && (
                    <p className="text-xs text-neutral-600">
                      Cancelled{line.cancelledByName ? ` by ${line.cancelledByName}` : ''}
                      {line.cancelledAt &&
                        `, ${new Date(line.cancelledAt).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}`}
                    </p>
                  )}
                  {line.priceAdded && !line.cancelled && <p className="text-xs text-neutral-500">Price added later</p>}
                  {!line.cancelled && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {line.saleAmount == null && pricing !== line.movementId && (
                        <button
                          type="button"
                          disabled={!online}
                          onClick={() => {
                            setPricing(line.movementId)
                            setPriceText('')
                          }}
                          className="-my-2 inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary-700 hover:underline disabled:opacity-50"
                        >
                          Add price
                        </button>
                      )}
                      {live.length > 1 && !canUndo && (
                        <button
                          type="button"
                          disabled={!online || busy != null}
                          onClick={() => setConfirmCancel(line)}
                          className="-my-2 inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-danger-700 hover:underline disabled:opacity-50"
                        >
                          Cancel this line
                        </button>
                      )}
                    </div>
                  )}
                  {pricing === line.movementId && (
                    <form
                      className="flex items-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const amount = parseMoneyInput(priceText)
                        if (amount == null) {
                          setError('Type what the whole line went for.')
                          return
                        }
                        void run('price', () => salesReportApi.addPrice(line.movementId, { lineTotal: amount }), 'Price added.').then(
                          (ok) => ok && setPricing(null),
                        )
                      }}
                    >
                      <TextField
                        id={`sale-line-price-${line.movementId}`}
                        label="What it went for (₦, the whole line)"
                        inputMode="decimal"
                        value={priceText}
                        onChange={(event) => setPriceText(event.target.value)}
                      />
                      <Button type="submit" loading={busy === 'price'}>
                        Save
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between border-t border-neutral-200 pt-3">
              <span className="text-sm font-medium text-neutral-700">Total</span>
              <span className="text-lg font-semibold tabular-nums text-neutral-900">{formatMoney(sale.total)}</span>
            </div>
            {!online && <p className="text-xs text-neutral-500">Changing a sale needs a connection.</p>}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger-700">
            {error}
          </p>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmCancel != null}
        title={confirmCancel === 'all' ? 'Cancel this sale?' : 'Cancel this line?'}
        message={
          confirmCancel === 'all'
            ? `The stock goes back on the shelf and ${formatMoney(live.reduce((sum, line) => sum + (line.saleAmount ?? 0), 0))} comes off your sales. It is recorded with your name.`
            : confirmCancel
              ? `${confirmCancel.productName} goes back on the shelf and comes off this sale. It is recorded with your name.`
              : ''
        }
        confirmLabel={confirmCancel === 'all' ? 'Cancel sale' : 'Cancel line'}
        confirmVariant="danger"
        loading={busy === 'cancel'}
        onCancel={() => setConfirmCancel(null)}
        onConfirm={() => {
          if (!sale || !confirmCancel) return
          const lineIds = confirmCancel === 'all' ? undefined : [confirmCancel.movementId]
          void run('cancel', () => salesReportApi.cancel(sale.saleId, lineIds), confirmCancel === 'all' ? 'Sale cancelled.' : 'Line cancelled.').then(
            () => setConfirmCancel(null),
          )
        }}
      />
    </>
  )
}

/** "3 cartons × ₦5,000" as typed, else "2 pieces × ₦9,000" in the stock unit. */
function lineText(line: SaleLineDetail): string {
  if (line.enteredQuantity != null && line.enteredUnit) {
    const each = line.enteredUnitPrice != null ? ` × ${formatMoney(line.enteredUnitPrice)}` : ''
    const noun = line.enteredUnit.charAt(0) + line.enteredUnit.slice(1).toLowerCase()
    return `${formatNumber(line.enteredQuantity)} ${pluraliseUnitNoun(noun, line.enteredQuantity).toLowerCase()}${each}`
  }
  const each = line.unitPriceAtTime != null ? ` × ${formatMoney(line.unitPriceAtTime)}` : ''
  const unit = line.unitOfMeasure ? ` ${stockUnitWord(line.unitOfMeasure.toLowerCase(), line.quantity)}` : ''
  return `${formatNumber(line.quantity)}${unit}${each}`
}
