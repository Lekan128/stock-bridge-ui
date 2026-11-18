import { TransferAccountChooser } from '@/features/selling/sale/TransferAccounts'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { api } from '@/api/client'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/Button'
import { useToast } from '@/components/useToast'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useCatalogState } from '@/features/catalog/useCatalog'
import { useProduct } from '@/features/products/hooks/useProduct'
import { formatMoney } from '@/features/selling/money'
import { CancelSalePanel } from '@/features/selling/sale/CancelSale'
import { CANCEL_ALONE_FOR_MS } from '@/features/selling/sale/cancelReasons'
import { PaymentButtons } from '@/features/selling/sale/payment'
import { paymentLabel, type SalePaymentMethod } from '@/features/selling/sale/paymentMethod'
import { receiptFromRecorded } from '@/features/selling/sale/receipt'
import { ReceiptActions } from '@/features/selling/sale/ReceiptActions'
import { SaleReceiptCard } from '@/features/selling/sale/SaleReceipt'
import { SaleBasketEditor } from '@/features/selling/sale/SaleBasketEditor'
import { useSaleBasket, type RecordedSale } from '@/features/selling/sale/useSaleBasket'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

/**
 * Record a sale (`SELLING_PRICE_PLAN.md` §6.1; selling till Steps 1-3). Tap a product, scan or search to add;
 * one tap on how they paid records it, and the receipt shows - Print, Share, Next sale. Cancelling is never
 * erasing: in the first two minutes the cashier cancels with a reason (the items come back to fix), after
 * that they ask a manager.
 *
 * Nothing about cost or profit is on this screen, ever: the customer can see it (plan principle 11).
 */
