import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, Clock, CreditCard, HelpCircle, RefreshCw, TriangleAlert, Undo2 } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, buttonClassName } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/useToast'
import { checkoutApi } from '@/features/checkout/api/checkoutApi'
import { usePaymentVerification } from '@/features/checkout/hooks/usePaymentVerification'
import { paymentHandoff } from '@/features/checkout/paymentHandoff'
import type { PaymentProviderStatus } from '@/features/checkout/types'
import { useMarketplaceSettings } from '@/features/storefront/hooks/useMarketplaceSettings'
import { isAppError } from '@/types/api'
import { formatNaira } from '@/utils/money'

/**
 * Monnify's own redirect parameter names, in the order we prefer them. This is the only thing
 * taken from the query string, and it is an *address* — which payment to ask the server about —
 * never an outcome. Contract §9.3: the browser is not trusted for whether money moved.
 */
const REFERENCE_PARAMS = ['paymentReference', 'reference', 'paymentref']

interface Outcome {
  tone: 'success' | 'pending' | 'failed'
  icon: typeof CircleCheck
  title: string
  body: string
}

/**
 * ABANDONED is deliberately not folded into FAILED. "You closed the payment window" and "your
 * bank declined the card" need different next steps, and telling a buyer their card failed when
 * they simply walked away sends them to their bank for no reason.
 */
function describe(status: PaymentProviderStatus, serverMessage?: string): Outcome {
  switch (status) {
    case 'PAID':
      return {
        tone: 'success',
        icon: CircleCheck,
        title: 'Payment received',
        body: serverMessage ?? 'Your payment has been confirmed. Taking you to your order…',
      }
    case 'ABANDONED':
      return {
        tone: 'failed',
        icon: Undo2,
        title: 'Payment was not completed',
        body:
          serverMessage ??
          'The payment window was closed before the transaction finished, so nothing has been charged. Your order is still waiting — you can pay for it now.',
      }
    case 'REVERSED':
      return {
        tone: 'failed',
        icon: Undo2,
        title: 'Payment was reversed',
        body:
          serverMessage ??
          'The payment was sent back by the provider. Nothing is owed on it. You can start a fresh payment for this order.',
      }
    case 'FAILED':
      return {
        tone: 'failed',
        icon: TriangleAlert,
        title: 'Payment failed',
        body:
          serverMessage ??
          'Your bank or card provider declined the transaction and nothing was charged. You can try again, with the same or a different method.',
      }
    default:
      return {
        tone: 'pending',
        icon: Clock,
        title: 'Confirming your payment',
        body: serverMessage ?? 'We are checking with the payment provider. This usually takes a few seconds.',
      }
  }
}

const toneStyles = {
  success: { wrap: 'border-accent-200 bg-accent-50', icon: 'bg-accent-100 text-accent-700' },
  pending: { wrap: 'border-primary-100 bg-primary-50', icon: 'bg-primary-100 text-primary-700' },
  failed: { wrap: 'border-danger-200 bg-danger-50', icon: 'bg-danger-100 text-danger-700' },
}

/**
 * The Monnify landing page — routes `/checkout/return` (the configured MONNIFY_REDIRECT_URL) and
 * `/checkout/processing`.
 *
 * Everything rendered here comes from `GET /api/payments/{paymentReference}/verify`, which makes
 * the *server* re-ask Monnify. Polling is bounded (see `usePaymentVerification`): a payment that
 * is still pending after ~30 seconds gets an honest "still confirming" screen with a way out,
 * because the webhook may simply be in flight and an endless spinner answers nothing.
 */
