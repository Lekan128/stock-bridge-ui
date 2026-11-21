import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { useApiQuery } from '@/data/useApiQuery'
import { isAppError } from '@/types/api'
import { syncCatalog } from '@/features/catalog/catalogStore'
import { branchProductsApi, type ProductToAdd } from '@/features/branches/branchesApi'
import { useSellingPolicy } from '@/features/selling/useSellingPolicy'
import { NeedsALookList, lookSummary, useNeedsALook } from '@/features/products/NeedsALook'

/** The picker's choice: every product the branch doesn't have, or these. */
export type BranchProductsChoice = { all: true } | { all: false; ids: string[] }

/** Adds the chosen products to the branch (no stock moves), then brings the phone's copy up to date. */
export async function addProductsToBranch(branchId: string, choice: BranchProductsChoice): Promise<number> {
  const { added } = await branchProductsApi.add(
    branchId,
    choice.all ? { all: true } : { productIds: choice.ids },
  )
  void syncCatalog().catch(() => {})
  return added
}

interface PickerProps {
  branchId: string
  branchName: string
  selected: string[]
  onSelectedChange: (ids: string[]) => void
  /** "Add all 48": chooses every product the branch doesn't have. */
  onAddAll: (total: number) => void
}

/**
 * The products a branch doesn't have yet, to tick (owner, 2026-11-17): search, Kept in stock | Made here, each
 * category with its own "Select all". The list shows the first 200; search finds the rest; "Add all" takes every one.
 */