export function RecordSalePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { recordsSales, loaded } = useSellingPolicy()
  const online = useOnlineStatus()
  const catalog = useCatalogState()
  const basket = useSaleBasket()
  const [last, setLast] = useState<RecordedSale | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)

  // Opened from a product's Sell button: that product is the first line.
  const { product: startProduct } = useProduct(params.get('product') ?? undefined)

  // "Change how they paid" and cancelling alone go when their time is up - re-render then.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!last) return
    const timer = window.setTimeout(() => setTick((n) => n + 1), Math.max(0, CANCEL_ALONE_FOR_MS - (Date.now() - last.recordedAt)))
    return () => window.clearTimeout(timer)
  }, [last])

  const kept = last ? last.lines.filter((line) => line.status !== 'refused') : []
  const refused = last ? last.lines.filter((line) => line.status === 'refused') : []

  /** Paid: the receipt, ready to print - most cashiers print (owner, 2026-11-16). All refused: stay on the basket. */
  function recorded(sale: RecordedSale) {
    setLast(sale)
    setShowReceipt(sale.lines.some((line) => line.status !== 'refused'))
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

  // The cashier's own sales today: reprint, share or cancel one (selling till Step 3).
  const mySales = (
    <Link to="/app/sell/today" className="inline-flex min-h-11 items-center text-sm font-semibold whitespace-nowrap text-primary-700 hover:underline">
      My sales today
    </Link>
  )

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
    // The receipt scrolls on its own: the till's window doesn't (owner, 2026-11-18: it couldn't scroll on a laptop).
    <div
      className={`mx-auto flex w-full flex-col gap-4 ${
        showReceipt ? 'max-w-2xl lg:h-full lg:max-w-5xl lg:overflow-y-auto lg:p-6' : 'max-w-2xl lg:h-full lg:max-w-none lg:gap-0'
      }`}
    >
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
        {!showReceipt && <span className="ml-auto">{mySales}</span>}
      </div>

      {showReceipt && last ? (
        <ReceiptView
          sale={last}
          catalogue={basket.catalogue}
          onNext={() => setShowReceipt(false)}
          onPaymentChanged={(paymentMethod) => setLast({ ...last, paymentMethod })}
          onCancelled={() => {
            // Cancelled in its first two minutes: its items come back to fix and take again.
            basket.restoreSale(last)
            setLast(null)
            setShowReceipt(false)
          }}
          online={online}
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
            topRight={mySales}
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
  onNext,
  onPaymentChanged,
  onCancelled,
  online,
}: {
  sale: RecordedSale
  catalogue: ReturnType<typeof useSaleBasket>['catalogue']
  onNext: () => void
  onPaymentChanged: (method: SalePaymentMethod) => void
  onCancelled: () => void
  online: boolean
}) {
  const { showToast } = useToast()
  const { user, client } = useAuth()
  const branch = useOptionalWorkingBranch()
  const [changing, setChanging] = useState(false)
  const [changingTo, setChangingTo] = useState<SalePaymentMethod | null>(null)
  const [asked, setAsked] = useState(false)

  const kept = sale.lines.filter((line) => line.status !== 'refused')
  const sent = kept.every((line) => line.status === 'sent')
  const fresh = Date.now() - sale.recordedAt < CANCEL_ALONE_FOR_MS
  const canCancelSales = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.CANCEL_SALES)
  const receipt = receiptFromRecorded(
    sale,
    catalogue,
    client?.name ?? 'Sale',
    branch?.isMultiBranch ? branch.nameOf(branch.working?.id) : undefined,
  )

  // Step 12: changed to a transfer, it names its account like a new sale does.
  const branchHere = useOptionalWorkingBranch()
  const saleBranch = branchHere && !branchHere.isAll ? (branchHere.working ?? branchHere.branches[0] ?? null) : null
  const accounts = saleBranch?.paymentAccounts ?? []
  const [choosingAccount, setChoosingAccount] = useState(false)

  async function changePayment(method: SalePaymentMethod, accountId?: string) {
    if (method === 'TRANSFER' && accountId === undefined && accounts.length > 0) {
      if (accounts.length === 1) return changePayment('TRANSFER', accounts[0].id)
      setChoosingAccount(true)
      return
    }
    setChoosingAccount(false)
    setChangingTo(method)
    try {
      await api.put(`/api/sales/${sale.saleId}/payment`, { paymentMethod: method, ...(accountId ? { paymentAccountId: accountId } : {}) })
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
    // A laptop: the receipt on the left, what to do with it on the right - not a phone's column in the middle.
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-4">
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
      <SaleReceiptCard receipt={receipt} />
      </div>
      <div className="flex flex-col gap-4">
      {changing ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-neutral-900">How did they pay?</p>
          {choosingAccount && saleBranch ? (
            <TransferAccountChooser
              branchId={saleBranch.id}
              accounts={accounts}
              amount={sale.total}
              busy={changingTo === 'TRANSFER'}
              onPick={(account) => void changePayment('TRANSFER', account.id)}
              onBack={() => setChoosingAccount(false)}
            />
          ) : (
            <PaymentButtons label="How they paid" current={sale.paymentMethod} busy={changingTo} onPick={(method) => void changePayment(method)} />
          )}
          <button type="button" onClick={() => setChanging(false)} className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary-600 hover:underline">
            Keep {paymentLabel(sale.paymentMethod)}
          </button>
        </div>
      ) : (
        <>
          <ReceiptActions receipt={receipt} />
          <Button variant="secondary" onClick={onNext} className="min-h-12 text-base">
            Next sale
          </Button>
          {asked ? (
            <p role="status" className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm font-medium text-warning-900">
              Asked to cancel. Waiting for a manager.
            </p>
          ) : (
            <div className="flex flex-wrap items-start justify-center gap-x-6 lg:justify-start">
              {fresh && sent && (
                <button type="button" onClick={() => setChanging(true)} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-700 hover:underline">
                  Change how they paid
                </button>
              )}
              <CancelSalePanel
                saleId={sale.saleId}
                canCancelNow={canCancelSales || fresh}
                canAsk
                blocked={!sent || !online ? 'This sale is still on this phone. Cancel it when you are back online.' : null}
                onDone={(_, kind) => {
                  if (kind === 'requested') {
                    setAsked(true)
                    showToast('Asked. A manager will see it.', 'success')
                  } else {
                    showToast('Sale cancelled. The items are back.', 'success')
                    onCancelled()
                  }
                }}
              />
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
