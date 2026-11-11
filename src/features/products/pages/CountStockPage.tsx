import { useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCatalogState } from '@/features/catalog/useCatalog'
import { countPlace } from '@/features/branches/areas'
import { useSheetArea } from '@/features/branches/useSheetBranch'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useCompanyCategories } from '@/features/products/categories/useCompanyCategories'
import { CountList, type CountedHere } from '@/features/quick/CountList'

/**
 * Count stock (owner, 2026-11-10): Inventory's "⋯ → Count stock", the closing count on a laptop - the same list as
 * quick mode's Count, laid out as a table where there's room and as cards on a phone. One place at a time: an area
 * of a branch with areas (chosen at the top; a shortfall can't be put on the Store and the Kitchen at once), or the
 * branch itself when it has one area. Search and the company's categories narrow it, so a big shop counts a shelf at
 * a time.
 */
export function CountStockPage() {
  const navigate = useNavigate()
  const branch = useOptionalWorkingBranch()
  const working = branch && !branch.isAll ? branch.working : null
  const area = useSheetArea(working)
  const place = countPlace(working, area)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const { categories } = useCompanyCategories(true)
  const catalog = useCatalogState()
  // Counted on this page, before the catalogue hears of it: into "Counted today" at once.
  const [countedHere, setCountedHere] = useState<(CountedHere & { areaId: string })[]>([])
  const areaChoices = area.choices

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="mt-0.5 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-neutral-900">
            Count stock{place?.areaName ? ` · ${place.areaName}` : ''}
          </h1>
          <p className="text-sm text-neutral-600">
            Count what's on the shelf. The app's figure is corrected to match, and the difference goes into the history.
          </p>
        </div>
      </div>

      {/* The area, at a branch with areas: one place at a time. */}
      {areaChoices.length > 1 && (
        <div role="group" aria-label="Area to count" className="flex flex-wrap gap-1.5">
          {areaChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={choice.id === place?.areaId}
              onClick={() => area.pick(choice.id)}
              className={`h-10 rounded-full border px-4 text-sm font-medium ${
                choice.id === place?.areaId
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
              }`}
            >
              {choice.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <label className="relative block max-w-md">
          <span className="sr-only">Search name or SKU</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or SKU"
            className="h-10 w-full rounded-md border border-neutral-200 bg-white pr-3 pl-9 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
        </label>
        {/* One shelf at a time: the company's own categories, when it has them. */}
        {categories.length > 0 && (
          <div role="group" aria-label="Category" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {[{ id: '', name: 'All' }, ...categories].map((category) => (
              <button
                key={category.id || 'all'}
                type="button"
                aria-pressed={categoryId === category.id}
                onClick={() => setCategoryId(category.id)}
                className={`h-9 shrink-0 rounded-full border px-3 text-sm font-medium ${
                  categoryId === category.id
                    ? 'border-primary-600 bg-primary-50 text-primary-800'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!place ? (
        <p className="text-base text-neutral-600">Choose the area to count.</p>
      ) : catalog.phase !== 'ready' ? (
        <p className="text-base text-neutral-600">Getting the products ready…</p>
      ) : (
        <CountList
          key={place.areaId}
          areaId={place.areaId}
          areaName={place.areaName}
          search={search}
          categoryId={categoryId}
          countedHere={countedHere.filter((entry) => entry.areaId === place.areaId)}
          onCounted={(row) =>
            setCountedHere((current) => [
              {
                areaId: place.areaId,
                productId: row.productId,
                productName: row.productName,
                summary: row.summary,
                at: Date.now(),
                countedAs: row.countedAs,
              },
              ...current,
            ])
          }
        />
      )}
    </div>
  )
}
