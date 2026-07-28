import { useRef, useState } from 'react'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCategories } from '@/features/storefront/hooks/useCategories'
import { topLevelCategories } from '@/features/storefront/types'
import { useClickOutside } from '@/hooks/useClickOutside'

/**
 * The catalog's category entry point.
 *
 * Links carry `?categoryId=…`, matching the catalog endpoint's own filter param (contract §7), so
 * the storefront page can read it straight out of the URL with no shared state between the header
 * and the grid. Renders nothing at all when there are no categories — a menu button that opens an
 * empty box is worse than no button, and the search box covers finding things regardless.
 */
export function StorefrontCategoryMenu({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))
  const { categories } = useCategories()

  if (categories.length === 0) return null

  // One level is enough (contract §4.4): top-level entries head the list, children are indented.
  // Must go through topLevelCategories, not a `parentId === null` test: Jackson is configured with
  // default-property-inclusion=non_null, so a top-level category omits `parentId` from the JSON
  // entirely and it arrives as undefined, never null. The strict-null test matched nothing and the
  // fallback below silently masked it, so the indentation never applied.
  const topLevel = topLevelCategories(categories)
  const roots = topLevel.length > 0 ? topLevel : categories

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        Categories
        <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <Link
            to="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-medium text-primary-600 hover:bg-neutral-50"
          >
            All products
          </Link>
          <div className="my-1 border-t border-neutral-100" />
          {roots.map((category) => {
            const children = categories.filter((child) => child.parentId === category.id)
            return (
              <div key={category.id}>
                <Link
                  to={`/?categoryId=${category.id}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <span className="truncate">{category.name}</span>
                  {category.productCount !== undefined && (
                    <span className="shrink-0 text-xs text-neutral-400">{category.productCount}</span>
                  )}
                </Link>
                {children.map((child) => (
                  <Link
                    key={child.id}
                    to={`/?categoryId=${child.id}`}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="block py-1.5 pl-7 pr-3 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
