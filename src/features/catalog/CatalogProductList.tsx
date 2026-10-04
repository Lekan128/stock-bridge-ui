import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { CatalogList } from '@/features/catalog/useCatalog'
import { ProductCard } from '@/features/products/components/ProductCard'
import {
  ProductTable,
  type ProductSort,
  type ProductSortField,
  type ProductTableSelection,
} from '@/features/products/components/ProductTable'
import type { Product } from '@/features/products/types'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export interface CatalogProductListProps {
  list: CatalogList
  sort: ProductSort
  onSortChange: (field: ProductSortField) => void
  selection?: ProductTableSelection
  /** The rows currently rendered — what "select every product shown" ticks. */
  onRenderedChange?: (products: Product[]) => void
}

/** Starting guesses; every rendered row is then measured. */
const ROW_ESTIMATE_PX = 58
const CARD_ESTIMATE_PX = 104

/**
 * The Inventory list read from the on-device catalogue (A3): the whole catalogue as one scrolling
 * list instead of 20-row pages, with only the rows near the screen rendered — so 100,000 products
 * scroll as smoothly as 20. Scrolls with the workspace's own scroll area rather than a box inside
 * it, so the page behaves exactly as it did.
 */
export function CatalogProductList({ list, sort, onSortChange, selection, onRenderedChange }: CatalogProductListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollElement] = useState<HTMLElement | null>(() =>
    document.querySelector<HTMLElement>('[data-scroll-container]'),
  )
  // Where the list starts inside the scroll area; banners and the toolbar above it move it.
  // Re-measured after every render on purpose — a banner appearing changes it without changing
  // anything this component holds — and only stored when it actually moved, so it settles at once.
  const [scrollMargin, setScrollMargin] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!containerRef.current || !scrollElement) return
    const offset =
      containerRef.current.getBoundingClientRect().top -
      scrollElement.getBoundingClientRect().top +
      scrollElement.scrollTop
    if (Math.abs(offset - scrollMargin) > 1) setScrollMargin(offset)
  })

  const virtualizer = useVirtualizer({
    count: list.total,
    getScrollElement: () => scrollElement,
    estimateSize: () => (isDesktop ? ROW_ESTIMATE_PX : CARD_ESTIMATE_PX),
    overscan: 8,
    scrollMargin,
  })

  const items = virtualizer.getVirtualItems()
  const first = items[0]?.index ?? 0
  const last = items[items.length - 1]?.index ?? 0
  const { loadRange } = list
  useEffect(() => {
    if (items.length > 0) loadRange(first, last)
  }, [first, last, items.length, loadRange])

  // Only rows already fetched from the worker are drawn; the spacers stand in for the rest.
  const shown = items.flatMap((item) => {
    const product = list.rowAt(item.index)
    return product ? [{ item, product }] : []
  })
  const products = shown.map((entry) => entry.product)
  const paddingTop = shown.length > 0 ? shown[0].item.start - scrollMargin : 0
  const paddingBottom =
    shown.length > 0 ? virtualizer.getTotalSize() - (shown[shown.length - 1].item.end - scrollMargin) : virtualizer.getTotalSize()

  const renderedKey = products.map((product) => product.id).join(',')
  useEffect(() => {
    onRenderedChange?.(products)
    // `renderedKey` stands in for `products` (a fresh array each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderedKey, onRenderedChange])

  return (
    <div ref={containerRef}>
      {isDesktop ? (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <ProductTable
            products={products}
            sort={sort}
            onSortChange={onSortChange}
            incomingFor={(product) => ({ quantity: product.incomingQuantity ?? 0 })}
            selection={selection}
            virtual={{
              paddingTop,
              paddingBottom,
              indices: shown.map((entry) => entry.item.index),
              measureRef: virtualizer.measureElement,
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col">
          {paddingTop > 0 && <div style={{ height: paddingTop }} aria-hidden="true" />}
          {shown.map(({ item, product }) => (
            <div key={product.id} ref={virtualizer.measureElement} data-index={item.index} className="pb-2">
              <ProductCard product={product} incoming={product.incomingQuantity ?? 0} />
            </div>
          ))}
          {paddingBottom > 0 && <div style={{ height: paddingBottom }} aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}
