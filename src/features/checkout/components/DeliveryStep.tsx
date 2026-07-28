import { ArrowRight, MapPin, Pencil, Plus } from 'lucide-react'
import { AddressCard } from '@/components/AddressCard'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { NewAddressForm } from '@/features/checkout/components/NewAddressForm'
import type { AddressFormValues } from '@/features/checkout/schemas'
import type { DeliveryAddress } from '@/features/checkout/types'

export interface DeliveryStepProps {
  addresses: DeliveryAddress[]
  loading: boolean
  error: string | null
  onRetry: () => void
  selectedAddressId: string | null
  onSelectAddress: (id: string) => void
  /** A typed-in address already accepted this session, shown as a summary with an edit affordance. */
  newAddress: AddressFormValues | null
  onSubmitNewAddress: (values: AddressFormValues) => void
  showNewAddressForm: boolean
  onToggleNewAddressForm: (open: boolean) => void
  onContinue: () => void
  canContinue: boolean
}

function summarise(values: AddressFormValues): string {
  return [values.addressLine1, values.addressLine2, values.city, values.state].filter(Boolean).join(', ')
}

/**
 * Step 1 — where the order goes.
 *
 * When the company has no saved address the form is rendered *directly* and there is no way past
 * this step without completing it (an explicit product requirement): a first-time buyer should
 * never have to discover a "deliver somewhere else" link to find the only route forward. Saving
 * is forced in that case too, so their second order starts from a filled address book.
 */
export function DeliveryStep({
  addresses,
  loading,
  error,
  onRetry,
  selectedAddressId,
  onSelectAddress,
  newAddress,
  onSubmitNewAddress,
  showNewAddressForm,
  onToggleNewAddressForm,
  onContinue,
  canContinue,
}: DeliveryStepProps) {
  const hasSavedAddresses = addresses.length > 0

  if (loading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    )
  }

  if (error && !hasSavedAddresses) {
    return (
      <ErrorState
        title="We could not load your delivery addresses"
        message={error}
        onRetry={onRetry}
        action={
          <Button variant="secondary" onClick={() => onToggleNewAddressForm(true)}>
            Enter an address manually
          </Button>
        }
      />
    )
  }

  // No saved addresses at all: the form is the step.
  if (!hasSavedAddresses) {
    return (
      <section>
        <h2 className="text-base font-semibold text-neutral-900">Where should we deliver?</h2>
        <p className="mt-1 text-sm text-neutral-500">
          You have not saved a delivery address yet. Add one to continue — we will keep it for next time.
        </p>
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
          <NewAddressForm onSubmit={onSubmitNewAddress} forceSave submitLabel="Save and continue" />
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-neutral-900">Delivery address</h2>
      <p className="mt-1 text-sm text-neutral-500">Pick where this order should go.</p>

      {error && <ErrorState variant="inline" message={error} onRetry={onRetry} className="mt-3" />}

      <div className="mt-4 space-y-3">
        {addresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            variant="selectable"
            name="checkoutDeliveryAddress"
            selected={!newAddress && selectedAddressId === address.id}
            onSelect={onSelectAddress}
          />
        ))}

        {newAddress ? (
          <div className="rounded-lg border border-primary-500 bg-primary-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">{newAddress.label}</p>
                <p className="mt-1 text-sm text-neutral-700">{newAddress.contactName}</p>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-neutral-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                  {summarise(newAddress)}
                </p>
                <p className="mt-1 text-sm text-neutral-600">{newAddress.contactPhone}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {newAddress.saveAddress
                    ? 'Will be saved to your address book when you place the order.'
                    : 'Used for this order only — not saved to your address book.'}
                </p>
              </div>
              <Button variant="secondary" onClick={() => onToggleNewAddressForm(true)} className="shrink-0">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </Button>
            </div>
          </div>
        ) : showNewAddressForm ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-neutral-900">Deliver somewhere else</h3>
            <div className="mt-3">
              <NewAddressForm onSubmit={onSubmitNewAddress} onCancel={() => onToggleNewAddressForm(false)} />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onToggleNewAddressForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:border-primary-300 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Deliver somewhere else
          </button>
        )}
      </div>

      <div className="mt-5">
        <Button onClick={onContinue} disabled={!canContinue} aria-describedby="delivery-continue-reason">
          Continue to payment
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        {!canContinue && (
          <p id="delivery-continue-reason" className="mt-2 text-xs text-danger-600">
            Select a delivery address, or add a new one, before continuing.
          </p>
        )}
      </div>
    </section>
  )
}
