import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { productsApi } from '@/features/products/api/productsApi'
import { ProductImage } from '@/features/products/components/ProductImage'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { Product } from '@/features/products/types'
import type { ProductMatchCandidate } from '@/features/orders/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

export interface DuplicateResolution {
  status: 'linked' | 'new'
  productId?: string
  productName?: string
  /**
   * Set only when the picked product's own unit didn't already match this line's — the buyer's
   * "1 of mine = N of theirs" answer from the conversion step below. Mirrors the manual Stock In
   * screen's own per-delivery pack override (`packagingUnit`/`packagingSize`) exactly, down to
   * `packagingUnit` being the order line's own unit string.
   */
  packagingUnit?: string
  packagingSize?: number
  saveAsSupplierDefault?: boolean
}

/** The minimum shape a candidate needs to be picked and, if necessary, asked to convert. */
interface Pickable {
  id: string
  name: string
  unitOfMeasure?: string
}

export interface DuplicateProductNudgeProps {
  /** The order line's own name — what a candidate is being compared against, and what "no, it's new" would create. */
  itemName: string
  /** The order line's own unit — compared against a candidate's before linking ever proceeds silently. */
  itemUnitOfMeasure?: string
  candidates: ProductMatchCandidate[]
  onResolve: (resolution: DuplicateResolution) => void
}

function normaliseUnit(unit: string | undefined): string {
  return (unit ?? '').trim().toLowerCase()
}

/**
 * MULTI_VENDOR_INVENTORY_DESIGN.md §7.2's three-way prompt: "This looks like it might already be
 * in your inventory as '[best name match]' — same item?" with **Yes**, **Not this one** (tries
 * the next candidate, then falls back to a full search), and **No, it's new**. No default
 * selection — a name-similarity guess isn't confident enough to pre-select an answer either way.
 *
 * A fourth path sits behind "Yes": if the picked product's own unit doesn't match this line's,
 * picking it doesn't resolve immediately — it asks the buyer to convert, the same per-delivery
 * pack question the manual Stock In screen's "this delivery came in a different pack" disclosure
 * already asks, because a bag count and a kg count are not the same number. "No, it's new" stays
 * one click away from that question too, never a dead end.
 *
 * With zero candidates — NameSimilarity found nothing close enough — this asks the underlying
 * question directly instead: "new, or something you already stock?", with "I already have this"
 * dropping into the same search step the exhausted-candidates path above uses. Without it, a
 * buyer who KNOWS this is a duplicate under a name too different to auto-match would have no way
 * to say so at all.
 */
