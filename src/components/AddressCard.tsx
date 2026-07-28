import type { ReactNode } from 'react'
import { MapPin, Phone } from 'lucide-react'
import { Badge } from '@/components/Badge'

/**
 * Structural subset of a delivery address (contract §4.3). Declared here rather than imported
 * from the addresses feature so this primitive stays usable from checkout, the order detail page
 * and the address book without any of them depending on each other's DTOs — the feature's own
 * `DeliveryAddress` type is structurally assignable to this.
 */
export interface AddressCardAddress {
  id: string
  label: string
  contactName: string
  contactPhone: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  state: string
  landmark?: string | null
  deliveryNotes?: string | null
  isDefault?: boolean
}

export interface AddressCardProps {
  address: AddressCardAddress
  /**
   * `display` is a static card (address book, order snapshot). `selectable` renders a real radio
   * input inside a clickable card — a real input, not a div with an onClick, so keyboard and
   * screen-reader users get radio-group semantics for free at checkout.
   */
  variant?: 'display' | 'selectable'
  selected?: boolean
  onSelect?: (id: string) => void
  /** Radio group name. Required when several selectable cards share a group. */
  name?: string
  disabled?: boolean
  /** Edit/delete controls, rendered top-right. Only used by the `display` variant. */
  actions?: ReactNode
  className?: string
}

function AddressBody({ address }: { address: AddressCardAddress }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-neutral-900">{address.label}</p>
        {address.isDefault && <Badge variant="info">Default</Badge>}
      </div>
      <p className="mt-1 text-sm text-neutral-700">{address.contactName}</p>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-neutral-600">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
        <span>
          {address.addressLine1}
          {address.addressLine2 ? `, ${address.addressLine2}` : ''}, {address.city}, {address.state}
          {address.landmark ? ` (near ${address.landmark})` : ''}
        </span>
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-600">
        <Phone className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
        {address.contactPhone}
      </p>
      {address.deliveryNotes && (
        <p className="mt-2 rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">{address.deliveryNotes}</p>
      )}
    </>
  )
}

export function AddressCard({
  address,
  variant = 'display',
  selected = false,
  onSelect,
  name = 'deliveryAddress',
  disabled = false,
  actions,
  className = '',
}: AddressCardProps) {
  if (variant === 'selectable') {
    return (
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-primary-500 ${
          selected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:border-neutral-300'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}
      >
        <input
          type="radio"
          name={name}
          value={address.id}
          checked={selected}
          disabled={disabled}
          onChange={() => onSelect?.(address.id)}
          className="mt-1 h-4 w-4 shrink-0 accent-primary-600"
        />
        <div className="min-w-0 flex-1">
          <AddressBody address={address} />
        </div>
      </label>
    )
  }

  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <AddressBody address={address} />
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
    </div>
  )
}