export function PaymentReturnPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { settings } = useMarketplaceSettings()
  const [retrying, setRetrying] = useState(false)

  // Our own stored reference is preferred over the query string: it is the one we handed to
  // Monnify, and some failure paths return with no usable parameters at all.
  const paymentReference = useMemo(() => {
    const stored = paymentHandoff.read()
    const fromQuery = REFERENCE_PARAMS.map((key) => searchParams.get(key)).find(
      (value): value is string => !!value && value.trim() !== '',
    )
    return stored?.paymentReference ?? fromQuery ?? null
  }, [searchParams])

  const fallbackOrderId = paymentHandoff.read()?.orderId ?? null
  const { verification, verifying, timedOut, attempt, error, notFound, retry } = usePaymentVerification(paymentReference)

  const orderId = verification?.orderId ?? fallbackOrderId

  // Success routes on by itself. The short delay is so the buyer actually sees the confirmation
  // of payment before the page changes under them.
  useEffect(() => {
    if (verification?.status !== 'PAID' || !verification.orderId) return
    paymentHandoff.clear()
    const timer = setTimeout(() => navigate(`/order-confirmation/${verification.orderId}`, { replace: true }), 1200)
    return () => clearTimeout(timer)
  }, [verification?.status, verification?.orderId, navigate])

  /**
   * Retry mints a brand new transaction. The previous `checkoutUrl` is dead — Monnify expires it
   * 40 minutes after issue — so re-using a stored URL would send the buyer to an error page.
   */
  async function handleRetryPayment() {
    if (!orderId) return
    setRetrying(true)
    try {
      const payment = await checkoutApi.initializePayment(orderId)
      paymentHandoff.write({ paymentReference: payment.paymentReference, orderId })
      window.location.assign(payment.checkoutUrl)
    } catch (err) {
      const status = isAppError(err) ? err.status : 0
      if (status === 409) {
        showToast('This order has already been paid for.', 'info')
        navigate(`/order-confirmation/${orderId}`, { replace: true })
      } else if (status === 503) {
        showToast('Online payment is unavailable right now. Your order is still open.', 'error')
        navigate(`/order-confirmation/${orderId}`, { replace: true })
      } else {
        showToast(isAppError(err) ? err.message : 'We could not start a new payment. Please try again.', 'error')
      }
      setRetrying(false)
    }
  }

  // Nothing to verify — a bookmarked or hand-typed return URL.
  if (!paymentReference) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <HelpCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-neutral-900">No payment to confirm</h1>
          <p className="mt-1 text-sm text-neutral-500">
            This page confirms a payment after you return from the payment provider, and there is no payment in
            progress. Your orders are all listed in your workspace.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/app/orders" className={buttonClassName('primary')}>
              View your orders
            </Link>
            <Link to="/" className={buttonClassName('secondary')}>
              Back to the catalog
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-danger-200 bg-white p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-100 text-danger-700">
            <TriangleAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-neutral-900">We could not find that payment</h1>
          <p className="mt-1 text-sm text-neutral-500">
            The reference does not match any payment on your account. If money left your account, contact us with the
            reference below and we will trace it — nothing is lost.
          </p>
          <p className="mt-3 break-all rounded-md bg-neutral-50 px-3 py-2 font-mono text-xs text-neutral-600">
            {paymentReference}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/app/orders" className={buttonClassName('primary')}>
              View your orders
            </Link>
            {settings.supportEmail && (
              <a href={`mailto:${settings.supportEmail}?subject=${encodeURIComponent(`Payment ${paymentReference}`)}`} className={buttonClassName('secondary')}>
                Contact support
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  const status = verification?.status ?? 'PENDING'
  const outcome = describe(status, verification?.message)
  const styles = toneStyles[outcome.tone]
  const stillPending = status === 'PENDING'
  const canRetryPayment = !!orderId && (status === 'FAILED' || status === 'ABANDONED' || status === 'REVERSED')

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className={`rounded-lg border p-6 ${styles.wrap}`}>
        <div className="flex flex-col items-center text-center">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${styles.icon}`}>
            {verifying && stillPending ? <Spinner size={22} /> : <outcome.icon className="h-6 w-6" aria-hidden="true" />}
          </div>
          {/* aria-live: the heading changes without any navigation once verification resolves. */}
          <h1 aria-live="polite" className="mt-4 text-lg font-semibold text-neutral-900">
            {outcome.title}
          </h1>
          <p className="mt-1 max-w-md text-sm text-neutral-600">{outcome.body}</p>

          {verifying && stillPending && attempt > 1 && (
            <p className="mt-2 text-xs text-neutral-500">
              Still checking — attempt {attempt}. You can safely leave this page open.
            </p>
          )}

          {timedOut && stillPending && (
            <p className="mt-2 max-w-md text-sm text-neutral-600">
              The provider has not given us a final answer yet. This normally settles within a few minutes and you do
              not need to pay again — check your order for the latest status.
            </p>
          )}

          {error && !verification && (
            <p role="alert" className="mt-2 text-sm text-danger-600">
              {error}
            </p>
          )}
        </div>

        {verification && (
          <dl className="mt-5 space-y-2 border-t border-white/60 pt-4 text-sm">
            {verification.orderNumber && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-neutral-600">Order</dt>
                <dd className="font-medium text-neutral-900">{verification.orderNumber}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-neutral-600">Amount</dt>
              <dd className="font-medium text-neutral-900">
                {formatNaira(verification.amountPaid ?? verification.amount)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="shrink-0 text-neutral-600">Reference</dt>
              <dd className="break-all text-right font-mono text-xs text-neutral-600">{verification.paymentReference}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {canRetryPayment && (
          <Button onClick={() => void handleRetryPayment()} loading={retrying}>
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Retry payment
          </Button>
        )}

        {(timedOut || error) && stillPending && (
          <Button variant="secondary" onClick={retry} disabled={verifying}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Check again
          </Button>
        )}

        {orderId && (
          <Link to={`/order-confirmation/${orderId}`} className={buttonClassName('secondary')}>
            View your order
          </Link>
        )}

        <Link to="/" className={buttonClassName('secondary')}>
          Back to the catalog
        </Link>
      </div>

      {canRetryPayment && (
        <p className="mt-3 text-center text-xs text-neutral-500">
          Retrying starts a brand new secure transaction — the previous payment link has expired and cannot be reused.
        </p>
      )}

      {settings.supportPhone && (
        <p className="mt-4 text-center text-xs text-neutral-500">
          Money left your account but nothing here says so? Call us on {settings.supportPhone} with the reference above.
        </p>
      )}
    </div>
  )
}
