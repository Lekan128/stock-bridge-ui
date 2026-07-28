import { Building2, Mail, MapPin, Phone, StickyNote } from 'lucide-react'
import { Badge } from '@/components/Badge'
import type { AdminOrder } from '@/features/marketplace/types'

/** `PAY_ON_DELIVERY_ALLOWED` → `Pay on delivery allowed`. Terms are a plain enum on the client row. */
function formatPaymentTerms(terms?: string | null): string | null {
  if (!terms) return null
  const words = terms.split('_').filter(Boolean)
  if (words.length === 0) return null
  const [first, ...rest] = words.map((word) => word.toLowerCase())
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ')
}

/**
 * Who bought it and where it goes. Both are here because they answer the same question when a
 * dispatch call has to be made: who do I ring, and where am I sending the van.
 *
 * `customer` is only populated on ProcurePal's own reads, and every field inside it is optional —
 * the API omits nulls entirely — so each line guards individually rather than assuming a shape.
 */
export function OrderCustomerPanel({ order }: { order: AdminOrder }) {
  const { customer, delivery } = order
  const paymentTerms = formatPaymentTerms(customer?.paymentTerms)
  const addressLines = [delivery?.addressLine1, delivery?.addressLine2].filter(Boolean)
  const cityState = [delivery?.city, delivery?.state].filter(Boolean).join(', ')
  const hasAddress = addressLines.length > 0 || cityState !== ''

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-labelledby="customer-heading">
        <h2 id="customer-heading" className="text-sm font-semibold text-neutral-900">
          Customer
        </h2>

        {customer ? (
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <p className="flex items-start gap-2 font-medium text-neutral-900">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
              <span>
                {customer.name}
                <span className="ml-1 font-normal text-neutral-500">({customer.slug})</span>
              </span>
            </p>
            {customer.phone && (
              <p className="flex items-center gap-2 text-neutral-600">
                <Phone className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                <a href={`tel:${customer.phone}`} className="rounded hover:text-primary-700 hover:underline">
                  {customer.phone}
                </a>
              </p>
            )}
            {customer.email && (
              <p className="flex items-center gap-2 text-neutral-600">
                <Mail className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                <a href={`mailto:${customer.email}`} className="truncate rounded hover:text-primary-700 hover:underline">
                  {customer.email}
                </a>
              </p>
            )}
            {paymentTerms && (
              <p className="mt-1">
                <Badge variant="neutral">{paymentTerms}</Badge>
              </p>
            )}
            {order.placedByUsername && (
              <p className="mt-1 text-xs text-neutral-500">Ordered by {order.placedByUsername}</p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            The customer’s company details are not on this order. Open it from the order queue to load them.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4" aria-labelledby="delivery-heading">
        <h2 id="delivery-heading" className="text-sm font-semibold text-neutral-900">
          Deliver to
        </h2>

        {hasAddress || delivery?.contactName ? (
          <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-600">
            {delivery?.label && <p className="font-medium text-neutral-900">{delivery.label}</p>}
            {delivery?.contactName && (
              <p className="text-neutral-900">
                {delivery.contactName}
                {delivery.contactPhone && (
                  <a href={`tel:${delivery.contactPhone}`} className="ml-2 rounded text-primary-700 hover:underline">
                    {delivery.contactPhone}
                  </a>
                )}
              </p>
            )}
            {hasAddress && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                <span>
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                  {cityState && <span className="block">{cityState}</span>}
                </span>
              </p>
            )}
            {delivery?.landmark && <p className="text-neutral-500">Landmark: {delivery.landmark}</p>}
            {delivery?.notes && (
              <p className="flex items-start gap-2 rounded-md bg-neutral-50 px-3 py-2 text-neutral-700">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
                <span>{delivery.notes}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">
            No delivery address was captured — this order has not reached checkout completion. Call the customer before
            dispatching anything.
          </p>
        )}
      </section>

      {order.customerNote && (
        <section className="rounded-lg border border-warning-200 bg-warning-50 p-4" aria-labelledby="note-heading">
          <h2 id="note-heading" className="text-sm font-semibold text-warning-900">
            Note from the customer
          </h2>
          <p className="mt-2 text-sm text-warning-900">{order.customerNote}</p>
        </section>
      )}
    </div>
  )
}
