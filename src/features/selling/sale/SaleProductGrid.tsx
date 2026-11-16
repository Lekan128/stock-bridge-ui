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

type Basket = ReturnType<typeof useSaleBasket>

/** "Top sellers", "All", or a category's id. */
type Tab = 'top' | 'all' | string

const PAGE = 60
const STRIPES = ['#b42318', '#1d6fb8', '#2f6b2f', '#7a4b16', '#6b3fa0', '#0f766e', '#9a3412', '#3f3f46']

function stripeOf(id: string): string {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return STRIPES[Math.abs(hash) % STRIPES.length]
}

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
}: {
  basket: Basket
  /** What is typed in the search, trimmed; empty when nothing is. */
  search: string
  searchResults: Product[]
  searchAnswered: boolean
  onPick: (product: Product) => void
}) {
  const { user } = useAuth()
  const canView = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.VIEW_PRODUCTS)
  const [tab, setTab] = useState<Tab>('top')
  const [shown, setShown] = useState(PAGE)
  useEffect(() => setShown(PAGE), [tab])

  const { categories } = useCompanyCategories(canView)
  const top = useApiQuery<Product[]>({
    queryKey: ['sale-tiles', user?.type === 'tenant' ? user.id : null],
    queryFn: () => api.get<Product[]>('/api/sales/tiles', { params: { limit: 18 } }).then((r) => r.data),
    fallbackError: "Couldn't load your top sellers.",
    enabled: user?.type === 'tenant',
  })

  // A category, or All: from the copy on the phone when it is ready (works offline), else the server.
  const catalog = useCatalogState()
  const onDevice = catalog.phase === 'ready'
  const listing = tab !== 'top' && search === ''
  const categoryId = tab === 'all' || tab === 'top' ? '' : tab
  const list = useCatalogList(
    { search: '', status: 'active', categoryId, stockStatus: 'all', sort: { field: 'name', direction: 'asc' } },
    onDevice && listing,
  )
  const server = useProducts(
    { active: true, categoryId: categoryId || undefined, size: shown, page: 0, sort: 'name,asc' },
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

  const chips: { value: Tab; label: string }[] = [
    { value: 'top', label: 'Top sellers' },
    ...categories.filter((category) => category.productCount > 0).map((category) => ({ value: category.id, label: category.name })),
    { value: 'all', label: 'All' },
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
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5" aria-label="Tap to add">
          {products.map((product) => {
            const price = usualPrice(product, openingUnit(product, unitsFor(product, basket.catalogue)))
            const inSale = basket.lines.filter((line) => line.product.id === product.id).reduce((sum, line) => sum + line.quantity, 0)
            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onPick(product)}
                  aria-label={`Add ${product.name}${inSale > 0 ? `, ${inSale} in the sale` : ''}`}
                  style={{ borderLeftColor: stripeOf(product.categoryId ?? product.id) }}
                  className="relative flex min-h-14 w-full flex-col justify-center rounded-md border border-l-4 border-neutral-200 bg-white px-2 py-1.5 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 active:scale-[0.98]"
                >
                  <span className="line-clamp-2 text-sm leading-tight font-medium text-neutral-900">{product.name}</span>
                  <span className="text-xs text-neutral-600 tabular-nums">{price != null ? formatMoney(price) : 'No price'}</span>
                  {inSale > 0 && (
                    <span aria-hidden="true" className="absolute -top-1.5 -right-1 min-w-5 rounded-full bg-action px-1 text-center text-xs leading-5 font-bold text-white tabular-nums">
                      {formatNumber(inSale)}
                    </span>
                  )}
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
