import { ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'
import { topLevelCategories, type MarketplaceCategory } from '@/features/storefront/types'

export interface CategoryStripProps {
  categories: MarketplaceCategory[]
  loading: boolean
  activeCategoryId: string
  onSelect: (categoryId: string) => void
}

/**
 * Horizontal category entry points, above the grid.
 *
 * Duplicating the filter rail's categories is deliberate: on mobile the rail lives behind a
 * "Filters" button, and a first-time visitor who has never opened it still needs one obvious way
 * into "Grains & Staples". Selecting one writes the same `categoryId` param the rail does.
 */
export function CategoryStrip({ categories, loading, activeCategoryId, onSelect }: CategoryStripProps) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-32 shrink-0 rounded-full" />
        ))}
      </div>
    )
  }

  const roots = topLevelCategories(categories)
  const shown = roots.length > 0 ? roots : categories
  if (shown.length === 0) return null

  return (
    <nav aria-label="Shop by category">
      {/* Scrolls horizontally rather than wrapping: at 375px six wrapped chips push the grid
          below the fold, and a single swipeable row is the familiar mobile pattern. */}
      <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <li className="shrink-0 snap-start">
          <button
            type="button"
            onClick={() => onSelect('')}
            aria-current={activeCategoryId === '' ? 'true' : undefined}
            className={`flex items-center gap-1 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              activeCategoryId === ''
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            Everything
          </button>
        </li>
        {shown.map((category) => {
          const active = category.id === activeCategoryId
          return (
            <li key={category.id} className="shrink-0 snap-start">
              <button
                type="button"
                onClick={() => onSelect(category.id)}
                aria-current={active ? 'true' : undefined}
                className={`flex items-center gap-1 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  active
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {category.name}
                {category.productCount !== undefined && (
                  <span className={active ? 'text-primary-200' : 'text-neutral-400'}>({category.productCount})</span>
                )}
                <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
