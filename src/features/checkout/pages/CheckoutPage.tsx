import { useEffect, useMemo, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, buttonClassName } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { StepIndicator } from '@/components/StepIndicator'
import { useToast } from '@/components/useToast'
import type { PaymentMethod } from '@/constants/orderStatus'
import { useCart } from '@/features/cart/hooks/useCart'
import { DeliveryStep } from '@/features/checkout/components/DeliveryStep'
import { OrderSummaryPanel } from '@/features/checkout/components/OrderSummaryPanel'
import { PaymentStep } from '@/features/checkout/components/PaymentStep'
import { ReviewStep, type ReviewAddressSummary } from '@/features/checkout/components/ReviewStep'
import { checkoutApi } from '@/features/checkout/api/checkoutApi'
import { useCheckoutQuote } from '@/features/checkout/hooks/useCheckoutQuote'
import { useDeliveryAddresses } from '@/features/checkout/hooks/useDeliveryAddresses'
import { paymentHandoff } from '@/features/checkout/paymentHandoff'
import { toAddressPayload, type AddressFormValues } from '@/features/checkout/schemas'
import type { Order, PlaceOrderPayload, UnavailableLine } from '@/features/checkout/types'
import { isAppError } from '@/types/api'

const STEPS = [
  { id: 'delivery', label: 'Delivery' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Review' },
]

/**
 * The server adds this blocker whenever the company has no *saved* address. It does not know
 * about an address typed into the inline form (the quote endpoint takes an id, not a body), so it
 * is filtered out once one has been entered — otherwise a buyer who has just typed their address
 * would be told to add a delivery address. `POST /api/orders` accepts `newAddress` and does not
 * re-raise this, so filtering it here cannot let an addressless order through.
 */
function isMissingAddressBlocker(blocker: string): boolean {
  return blocker.toLowerCase().includes('delivery address')
}

/**
 * Checkout — route `/checkout`. Auth is enforced by the route guard, which sends anonymous
 * visitors through `/login?redirect=/checkout` and merges their local cart when they land back.
 *
 * Three steps, one persistent summary. Every number on screen comes from `POST /api/checkout/quote`
 * and is re-fetched whenever the delivery address changes, because the address is an input to the
 * price and to pay-on-delivery eligibility.
 */
export function CheckoutPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { items, isLoading: cartLoading, refetch: refetchCart } = useCart()
  const {
    addresses,
    loading: addressesLoading,
    error: addressesError,
    refetch: refetchAddresses,
  } = useDeliveryAddresses()

  const [stepIndex, setStepIndex] = useState(0)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [newAddress, setNewAddress] = useState<AddressFormValues | null>(null)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MONNIFY')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [failedLines, setFailedLines] = useState<UnavailableLine[]>([])
  const [onlinePaymentUnavailable, setOnlinePaymentUnavailable] = useState(false)

  // A typed-in address has no id, so the quote is taken against the company default. The fee is
  // not address-dependent server-side; what the id changes is which address the quote echoes back.
  const quoteAddressId = newAddress ? undefined : (selectedAddressId ?? undefined)
  const { quote, loading: quoteLoading, refreshing: quoteRefreshing, error: quoteError, refetch: refetchQuote } =
    useCheckoutQuote(quoteAddressId)

  // Preselect the default address the moment the list arrives. Doing it in an effect rather than
  // in the fetch keeps the choice sticky: once the buyer has picked something, nothing overrides it.
  useEffect(() => {
    if (selectedAddressId || newAddress || addresses.length === 0) return
    setSelectedAddressId((addresses.find((address) => address.isDefault) ?? addresses[0]).id)
  }, [addresses, selectedAddressId, newAddress])

  // Monnify is the default, but it must not stay selected on a deployment where it is unusable,
  // or a buyer reaches Review with a method that cannot complete.
  useEffect(() => {
    if (onlinePaymentUnavailable && paymentMethod === 'MONNIFY' && quote?.payOnDeliveryEligible) {
      setPaymentMethod('PAY_ON_DELIVERY')
    }
  }, [onlinePaymentUnavailable, paymentMethod, quote?.payOnDeliveryEligible])

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  )

  const reviewAddress: ReviewAddressSummary | null = useMemo(() => {
    if (newAddress) {
      return {
        label: newAddress.label,
        contactName: newAddress.contactName,
        contactPhone: newAddress.contactPhone,
        lines: [newAddress.addressLine1, newAddress.addressLine2, newAddress.city, newAddress.state]
          .filter(Boolean)
          .join(', '),
        notes: newAddress.deliveryNotes || undefined,
        oneOff: !newAddress.saveAddress,
      }
    }
    if (!selectedAddress) return null
    return {
      label: selectedAddress.label,
      contactName: selectedAddress.contactName,
      contactPhone: selectedAddress.contactPhone,
      lines: [
        selectedAddress.addressLine1,
        selectedAddress.addressLine2,
        selectedAddress.city,
        selectedAddress.state,
      ]
        .filter(Boolean)
        .join(', '),
      notes: selectedAddress.deliveryNotes,
    }
  }, [newAddress, selectedAddress])

  const hasAddress = !!newAddress || !!selectedAddressId

  // The quote's own sentences, minus the "no address" one when an inline address covers it, plus
  // the client-only conditions the server cannot see (an unpriced cart, a failed quote).
  const blockers = useMemo(() => {
    const list: string[] = []
    if (quoteError) list.push(quoteError)
    if (quote) {
      for (const blocker of quote.blockers) {
        if (newAddress && isMissingAddressBlocker(blocker)) continue
        list.push(blocker)
      }
    }
    if (!hasAddress) list.push('Choose a delivery address before placing this order.')
    return list
  }, [quote, quoteError, newAddress, hasAddress])

  function handleSubmitNewAddress(values: AddressFormValues) {
    setNewAddress(values)
    setShowNewAddressForm(false)
    setSelectedAddressId(null)
    setStepIndex(1)
  }

  function handleSelectAddress(id: string) {
    setSelectedAddressId(id)
    // Picking a saved address discards the typed one; keeping both would leave two "selected"
    // addresses on screen with no way to tell which the order will actually use.
    setNewAddress(null)
    setShowNewAddressForm(false)
  }

  /** Monnify: mint a fresh checkout URL and hand the browser over. */
  async function startOnlinePayment(order: Order) {
    try {
      const payment = await checkoutApi.initializePayment(order.id)
      // Remembered before the redirect so the return page can verify by reference even if Monnify
      // comes back with no usable query string.
      paymentHandoff.write({
        paymentReference: payment.paymentReference,
        orderId: order.id,
        orderNumber: order.orderNumber,
      })
      window.location.assign(payment.checkoutUrl)
    } catch (err) {
      const status = isAppError(err) ? err.status : 0
      if (status === 503) {
        // Monnify unconfigured. The order exists and is still payable, so this is not a dead end:
        // send the buyer to the confirmation page, which offers retry, and unlock pay-on-delivery.
        setOnlinePaymentUnavailable(true)
        showToast('Online payment is unavailable right now. Your order was created — you can retry payment.', 'error')
      } else if (status === 409) {
        showToast('This order has already been paid for.', 'info')
      } else {
        showToast(isAppError(err) ? err.message : 'We could not open the payment page.', 'error')
      }
      navigate(`/order-confirmation/${order.id}`)
    }
  }

  async function handlePlaceOrder() {
    setSubmitting(true)
    setSubmitError(null)
    setFailedLines([])

    const payload: PlaceOrderPayload = {
      paymentMethod,
      customerNote: note.trim() || undefined,
      ...(newAddress
        ? { newAddress: toAddressPayload(newAddress, newAddress.saveAddress && addresses.length === 0), saveAddress: newAddress.saveAddress }
        : { deliveryAddressId: selectedAddressId ?? undefined }),
    }

    try {
      const order = await checkoutApi.placeOrder(payload)

      // The order now owns the cart's contents; refreshing empties the badge rather than leaving
      // a phantom cart the buyer could check out twice.
      refetchCart()

      if (newAddress?.saveAddress) refetchAddresses()

      if (paymentMethod === 'PAY_ON_DELIVERY') {
        navigate(`/order-confirmation/${order.id}`)
        return
      }
      await startOnlinePayment(order)
    } catch (err) {
      const message = isAppError(err) ? err.message : 'Something went wrong placing your order. Please try again.'
      setSubmitError(message)

      // The server refuses orders that exceed available stock, and the message names the product.
      // Re-quoting is what turns that into per-line detail the review list can point at.
      try {
        const fresh = await checkoutApi.quote(quoteAddressId)
        setFailedLines(fresh.unavailableItems ?? [])
      } catch {
        // The re-quote is best-effort; the server's own message is already on screen.
      }
      refetchQuote()
      setSubmitting(false)
    }
  }

  const summary = (
    <OrderSummaryPanel quote={quote} items={items} loading={quoteLoading} refreshing={quoteRefreshing} />
  )

  if (cartLoading && items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-6 h-10 w-full" />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <EmptyState
          icon={ShoppingCart}
          title="There is nothing to check out"
          description="Your cart is empty, so there is no order to place. Add a few products and come back."
          action={
            <Link to="/" className={buttonClassName('primary')}>
              Browse the catalog
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">Checkout</h1>

      <StepIndicator
        steps={STEPS}
        currentIndex={stepIndex}
        onStepClick={(index) => setStepIndex(index)}
        className="mt-5"
      />

      {quoteError && (
        <ErrorState
          variant="inline"
          title="We could not price your order"
          message={quoteError}
          onRetry={refetchQuote}
          className="mt-5"
        />
      )}

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          {stepIndex === 0 && (
            <DeliveryStep
              addresses={addresses}
              loading={addressesLoading}
              error={addressesError}
              onRetry={refetchAddresses}
              selectedAddressId={selectedAddressId}
              onSelectAddress={handleSelectAddress}
              newAddress={newAddress}
              onSubmitNewAddress={handleSubmitNewAddress}
              showNewAddressForm={showNewAddressForm}
              onToggleNewAddressForm={(open) => {
                setShowNewAddressForm(open)
                if (open) setNewAddress(null)
              }}
              onContinue={() => setStepIndex(1)}
              canContinue={hasAddress}
            />
          )}

          {stepIndex === 1 && (
            <PaymentStep
              quote={quote}
              value={paymentMethod}
              onChange={setPaymentMethod}
              onlinePaymentUnavailable={onlinePaymentUnavailable}
              onBack={() => setStepIndex(0)}
              onContinue={() => setStepIndex(2)}
            />
          )}

          {stepIndex === 2 && (
            <ReviewStep
              quote={quote}
              items={items}
              paymentMethod={paymentMethod}
              address={reviewAddress}
              note={note}
              onNoteChange={setNote}
              blockers={blockers}
              submitting={submitting}
              onSubmit={() => void handlePlaceOrder()}
              onBack={() => setStepIndex(1)}
              submitError={submitError}
              failedLines={failedLines}
            />
          )}
        </div>

        {/* Sticky on desktop so the total never scrolls away; below the step on mobile, where a
            fixed panel would eat the small viewport the form needs. */}
        <aside className="mt-8 lg:sticky lg:top-20 lg:mt-0">{summary}</aside>
      </div>

      {items.some((item) => !item.available) && (
        <div className="mt-6">
          <ErrorState
            variant="inline"
            title="Some items are no longer available"
            message="Your cart contains items ProcurePal can no longer supply. Remove them before placing this order."
            action={
              <Link to="/cart" className={buttonClassName('secondary')}>
                Go to cart
              </Link>
            }
          />
        </div>
      )}

      <div className="mt-6 lg:hidden">
        <Button variant="secondary" onClick={() => navigate('/cart')} className="w-full">
          Back to cart
        </Button>
      </div>
    </div>
  )
}
