import { useRef } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { expectedCopy } from '@/features/expected/copy'
import { IncomingStockBadge } from '@/features/products/components/IncomingStockBadge'
import { StockBar } from '@/features/products/components/StockBar'
import { StockFigure } from '@/features/products/components/StockFigure'
import type { ProductQuickActions } from '@/features/products/components/ProductTable'
import { ProductImage } from '@/features/products/components/ProductImage'
import { StatusBadge } from '@/features/products/components/StatusBadge'
import { formatUnitOfMeasure } from '@/features/products/formatters'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { packEquivalent } from '@/features/products/packEquivalent'
import type { Product } from '@/features/products/types'
import { formatNumber } from '@/features/products/unitCopy'
import { resolveUnitSymbol } from '@/features/products/unitSet'

export interface ProductCardProps {
  product: Product
  /** Units bought from ProcurePal and not yet received. Rendered as pending, never as available. */
  incoming?: number
  /** Quick stock in / out from the card itself (C1, finding U2). */
  quickActions?: ProductQuickActions
  /**
   * Selection on a phone (C1, finding U4: adapted, not amputated): a long press starts it with
   * this card ticked; while it is on, a tap ticks or unticks instead of opening the product.
   */
  selection?: { active: boolean; selected: boolean; onToggle: () => void; onLongPress: () => void }
}

const LONG_PRESS_MS = 500
/** A finger that moves further than this is scrolling, not pressing. */
const PRESS_SLOP_PX = 10

export function ProductCard({ product, incoming = 0, quickActions, selection }: ProductCardProps) {
  // Module-cached list (see the hook), so a page of cards shares one fetch.
  const { options: unitOfMeasureOptions } = useUnitOfMeasureOptions()
  const packLine = packEquivalent(product, unitOfMeasureOptions)
  const unit = resolveUnitSymbol(product.unitOfMeasure, unitOfMeasureOptions)
  const label = (code: string | undefined) => unitOfMeasureOptions.find((option) => option.code === code)?.label
  const pack =
    product.unitOfMeasure || product.packagingUnit || product.packagingSize != null
      ? formatUnitOfMeasure(label(product.unitOfMeasure), label(product.packagingUnit), product.packagingSize)
      : null
  const subtitle = [product.categoryName, pack].filter(Boolean).join(' · ') || product.sku
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)
  const longPressed = useRef(false)
  const selecting = selection?.active ?? false
  const showQuick = !selecting && quickActions != null && (quickActions.canStockIn || quickActions.canStockOut)

  function cancelPress() {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
  }

  return (
    <div
      data-product-row={product.id}
      onPointerDown={(event) => {
        if (!selection || event.pointerType === 'mouse') return
        longPressed.current = false
        const { clientX: x, clientY: y } = event
        press.current = {
          x,
          y,
          timer: window.setTimeout(() => {
            longPressed.current = true
            press.current = null
            navigator.vibrate?.(15)
            if (!selecting) selection.onLongPress()
          }, LONG_PRESS_MS),
        }
      }}
      onPointerMove={(event) => {
        if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > PRESS_SLOP_PX) {
          cancelPress()
        }
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(event) => {
        // A long press on a link opens the browser's own menu on Android; here it selects.
        if (selection) event.preventDefault()
      }}
      className={`relative flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm transition-colors select-none hover:bg-neutral-50 ${
        selection?.selected ? 'border-primary-300 bg-primary-50' : 'border-neutral-200'
      }`}
    >
      {selecting && (
        <input
          type="checkbox"
          checked={selection?.selected ?? false}
          onChange={() => selection?.onToggle()}
          aria-label={`Select ${product.name}`}
          className="relative z-10 mt-4 h-5 w-5 shrink-0 cursor-pointer rounded-sm border-neutral-300 accent-primary-600"
        />
      )}
      <ProductImage src={product.imageUrl} alt={product.name} className="h-12 w-12 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          {/* The whole card opens the product (the link's hit area is stretched over it), except
              while selecting, when a tap ticks it instead. */}
          <Link
            to={`/app/products/${product.id}`}
            data-row-link
            draggable={false}
            onClick={(event) => {
              if (longPressed.current || selecting) {
                event.preventDefault()
                if (selecting && !longPressed.current) selection?.onToggle()
                longPressed.current = false
              }
            }}
            className="truncate text-sm font-medium text-neutral-900 outline-none [-webkit-touch-callout:none] before:absolute before:inset-0 before:content-[''] focus-visible:underline"
          >
            {product.name}
          </Link>
          {!product.active && <StatusBadge active={false} />}
        </div>
        {/* Category and pack, as on the laptop table; the SKU when there is neither. */}
        <p className="mt-0.5 truncate text-xs text-neutral-500">{subtitle}</p>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
          {/* "usable" is spelled out rather than implied — this is the line someone reads before
              deciding whether they can fulfil an order today, and "12 on hand · +20 incoming" must
              never be misread as 32. The figure is the same component as the table's (B2). */}
          <div className="flex flex-col gap-1">
            <StockFigure quantity={product.quantityOnHand} unit={unit} pack={packLine} productId={product.id} label="usable" />
            {/* On an open expected delivery (task 3.1) — a promise, not stock. Quiet, and never
                summed into the figure above. */}
            {product.expectedQuantity != null && product.expectedQuantity > 0 && (
              <span className="text-xs text-neutral-500">
                <span aria-hidden="true">{expectedCopy.product.coming(formatNumber(product.expectedQuantity))}</span>
                <span className="sr-only">{expectedCopy.product.comingAria(formatNumber(product.expectedQuantity))}</span>
              </span>
            )}
          </div>
          <StockBar quantity={product.quantityOnHand} threshold={product.lowStockThreshold} low={product.isLowStock} unit={unit} />
          <IncomingStockBadge quantity={incoming} />
        </div>
      </div>
      {showQuick && (
        // Lifted above the stretched link; 40px targets for a thumb.
        <div className="relative z-10 flex shrink-0 flex-col gap-1.5 self-center">
          {quickActions.canStockIn && (
            <button
              type="button"
              aria-label={`Stock in ${product.name}`}
              onClick={() => quickActions.onAction('in', product)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 active:bg-neutral-100"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {quickActions.canStockOut && (
            <button
              type="button"
              aria-label={`Stock out ${product.name}`}
              onClick={() => quickActions.onAction('out', product)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 active:bg-neutral-100"
            >
              <Minus className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
