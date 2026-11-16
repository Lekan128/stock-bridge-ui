import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { useToast } from '@/components/useToast'
import { useCatalogState } from '@/features/catalog/useCatalog'
import { StockReceipt } from '@/features/products/components/StockReceipt'
import { useProduct } from '@/features/products/hooks/useProduct'
import { formatMoney } from '@/features/selling/money'
import { PaymentButtons, PaymentChip } from '@/features/selling/sale/payment'
import { paymentLabel, type SalePaymentMethod } from '@/features/selling/sale/paymentMethod'
import { SaleBasketEditor } from '@/features/selling/sale/SaleBasketEditor'
import { quantityText } from '@/features/selling/sale/saleLine'
import { undoSale, useSaleBasket, type RecordedSale } from '@/features/selling/sale/useSaleBasket'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

/** How long Undo sale is offered: the server allows two minutes (D8); the button goes a little sooner. */
const UNDO_FOR_MS = 110_000

/**
 * Record a sale (`SELLING_PRICE_PLAN.md` §6.1): one screen for one item or twenty, shaped like a
 * till slip. Scan or search to add; scanning the same item again adds one; each line is one row
 * ("2 bags × ₦5,000 … ₦10,000") until tapped, when it opens for quantity, unit and price - price
 * each or the whole line's total. One button records it all, online or offline.
 *
 * Nothing about cost or profit is on this screen, ever: the customer can see it (plan principle 11).
 * A price below the usual one is shown quietly as "(usual ₦2,000)" - information, not a warning.
 */
