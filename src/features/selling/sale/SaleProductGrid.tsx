import { viewingBranchId } from '@/features/branches/viewingBranch'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useApiQuery } from '@/data/useApiQuery'
import { useCatalogList, useCatalogState } from '@/features/catalog/useCatalog'
import { useCompanyCategories } from '@/features/products/categories/useCompanyCategories'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { Product } from '@/features/products/types'
import { formatNumber } from '@/features/products/unitCopy'
import { formatMoney } from '@/features/selling/money'
import { openingUnit, unitsFor, usualPrice } from '@/features/selling/sale/saleLine'
import type { useSaleBasket } from '@/features/selling/sale/useSaleBasket'
import { useBranchPrices } from '@/features/selling/branchPrices'

type Basket = ReturnType<typeof useSaleBasket>

/** "Top sellers", "All", or a category's id. */
type Tab = 'top' | 'all' | string

const PAGE = 60
/**
 * The products to tap (selling till Step 1, round 3): small name-and-price buttons, three to a row, under
 * category chips - "Top sellers" first, then the company's categories, then "All". The search above narrows
 * these same buttons across every category (owner, 2026-11-16: one way to add, not a separate list).
 */
export function SaleProductGrid({
  basket,
  search,
  searchResults,
  searchAnswered,
  onPick,
  areaId,
  wholeBranch,
}: {
  basket: Basket
  /** What is typed in the search, trimmed; empty when nothing is. */
  search: string
  searchResults: Product[]
  searchAnswered: boolean
  onPick: (product: Product) => void
  /** The area the till sells from: only what it holds (and made-here items) are buttons (walk-through, 2026-11-17). */
  areaId?: string
  /** A table's bill (V99): everything the branch sells, whichever area makes or keeps it. */
  wholeBranch?: boolean
}) {
  const branchPrices = useBranchPrices()
  const { user } = useAuth()
  const canView = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_PRODUCTS)
  const [tab, setTab] = useState<Tab>('all')
  const [shown, setShown] = useState(PAGE)
  useEffect(() => setShown(PAGE), [tab])

  const { categories } = useCompanyCategories(canView)
  const top = useApiQuery<Product[]>({
    // Only products for the branch being worked at (V92).
    queryKey: ['sale-tiles', user?.type === 'tenant' ? user.id : null, viewingBranchId() ?? 'all'],
    queryFn: () => api.get<Product[]>('/api/sales/tiles', { params: { limit: 18, branchId: viewingBranchId() } }).then((r) => r.data),
    fallbackError: "Couldn't load your top sellers.",
    enabled: user?.type === 'tenant',
  })

  // A category, or All: from the copy on the phone when it is ready (works offline), else the server.
  const catalog = useCatalogState()
  const onDevice = catalog.phase === 'ready'
  const listing = tab !== 'top' && search === ''
  const categoryId = tab === 'all' || tab === 'top' ? '' : tab
  const list = useCatalogList(
    // Made-here items (V90) are sold too; only what has a price is a button - ingredients stay off the till, still
    // found by search (walk-through, 2026-11-17).
    {
      search: '',
      status: 'active',
      categoryId,
      stockStatus: 'all',
      price: 'has',
      sort: { field: 'name', direction: 'asc' },
      madeHere: 'include',
    },
    onDevice && listing,
    wholeBranch ? { areaIds: [] } : areaId ? { areaIds: [areaId] } : undefined,
  )
  const server = useProducts(
    { active: true, categoryId: categoryId || undefined, hasSellingPrice: true, size: shown, page: 0, sort: 'name,asc' },
    { enabled: !onDevice && listing },
  )
  const { loadRange } = list
  useEffect(() => {
    if (onDevice && listing) loadRange(0, shown - 1)
  }, [onDevice, listing, loadRange, shown])

  const { products, more } = useMemo(() => {
    if (search !== '') return { products: searchResults, more: false }
    if (tab === 'top') return { products: top.data ?? [], more: false }
    if (onDevice) {
      const rows: Product[] = []
      for (let i = 0; i < Math.min(shown, list.total); i++) {
        const row = list.rowAt(i)
        if (row) rows.push(row)
      }
      return { products: rows, more: list.total > shown }
    }
    return { products: server.data?.content ?? [], more: (server.data?.totalElements ?? 0) > shown }
  }, [search, searchResults, tab, top.data, onDevice, list, shown, server.data])

  // All first and chosen (owner, 2026-11-16); Top sellers next; then the company's categories.
  const chips: { value: Tab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'top', label: 'Top sellers' },
    // Only categories with something to sell at this till (owner, 2026-11-17): not Ingredients, not another
    // branch's or area's. The server's count where the phone has no copy yet.
    ...categories
      .filter((category) =>
        onDevice && list.categoryIds ? list.categoryIds.includes(category.id) : category.productCount > 0,
      )
      .map((category) => ({ value: category.id, label: category.name })),
  ]

  return (
    <section aria-label="Products" className="flex min-w-0 flex-col gap-2">
      {search !== '' ? (
        <p className="text-sm text-neutral-600" aria-live="polite">
          {searchAnswered
            ? searchResults.length === 0
              ? `Nothing matches “${search}”.`
              : `${searchResults.length} ${searchResults.length === 1 ? 'match' : 'matches'} “${search}”`
            : 'Looking…'}
        </p>
      ) : (
        <div role="group" aria-label="Show" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={tab === chip.value}
              onClick={() => setTab(chip.value)}
              className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-sm font-medium whitespace-nowrap ${
                tab === chip.value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {products.length > 0 && (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] lg:gap-2" aria-label="Tap to add">
          {products.map((product) => {
            // Prices per branch (V107): the button says the price at the branch the sale is at.
            const priced = branchPrices.atWorking(product)
            const price = usualPrice(priced, openingUnit(priced, unitsFor(priced, basket.catalogue)))
            const inSale = basket.lines.filter((line) => line.product.id === product.id).reduce((sum, line) => sum + line.quantity, 0)
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onPick(product)}
                  aria-label={`Add ${product.name}${inSale > 0 ? `, ${inSale} in the sale` : ''}`}
                  className={`relative flex min-h-14 w-full flex-col justify-between gap-1 rounded-lg border px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 active:scale-[0.98] lg:min-h-[4.75rem] lg:px-3 lg:py-2.5 ${
                    inSale > 0 ? 'border-primary-200 bg-primary-50' : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <span className="line-clamp-2 text-sm leading-tight font-medium text-neutral-900 lg:text-[0.95rem]">{product.name}</span>
                  <span className="flex items-baseline justify-between gap-1">
                    <span className="text-xs text-neutral-600 tabular-nums lg:text-sm">{price != null ? formatMoney(price) : 'No price'}</span>
                    {inSale > 0 && (
                      <span aria-hidden="true" className="text-xs font-bold text-primary-700 tabular-nums lg:text-sm">
                        × {formatNumber(inSale)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {more && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-primary-700 hover:underline">
          Show more
        </button>
      )}
    </section>
  )
}
