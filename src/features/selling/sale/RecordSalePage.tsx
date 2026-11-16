import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Printer } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { useCatalogState } from '@/features/catalog/useCatalog'
import { useProduct } from '@/features/products/hooks/useProduct'
import { formatMoney } from '@/features/selling/money'
import { PaymentButtons } from '@/features/selling/sale/payment'
import { paymentLabel, type SalePaymentMethod } from '@/features/selling/sale/paymentMethod'
import { printReceipt } from '@/features/selling/sale/printReceipt'
import { PrintableReceipt, SaleReceiptCard } from '@/features/selling/sale/SaleReceipt'
import { SaleBasketEditor } from '@/features/selling/sale/SaleBasketEditor'
import { undoSale, useSaleBasket, type RecordedSale } from '@/features/selling/sale/useSaleBasket'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

/** How long Undo and "Change how they paid" are offered: the server allows two minutes (D8); a little sooner here. */
const UNDO_FOR_MS = 110_000

/**
 * Record a sale (`SELLING_PRICE_PLAN.md` §6.1; selling till Step 1 and its fixes). Tap a picture, scan or
 * search to add; one tap on how they paid records it, and the screen is straight away ready for the next
 * customer. A green line says what was just paid, with its Receipt (to read, print, or change how it was
 * paid) and Undo - which puts the items back in the basket.
 *
 * Nothing about cost or profit is on this screen, ever: the customer can see it (plan principle 11).
 */
