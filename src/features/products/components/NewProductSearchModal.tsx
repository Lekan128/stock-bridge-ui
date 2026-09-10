import { useEffect, useState } from 'react'
import { PackagePlus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { ProductImage } from '@/features/products/components/ProductImage'
import { productsApi } from '@/features/products/api/productsApi'
import type { Product } from '@/features/products/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { isAppError } from '@/types/api'

export interface NewProductSearchModalProps {
  open: boolean
  onClose: () => void
}

/**
 * The "one moment of truth" from §7.1 of the multi-vendor inventory design.
 *
 * `ProductManagementService.create()` today has zero name-similarity check — only SKU
 * uniqueness — so nothing stops "Rice 50kg" being created twice because it was bought from two
 * different suppliers. This is the fix: opened from "Add Product" INSTEAD OF navigating straight
 * to the create form, so the is-this-new-or-existing decision happens once, up front, via search
 * — never as a follow-up reconciliation screen once two rows already exist.
 *
 * <h2>Two outcomes, always both on screen, never nested</h2>
 * Picking a match and creating new are not a primary path and a fallback — they are two equally
 * valid answers to the same question. So "Create new product" is rendered unconditionally,
 * whether there are five matches, one, or none: it is never hidden behind (or gated by) a
 * "no results" state, and picking a match never requires dismissing it first.
 */
export function NewProductSearchModal({ open, onClose }: NewProductSearchModalProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 350)
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cleared on every open, not just on close — a modal instance reused across "Add Product"
  // clicks must not show the previous visit's search when it reopens.
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setError(null)
    }
  }, [open])

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (!open || trimmed.length === 0) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    productsApi
      .list({ search: trimmed, size: 5, sort: 'name,asc' })
      .then((response) => {
        if (!cancelled) setResults(response.content)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'Could not search your products.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, debouncedQuery])

  function handlePickMatch(product: Product) {
    onClose()
    // ProductDetailPage reads `?action=stock-in` on mount and auto-opens the Stock In modal,
    // then strips the param — see its useEffect for the other half of this hand-off.
    navigate(`/app/products/${product.id}?action=stock-in`)
  }

  function handleCreateNew() {
    const name = query.trim()
    onClose()
    navigate('/app/products/new', { state: name ? { name } : undefined })
  }

  const trimmedQuery = query.trim()

  return (
    <Modal open={open} onClose={onClose} title="Add a product" size="md">
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="new-product-search" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Product name
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            {/* Opened by an explicit click, never on page load, so autofocus here doesn't steal
                focus from anything the user didn't just ask to open. */}
            <input
              id="new-product-search"
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing a product name…"
              className="w-full rounded-md border border-neutral-200 py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            We check your own inventory by name, not just SKU — so buying the same item from a new supplier doesn't
            quietly create a second row for it.
          </p>
        </div>

        {trimmedQuery.length > 0 && (
          <div>
            {loading && <p className="py-3 text-center text-sm text-neutral-500">Searching…</p>}
            {!loading && error && <p className="py-3 text-center text-sm text-danger-600">{error}</p>}
            {!loading && !error && results.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {results.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => handlePickMatch(product)}
                      className="flex w-full items-center gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2 text-left transition-colors hover:border-primary-200 hover:bg-primary-50"
                    >
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-9 w-9 shrink-0 rounded-md"
                        iconClassName="h-4 w-4"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">{product.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500">
                          <span>{product.quantityOnHand} on hand</span>
                          {product.preferredVendorName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">from {product.preferredVendorName}</span>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-primary-600">Add stock →</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!loading && !error && results.length === 0 && (
              <p className="py-3 text-center text-sm text-neutral-500">No matches in your inventory yet.</p>
            )}
          </div>
        )}

        {/* A visible "or" between the two outcomes once there's something to divide — picking a
            match above and creating new below are equally valid answers to the same question
            (see the doc comment on this component), not a primary path with a fallback tacked
            on, so the divider keeps them from reading as one continuing list. Skipped while
            nothing has been typed yet, since there's only one outcome on screen at that point. */}
        {trimmedQuery.length > 0 && !loading && (
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs text-neutral-400">or</span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>
        )}

        {/* Ever-present. Not a fallback rendered only when the search above comes up empty — see
            the doc comment above for why that distinction matters. */}
        <Button type="button" variant="secondary" onClick={handleCreateNew} className="w-full justify-center">
          <PackagePlus className="h-4 w-4" aria-hidden="true" />
          {trimmedQuery.length > 0 ? `Create "${trimmedQuery}" as a new product` : 'Create new product'}
        </Button>
      </div>
    </Modal>
  )
}
