import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { expectedCopy } from '@/features/expected/copy'
import { shortDate } from '@/features/expected/expected'
import type { RecentSupplier } from '@/features/expected/types'
import { VendorFormModal } from '@/features/vendors/components/VendorFormModal'
import type { CompanyVendor } from '@/features/vendors/types'

const text = expectedCopy.form
const SHOWN = 6

export interface SupplierSearchProps {
  vendors: CompanyVendor[]
  recent: RecentSupplier[]
  value: string
  onChange: (vendorId: string) => void
  /** MANAGE_VENDORS: "+ New supplier" is offered. */
  canCreate: boolean
  onCreated: (vendor: CompanyVendor) => void
  /** Changing an order keeps its supplier. */
  locked?: boolean
  /** The heading: "Supplier" on an order, "Who is it from?" on a delivery. */
  label?: string
  disabled?: boolean
}

/**
 * "Supplier" on a new purchase order (redesign 2026-11-04). Not a dropdown: a search with the people
 * ordered from most recently at the top, each with when and what — "Last order 28 Oct · rice, oil" —
 * so the right Tony is picked at a glance. Once picked it is one line with "Change", which is all the
 * room it should take on a phone while the items are being added.
 *
 * "+ New supplier" opens the supplier form the directory uses, over the order (Pattern A), so nothing
 * typed is lost.
 */
export function SupplierSearch({ vendors, recent, value, onChange, canCreate, onCreated, locked, disabled, label }: SupplierSearchProps) {
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const chosen = vendors.find((vendor) => vendor.id === value)

  const recentById = useMemo(() => new Map(recent.map((entry, index) => [entry.vendorId, { entry, index }])), [recent])
  const matches = useMemo(() => {
    const typed = query.trim().toLowerCase()
    const found = vendors.filter((vendor) => typed === '' || vendor.name.toLowerCase().includes(typed))
    // Ordered from most recently first, then everyone else by name.
    return [...found].sort((a, b) => {
      const ra = recentById.get(a.id)?.index ?? Number.MAX_SAFE_INTEGER
      const rb = recentById.get(b.id)?.index ?? Number.MAX_SAFE_INTEGER
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name)
    })
  }, [vendors, query, recentById])

  if (chosen) {
    const contact = [chosen.contactPhone, chosen.email].filter((part) => part && part.trim() !== '').join(' · ')
    return (
      <section aria-label={(label ?? text.supplierLabel)} className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-neutral-500">{(label ?? text.supplierLabel)}</p>
          <p className="font-semibold text-neutral-900">{chosen.name}</p>
          {contact && <p className="mt-0.5 text-sm break-words text-neutral-600 tabular-nums">{contact}</p>}
        </div>
        {!locked && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setQuery('')
              onChange('')
            }}
            aria-label={text.supplierChangeLabel(chosen.name)}
            className="shrink-0 rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          >
            {text.supplierChange}
          </button>
        )}
      </section>
    )
  }

  const shown = matches.slice(0, SHOWN)
  return (
    <section aria-labelledby="po-supplier-label" className="flex flex-col gap-2">
      <label id="po-supplier-label" htmlFor="po-supplier-search" className="text-sm font-semibold text-neutral-900">
        {(label ?? text.supplierLabel)}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
        <input
          id="po-supplier-search"
          type="search"
          value={query}
          disabled={disabled}
          autoComplete="off"
          placeholder={text.supplierSearch}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (shown.length === 1) onChange(shown[0].id)
            }
          }}
          className="w-full rounded-md border border-neutral-200 bg-white py-2.5 pr-3 pl-9 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:text-sm"
        />
      </div>
      <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {shown.map((vendor) => {
          const last = recentById.get(vendor.id)?.entry
          return (
            <li key={vendor.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(vendor.id)}
                className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-neutral-50 focus-visible:bg-primary-50 focus-visible:outline-none"
              >
                <span className="font-semibold text-neutral-900">{vendor.name}</span>
                {last && (
                  <span className="text-xs text-neutral-600">
                    {text.supplierRecent(shortDate(last.lastOrderedAt.slice(0, 10)), last.products.join(', ').toLowerCase())}
                  </span>
                )}
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="px-4 py-2.5 text-sm text-neutral-600">{text.supplierNone}</li>}
        {canCreate && (
          <li>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setAdding(true)}
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-primary-700 hover:bg-neutral-50 focus-visible:bg-primary-50 focus-visible:outline-none"
            >
              {text.supplierNew}
            </button>
          </li>
        )}
      </ul>
      {adding && (
        <VendorFormModal
          onClose={() => setAdding(false)}
          onSaved={(vendor) => {
            onCreated(vendor)
            onChange(vendor.id)
            setAdding(false)
          }}
        />
      )}
    </section>
  )
}