export function DuplicateProductNudge({ itemName, itemUnitOfMeasure, candidates, onResolve }: DuplicateProductNudgeProps) {
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 350)
  const [results, setResults] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)

  // Set only once a picked candidate's unit needs the buyer to say how it converts — see
  // handlePick. Checked before rendering anything else below, so this question always wins.
  const [pendingPick, setPendingPick] = useState<Pickable | null>(null)
  const [conversionFactor, setConversionFactor] = useState('')
  const [saveAsSupplierDefault, setSaveAsSupplierDefault] = useState(false)

  const { options: unitOptions } = useUnitOfMeasureOptions()
  // Codes ("G") resolved to the label a reader actually wants ("Gram (g)") wherever a unit is
  // named in a sentence here — a candidate's unitOfMeasure is a wire code, not display text, the
  // same distinction unitCopy.ts's own helpers draw. Falls back to the raw string for a custom,
  // free-text unit (e.g. "crate (12)") that isn't one of the fixed options at all.
  function unitLabel(unit: string | undefined): string {
    const trimmed = unit?.trim()
    if (!trimmed) return 'units'
    return unitOptions.find((option) => option.code.toLowerCase() === trimmed.toLowerCase())?.label ?? trimmed
  }

  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (!searching || trimmed.length === 0) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    productsApi
      .list({ search: trimmed, size: 5, sort: 'name,asc' })
      .then((response) => {
        if (!cancelled) setResults(response.content)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [searching, debouncedQuery])

  function handleNotThisOne() {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((i) => i + 1)
    } else {
      setSearching(true)
    }
  }

  /**
   * A pick resolves straight away when the units already agree — the overwhelmingly common case,
   * since it also covers "no unit configured on either side". Anything else asks first: silently
   * treating a bag count as a kg count is exactly the bug this whole flow exists to prevent.
   */
  function handlePick(picked: Pickable) {
    if (normaliseUnit(picked.unitOfMeasure) === normaliseUnit(itemUnitOfMeasure)) {
      onResolve({ status: 'linked', productId: picked.id, productName: picked.name })
    } else {
      setPendingPick(picked)
      setConversionFactor('')
      setSaveAsSupplierDefault(false)
    }
  }

  if (pendingPick) {
    const factor = Number(conversionFactor)
    const canConfirm = conversionFactor.trim().length > 0 && Number.isFinite(factor) && factor > 0
    return (
      <div className="mt-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2.5">
        <p className="text-sm text-accent-900">
          <strong className="font-semibold">{itemName}</strong> arrives measured in{' '}
          <strong className="font-semibold">{unitLabel(itemUnitOfMeasure)}</strong>, but{' '}
          <strong className="font-semibold">{pendingPick.name}</strong> is tracked in{' '}
          <strong className="font-semibold">{unitLabel(pendingPick.unitOfMeasure)}</strong>. How many{' '}
          {unitLabel(pendingPick.unitOfMeasure)} is one {unitLabel(itemUnitOfMeasure)}?
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            autoFocus
            value={conversionFactor}
            onChange={(e) => setConversionFactor(e.target.value)}
            placeholder="e.g. 25"
            className="w-28 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
          <span className="text-sm text-neutral-600">
            {unitLabel(pendingPick.unitOfMeasure)} per {unitLabel(itemUnitOfMeasure)}
          </span>
        </div>
        <label className="mt-2 flex items-start gap-2 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={saveAsSupplierDefault}
            onChange={(e) => setSaveAsSupplierDefault(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            Remember this conversion for future deliveries from this seller — left unticked, it applies to this
            delivery only.
          </span>
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() =>
              onResolve({
                status: 'linked',
                productId: pendingPick.id,
                productName: pendingPick.name,
                packagingUnit: itemUnitOfMeasure,
                packagingSize: factor,
                saveAsSupplierDefault,
              })
            }
            className="rounded-md bg-accent-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm conversion
          </button>
          <button
            type="button"
            onClick={() => setPendingPick(null)}
            className="rounded-md border border-accent-300 bg-white px-2.5 py-1 text-xs font-semibold text-accent-900 hover:bg-accent-100"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => onResolve({ status: 'new' })}
            className="px-2.5 py-1 text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
          >
            No, it's new instead
          </button>
        </div>
      </div>
    )
  }

  if (searching) {
    return (
      <div className="mt-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2.5">
        <p className="text-sm text-accent-900">
          Search your inventory for the product <strong className="font-semibold">{itemName}</strong> is really the
          same as, or add it as new.
        </p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing a product name…"
            className="w-full rounded-md border border-neutral-200 bg-white py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
        </div>
        {query.trim().length > 0 && (
          <div className="mt-2">
            {loading && <p className="py-1 text-sm text-neutral-500">Searching…</p>}
            {!loading && results.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {results.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => handlePick(product)}
                      className="flex w-full items-center gap-2.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-primary-200 hover:bg-primary-50"
                    >
                      <ProductImage src={product.imageUrl} alt={product.name} className="h-8 w-8 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
                        {product.name}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-primary-600">Use this →</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!loading && results.length === 0 && (
              <p className="py-1 text-sm text-neutral-500">No matches in your inventory.</p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => onResolve({ status: 'new' })}
          className="mt-2 text-sm font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          No, it's new — add "{itemName}" as its own product
        </button>
      </div>
    )
  }

  if (candidates.length === 0) {
    // No automatic name match — the common case for a genuinely new item, but not proof of one:
    // the buyer may know it's a duplicate under a name too different for NameSimilarity to catch.
    // One question, two equal-weight answers — not a stray link that leaves "is this new?"
    // unasked. Picking "it's new" resolves immediately; ReceiveOrderModal reacts to that by
    // showing the SKU/unit/pack panel right away, so the very next thing on screen is the
    // question this answer implies, not a second link to go find.
    return (
      <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5">
        <p className="text-sm text-neutral-700">
          Is <strong className="font-semibold">{itemName}</strong> new to your inventory, or something you already
          stock?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSearching(true)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            I already have this
          </button>
          <button
            type="button"
            onClick={() => onResolve({ status: 'new' })}
            className="rounded-md bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700"
          >
            It's new
          </button>
        </div>
      </div>
    )
  }

  const candidate = candidates[candidateIndex]

  return (
    <div className="mt-2 rounded-md border border-accent-200 bg-accent-50 px-3 py-2.5">
      <p className="text-sm text-accent-900">
        This looks like it might already be in your inventory as{' '}
        <strong className="font-semibold">{candidate.name}</strong>
        {typeof candidate.quantityOnHand === 'number' ? ` (${candidate.quantityOnHand} on hand` : ''}
        {candidate.unitOfMeasure ? `, counted in ${unitLabel(candidate.unitOfMeasure)}` : ''}
        {typeof candidate.quantityOnHand === 'number' ? ')' : ''} — same item?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handlePick(candidate)}
          className="rounded-md bg-accent-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent-700"
        >
          Yes, same item
        </button>
        <button
          type="button"
          onClick={handleNotThisOne}
          className="rounded-md border border-accent-300 bg-white px-2.5 py-1 text-xs font-semibold text-accent-900 hover:bg-accent-100"
        >
          Not this one
        </button>
        <button
          type="button"
          onClick={() => onResolve({ status: 'new' })}
          className="px-2.5 py-1 text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          No, it's new
        </button>
      </div>
    </div>
  )
}