export function BranchProductPicker({ branchId, branchName, selected, onSelectedChange, onAddAll }: PickerProps) {
  const { sellsMadeHere } = useSellingPolicy()
  const [search, setSearch] = useState('')
  const [madeHere, setMadeHere] = useState(false)
  const term = search.trim()
  const query = useApiQuery({
    queryKey: ['branch-products-to-add', branchId, term, sellsMadeHere ? madeHere : null],
    queryFn: () => branchProductsApi.toAdd(branchId, { search: term || undefined, madeHere: sellsMadeHere ? madeHere : undefined }),
    fallbackError: "Couldn't load the products.",
  })
  const products = useMemo(() => query.data?.products ?? [], [query.data])
  const groups = useMemo(() => {
    const byCategory = new Map<string, { name: string; products: ProductToAdd[] }>()
    for (const product of products) {
      const key = product.categoryId ?? ''
      const group = byCategory.get(key) ?? { name: product.categoryName ?? 'No category', products: [] }
      group.products.push(product)
      byCategory.set(key, group)
    }
    return [...byCategory.entries()]
  }, [products])

  const chosen = new Set(selected)
  const toggle = (id: string) => onSelectedChange(chosen.has(id) ? selected.filter((existing) => existing !== id) : [...selected, id])
  const total = query.data?.total ?? 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-neutral-600">
          {query.data == null
            ? 'Loading…'
            : total === 0
              ? `${branchName} has every product.`
              : `${total} ${total === 1 ? 'product' : 'products'} not at ${branchName} yet. They show there at 0 until stock arrives.`}
        </p>
        {total > 0 && (
          <button
            type="button"
            onClick={() => onAddAll(total)}
            className="shrink-0 rounded-sm text-sm font-semibold text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Add all {total}
          </button>
        )}
      </div>
      <label className="relative block">
        <span className="sr-only">Search products</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products…"
          className="w-full rounded-md border border-neutral-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </label>
      {sellsMadeHere && (
        <div role="tablist" aria-label="Kind of product" className="inline-flex w-fit gap-0.5 rounded-full border border-neutral-300 bg-white p-0.5">
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              role="tab"
              aria-selected={madeHere === value}
              onClick={() => setMadeHere(value)}
              className={`min-h-9 rounded-full px-4 text-sm font-semibold ${
                madeHere === value ? 'bg-primary-50 text-primary-800 ring-1 ring-primary-300' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {value ? 'Made here' : 'Kept in stock'}
            </button>
          ))}
        </div>
      )}
      {query.error && <p role="alert" className="text-sm text-danger-700">{query.error}</p>}
      {query.data != null && products.length === 0 && total > 0 && (
        <p className="py-6 text-center text-sm text-neutral-500">{term ? `Nothing matches “${term}”.` : 'Nothing here.'}</p>
      )}
      <div className="flex flex-col gap-4">
        {groups.map(([key, group]) => {
          const allOn = group.products.every((product) => chosen.has(product.id))
          return (
            <fieldset key={key || 'none'} className="flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-1">
                <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.name}</legend>
                <button
                  type="button"
                  onClick={() => {
                    const ids = group.products.map((product) => product.id)
                    onSelectedChange(allOn ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])])
                  }}
                  className="text-xs font-medium text-primary-700 hover:underline"
                >
                  {allOn ? 'Clear' : 'Select all'}
                </button>
              </div>
              {group.products.map((product) => (
                <label key={product.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-neutral-100 text-sm">
                  <input type="checkbox" checked={chosen.has(product.id)} onChange={() => toggle(product.id)} />
                  <span className="min-w-0 flex-1 truncate text-neutral-900">{product.name}</span>
                </label>
              ))}
            </fieldset>
          )
        })}
      </div>
      {query.data != null && query.data.matching > products.length && (
        <p className="text-xs text-neutral-500">
          Showing {products.length} of {query.data.matching}. Search to find the rest, or use Add all.
        </p>
      )}
    </div>
  )
}

/** "Add products" for a branch that exists: the picker in its own side sheet. */
export function AddBranchProductsSheet({ branchId, branchName, onClose }: { branchId: string; branchName: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // After adding (BRANCH_PRICES_PLAN.md 9.2): how many went in, and what to look at there before selling.
  const [added, setAdded] = useState<number | null>(null)
  const look = useNeedsALook(branchId, undefined, added != null)

  async function add(choice: BranchProductsChoice) {
    setBusy(true)
    setProblem(null)
    try {
      const count = await addProductsToBranch(branchId, choice)
      await queryClient.invalidateQueries({ queryKey: ['branch-products-to-add', branchId] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['needs-a-look'] })
      setAdded(count)
    } catch (error) {
      setProblem(isAppError(error) ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (added != null) {
    const answer = look.data
    return (
      <Sheet
        open
        onClose={onClose}
        title={`Add products to ${branchName}`}
        size="lg"
        footer={
          <Button variant="action" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="font-medium text-neutral-900">
            {added} {added === 1 ? 'product' : 'products'} added to {branchName}.
            {answer && answer.items.length > 0 ? ` ${lookSummary(answer, undefined).split(' · ')[1]}.` : ''}
          </p>
          {answer && answer.items.length > 0 ? (
            <>
              <NeedsALookList answer={answer} showBranch={false} inSheet />
              <p className="text-sm text-neutral-500">
                Ingredients don&apos;t need stock first: stock them in before you start selling. Anything left here stays on the line
                on Inventory.
              </p>
            </>
          ) : (
            answer && <p className="text-sm text-neutral-600">Nothing to look at: they&apos;re ready at {branchName}.</p>
          )}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Add products to ${branchName}`}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="action" loading={busy} disabled={selected.length === 0} onClick={() => void add({ all: false, ids: selected })}>
            {selected.length === 0 ? 'Add products' : `Add ${selected.length} ${selected.length === 1 ? 'product' : 'products'}`}
          </Button>
        </>
      }
    >
      <BranchProductPicker
        branchId={branchId}
        branchName={branchName}
        selected={selected}
        onSelectedChange={setSelected}
        onAddAll={() => void add({ all: true })}
      />
      {problem && (
        <p role="alert" className="mt-4 text-sm text-danger-700">
          {problem}
        </p>
      )}
    </Sheet>
  )
}