export function RecordSalePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { recordsSales, loaded } = useSellingPolicy()
  const { showToast } = useToast()
  const online = useOnlineStatus()
  const catalog = useCatalogState()
  const basket = useSaleBasket()
  const [last, setLast] = useState<RecordedSale | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [undoing, setUndoing] = useState(false)

  // Opened from a product's Sell button: that product is the first line.
  const { product: startProduct } = useProduct(params.get('product') ?? undefined)

  // Undo goes when its time is up - re-render then, so the button does not linger.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!last) return
    const timer = window.setTimeout(() => setTick((n) => n + 1), Math.max(0, UNDO_FOR_MS - (Date.now() - last.recordedAt)))
    return () => window.clearTimeout(timer)
  }, [last])

  const kept = last ? last.lines.filter((line) => line.status !== 'refused') : []
  const refused = last ? last.lines.filter((line) => line.status === 'refused') : []
  const canUndo = last != null && kept.length > 0 && Date.now() - last.recordedAt < UNDO_FOR_MS

  /** Paid: the receipt, ready to print - most cashiers print (owner, 2026-11-16). All refused: stay on the basket. */
  function recorded(sale: RecordedSale) {
    setLast(sale)
    setShowReceipt(sale.lines.some((line) => line.status !== 'refused'))
  }

  async function undo() {
    if (!last) return
    setUndoing(true)
    const problems = await undoSale(last)
    setUndoing(false)
    if (problems.length === 0) {
      basket.restoreSale(last)
      setLast(null)
      setShowReceipt(false)
      showToast('Sale undone. The items are back.', 'success')
    } else {
      showToast(`Some of it couldn't be undone. ${problems.join(' ')}`, 'error')
    }
  }

  function goBack() {
    if (showReceipt) {
      setShowReceipt(false)
      return
    }
    // Opened straight (a bookmark, the home-screen app, a reload): there is no page behind it to go back to.
    if (location.key !== 'default') navigate(-1)
    else navigate('/app/products')
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

  return (
    // A till on a wide screen: the whole window, its own top bar (AppLayout drops the page padding here).
    <div className={`mx-auto flex w-full flex-col gap-4 ${showReceipt ? 'max-w-2xl lg:p-6' : 'max-w-2xl lg:h-full lg:max-w-none lg:gap-0'}`}>
      <div className={`flex items-center gap-2 ${showReceipt ? '' : 'lg:hidden'}`}>
        <button
          type="button"
          onClick={goBack}
          aria-label={showReceipt ? 'Back to the sale' : 'Back'}
          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-2xl font-semibold text-neutral-900">{showReceipt ? 'Receipt' : 'Record a sale'}</h1>
      </div>

      {showReceipt && last ? (
        <ReceiptView
          sale={last}
          catalogue={basket.catalogue}
          canChange={canUndo && kept.every((line) => line.status === 'sent')}
          canUndo={canUndo}
          undoing={undoing}
          onUndo={() => void undo()}
          onNext={() => setShowReceipt(false)}
          onPaymentChanged={(paymentMethod) => setLast({ ...last, paymentMethod })}
        />
      ) : (
        <>
          {!online && catalog.syncedAt != null && (
            <p className="text-xs text-neutral-500 lg:hidden">
              Offline · prices as of {new Date(catalog.syncedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
          <SaleBasketEditor
            wide
            onBack={goBack}
            basket={basket}
            startProduct={startProduct}
            onRecorded={recorded}
            banner={
              last && (
                <div className="flex flex-col gap-2">
                  {kept.length > 0 && (
                    <div role="status" className="flex items-center gap-2 rounded-lg bg-accent-50 px-3 py-1 text-accent-800" data-sale-paid>
                      <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 font-semibold tabular-nums">
                        {formatMoney(last.total)} · {paymentLabel(last.paymentMethod)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowReceipt(true)}
                        className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary-700 hover:underline"
                      >
                        Receipt
                      </button>
                      {canUndo && (
                        <button
                          type="button"
                          onClick={() => void undo()}
                          disabled={undoing}
                          className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary-700 hover:underline disabled:opacity-50"
                        >
                          {undoing ? 'Undoing…' : 'Undo'}
                        </button>
                      )}
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
                </div>
              )
            }
          />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------- receipt

function ReceiptView({
  sale,
  catalogue,
  canChange,
  canUndo,
  undoing,
  onUndo,
  onNext,
  onPaymentChanged,
}: {
  sale: RecordedSale
  catalogue: ReturnType<typeof useSaleBasket>['catalogue']
  /** Within the two minutes, and the server has the whole sale. */
  canChange: boolean
  canUndo: boolean
  undoing: boolean
  onUndo: () => void
  onNext: () => void
  onPaymentChanged: (method: SalePaymentMethod) => void
}) {
  const { showToast } = useToast()
  const [changing, setChanging] = useState(false)
  const [changingTo, setChangingTo] = useState<SalePaymentMethod | null>(null)

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
      {sale.lines.some((line) => line.status === 'refused') && (
        <div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900">
          {sale.lines
            .filter((line) => line.status === 'refused')
            .map((line) => (
              <p key={line.line.key}>
                {line.line.product.name} was not recorded: {line.message}
              </p>
            ))}
          <p className="mt-1">It's still in the sale. Tap Next sale to change it and take it.</p>
        </div>
      )}
      <SaleReceiptCard sale={sale} catalogue={catalogue} />
      <PrintableReceipt sale={sale} catalogue={catalogue} />
      {changing ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-neutral-900">How did they pay?</p>
          <PaymentButtons label="How they paid" current={sale.paymentMethod} busy={changingTo} onPick={(method) => void changePayment(method)} />
          <button type="button" onClick={() => setChanging(false)} className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary-600 hover:underline">
            Keep {paymentLabel(sale.paymentMethod)}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="action" onClick={printReceipt} className="min-h-12 text-base">
              <Printer className="h-5 w-5" aria-hidden="true" />
              Print
            </Button>
            <Button variant="secondary" onClick={onNext} className="min-h-12 text-base">
              Next sale
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6">
            {canChange && (
              <button type="button" onClick={() => setChanging(true)} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-700 hover:underline">
                Change how they paid
              </button>
            )}
            {canUndo && (
              <button type="button" onClick={onUndo} disabled={undoing} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-700 hover:underline disabled:opacity-50">
                {undoing ? 'Undoing…' : 'Undo sale'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