export function RecordSalePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { recordsSales, loaded } = useSellingPolicy()
  const { showToast } = useToast()
  const online = useOnlineStatus()
  const catalog = useCatalogState()
  const basket = useSaleBasket()
  const [recorded, setRecorded] = useState<RecordedSale | null>(null)
  const [recordedAt, setRecordedAt] = useState(0)
  const [undoing, setUndoing] = useState(false)

  // Opened from a product's Sell button: that product is the first line.
  const { product: startProduct } = useProduct(params.get('product') ?? undefined)

  // Undo sale goes when its time is up - re-render then, so the button does not linger.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!recorded) return
    const timer = window.setTimeout(() => setTick((n) => n + 1), Math.max(0, UNDO_FOR_MS - (Date.now() - recordedAt)))
    return () => window.clearTimeout(timer)
  }, [recorded, recordedAt])

  async function undo() {
    if (!recorded) return
    setUndoing(true)
    const problems = await undoSale(recorded)
    setUndoing(false)
    if (problems.length === 0) {
      showToast('Sale undone. Nothing of it is recorded.', 'success')
      setRecorded(null)
    } else {
      showToast(`Some of it couldn't be undone. ${problems.join(' ')}`, 'error')
    }
  }

  if (!loaded) return null
  if (!recordsSales) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 py-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Record a sale</h1>
        <p className="text-sm text-neutral-600">Selling isn't on for your company, so sales aren't recorded here yet.</p>
        <Link to="/app/company" className="text-sm font-medium text-primary-600 hover:underline">
          Selling settings
        </Link>
      </div>
    )
  }

  if (recorded) {
    return (
      <SaleReceipt
        sale={recorded}
        canUndo={Date.now() - recordedAt < UNDO_FOR_MS}
        undoing={undoing}
        onUndo={() => void undo()}
        onPaymentChanged={(paymentMethod) => setRecorded({ ...recorded, paymentMethod })}
        onNext={() => setRecorded(null)}
        leftInBasket={basket.lines.length}
        catalogue={basket.catalogue}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-2xl font-semibold text-neutral-900">Record a sale</h1>
      </div>
      {!online && catalog.syncedAt != null && (
        <p className="text-xs text-neutral-500">
          Offline · prices as of {new Date(catalog.syncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
      <SaleBasketEditor
        basket={basket}
        startProduct={startProduct}
        onRecorded={(sale) => {
          setRecorded(sale)
          setRecordedAt(Date.now())
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------------- receipt

function SaleReceipt({
  sale,
  canUndo,
  undoing,
  onUndo,
  onPaymentChanged,
  onNext,
  leftInBasket,
  catalogue,
}: {
  sale: RecordedSale
  canUndo: boolean
  undoing: boolean
  onUndo: () => void
  onPaymentChanged: (method: SalePaymentMethod) => void
  onNext: () => void
  leftInBasket: number
  catalogue: ReturnType<typeof useSaleBasket>['catalogue']
}) {
  const { client } = useAuth()
  const { showToast } = useToast()
  const [changing, setChanging] = useState(false)
  const [changingTo, setChangingTo] = useState<SalePaymentMethod | null>(null)
  const kept = sale.lines.filter((line) => line.status !== 'refused')
  const refused = sale.lines.filter((line) => line.status === 'refused')
  const state = kept.every((line) => line.status === 'sent') ? 'synced' : 'recorded'
  const seen = new Map<string, number>()
  const rows = kept.map((line) => {
    const n = (seen.get(line.line.product.name) ?? 0) + 1
    seen.set(line.line.product.name, n)
    return {
      label: n === 1 ? line.line.product.name : `${line.line.product.name} (${n})`,
      value: `${quantityText(line.line, catalogue)} · ${line.amount != null ? formatMoney(line.amount) : 'no price'}`,
    }
  })
  async function changePayment(method: SalePaymentMethod) {
    setChangingTo(method)
    try {
      await api.put(`/api/sales/${sale.saleId}/payment`, { paymentMethod: method })
      onPaymentChanged(method)
      setChanging(false)
      showToast(`Changed to ${paymentLabel(method)}.`, 'success')
    } catch (err) {
      showToast(isAppError(err) ? err.message : "Couldn't change how they paid. Try again.", 'error')
    } finally {
      setChangingTo(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      {/* The page's name for screen readers; the receipt itself says SALE, stamped. */}
      <h1 className="sr-only">{kept.length > 0 ? 'Sale recorded' : 'Sale not recorded'}</h1>
      {kept.length > 0 && (
        <StockReceipt
          state={state}
          kind={client?.name ? `${client.name} · Sale` : 'Sale'}
          id={sale.saleId}
          lines={[
            { label: 'Time', value: new Date(sale.recordedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) },
            ...rows,
            { label: 'Total', value: formatMoney(sale.total) },
            { label: 'Paid by', value: <PaymentChip method={sale.paymentMethod} /> },
          ]}
        />
      )}
      {kept.length > 0 && sale.paymentMethod === 'CASH' && <ChangeHelper total={sale.total} />}
      {changing && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-neutral-900">How did they pay?</p>
          <PaymentButtons label="How they paid" current={sale.paymentMethod} busy={changingTo} onPick={(method) => void changePayment(method)} />
          <button type="button" onClick={() => setChanging(false)} className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary-600 hover:underline">
            Keep {paymentLabel(sale.paymentMethod)}
          </button>
        </div>
      )}
      {refused.length > 0 && (
        <div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900">
          {refused.map((line) => (
            <p key={line.line.key}>
              {line.line.product.name} was not recorded: {line.message}
            </p>
          ))}
          <p className="mt-1">
            {refused.length === 1 ? "It's" : "They're"} still in the basket, so you can change the amount and record it.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="action" onClick={onNext} className="min-h-12 px-5 text-base">
          {leftInBasket > 0 ? 'Back to the basket' : 'New sale'}
        </Button>
        {/* Only once the server has it: a sale still on this phone has nothing there to change yet. */}
        {canUndo && kept.length > 0 && state === 'synced' && !changing && (
          <Button variant="secondary" onClick={() => setChanging(true)}>
            Change how they paid
          </Button>
        )}
        {canUndo && kept.length > 0 && (
          <Button variant="secondary" onClick={onUndo} loading={undoing}>
            Undo sale
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * "They gave" - only when the customer handed over more cash than the total. A helper for the change,
 * never stored: the drawer holds the total whatever note came in (owner, 2026-11-13).
 */
function ChangeHelper({ total }: { total: number }) {
  const [given, setGiven] = useState('')
  const amount = Number(given.replace(/[^0-9.]/g, ''))
  const typed = given.trim() !== '' && Number.isFinite(amount) && amount > 0
  const change = typed ? amount - total : 0
  return (
    <div className="flex flex-col gap-2">
      <TextField
        id="sale-cash-given"
        label="They gave (₦), to work out change"
        inputMode="decimal"
        value={given}
        onChange={(event) => setGiven(event.target.value)}
      />
      {typed && (
        <div
          aria-live="polite"
          className={`flex flex-col rounded-xl px-4 py-3 ${change >= 0 ? 'bg-accent-50 text-accent-700' : 'bg-warning-50 text-warning-800'}`}
        >
          <span className="text-xs font-semibold tracking-wider uppercase">{change >= 0 ? 'Change' : 'Still to pay'}</span>
          <span className="text-4xl font-bold tabular-nums">{formatMoney(Math.abs(change))}</span>
        </div>
      )}
    </div>
  )
}
