import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { useCatalogState } from '@/features/catalog/useCatalog'
import { StockReceipt } from '@/features/products/components/StockReceipt'
import { useProduct } from '@/features/products/hooks/useProduct'
import { formatMoney } from '@/features/selling/money'
import { SaleBasketEditor } from '@/features/selling/sale/SaleBasketEditor'
import { quantityText } from '@/features/selling/sale/saleLine'
import { undoSale, useSaleBasket, type RecordedSale } from '@/features/selling/sale/useSaleBasket'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

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
  onNext,
  leftInBasket,
  catalogue,
}: {
  sale: RecordedSale
  canUndo: boolean
  undoing: boolean
  onUndo: () => void
  onNext: () => void
  leftInBasket: number
  catalogue: ReturnType<typeof useSaleBasket>['catalogue']
}) {
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
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      {/* The page's name for screen readers; the receipt itself says SALE, stamped. */}
      <h1 className="sr-only">{kept.length > 0 ? 'Sale recorded' : 'Sale not recorded'}</h1>
      {kept.length > 0 && (
        <StockReceipt state={state} kind="Sale" id={sale.saleId} lines={[...rows, { label: 'Total', value: formatMoney(sale.total) }]} />
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
        {canUndo && kept.length > 0 && (
          <Button variant="secondary" onClick={onUndo} loading={undoing}>
            Undo sale
          </Button>
        )}
      </div>
    </div>
  )
}
