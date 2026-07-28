import { CircleAlert, Trash2, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { QuantityStepper } from '@/components/QuantityStepper'
import type { CartItem } from '@/features/cart/types'
import { ProductImage } from '@/features/products/components/ProductImage'
import { formatNaira } from '@/utils/money'
import { formatPerUnit, formatQuantity } from '@/utils/units'

export interface CartLineRowProps {
  item: CartItem
  onQuantityChange: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
  disabled?: boolean
}

/**
 * One cart line.
 *
 * Two things here are B2B-specific rather than retail habits:
 *
 * `addedByUsername` is shown because the cart is shared by the whole company (contract §8) — a
 * storekeeper builds it and an owner checks out, and "who put 40 crates of oil in here" is a real
 * question someone has to answer before spending the money.
 *
 * An unavailable line is dimmed and badged but never removed automatically. It has to stay
 * visible: it is why checkout is blocked, and the buyer is the one who decides whether to drop it.
 */
export function CartLineRow({ item, onQuantityChange, onRemove, disabled = false }: CartLineRowProps) {
  const moq = item.minOrderQuantity ?? 1
  const unavailable = !item.available
  const shortStock = item.available && item.quantityOnHand > 0 && item.quantity > item.quantityOnHand
  const linkTarget = `/product/${item.slug || item.productId}`

  return (
    <li className={`flex gap-3 py-4 sm:gap-4 ${unavailable ? 'opacity-75' : ''}`}>
      <div className="shrink-0">
        {unavailable ? (
          <ProductImage src={item.imageUrl} alt="" className="h-16 w-16 rounded-md sm:h-20 sm:w-20" />
        ) : (
          <Link
            to={linkTarget}
            className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ProductImage
              src={item.imageUrl}
              alt={item.productName}
              className="h-16 w-16 rounded-md sm:h-20 sm:w-20"
            />
          </Link>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium leading-snug text-neutral-900">
              {unavailable ? (
                <span>{item.productName}</span>
              ) : (
                <Link
                  to={linkTarget}
                  className="rounded hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {item.productName}
                </Link>
              )}
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              {formatNaira(item.unitPrice)} {formatPerUnit(item.unitOfMeasure)}
              {item.productSku ? ` · ${item.productSku}` : ''}
            </p>
            {item.addedByUsername && (
              <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                <UserRound className="h-3 w-3" aria-hidden="true" />
                Added by {item.addedByUsername}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onRemove(item.productId)}
            disabled={disabled}
            aria-label={`Remove ${item.productName} from cart`}
            className="shrink-0 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {unavailable ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="danger">
              <CircleAlert className="h-3 w-3" aria-hidden="true" />
              No longer available
            </Badge>
            <span className="text-xs text-neutral-500">
              Remove it to carry on — it is blocking checkout for the whole cart.
            </span>
          </div>
        ) : (
          <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3">
            <QuantityStepper
              id={`cart-qty-${item.productId}`}
              label={`Quantity of ${item.productName}`}
              value={item.quantity}
              onChange={(quantity) => onQuantityChange(item.productId, quantity)}
              min={moq}
              max={item.quantityOnHand > 0 ? item.quantityOnHand : undefined}
              unitOfMeasure={item.unitOfMeasure}
              disabled={disabled}
              size="sm"
            />
            <p className="text-sm font-semibold text-neutral-900">{formatNaira(item.lineTotal)}</p>
          </div>
        )}

        {shortStock && (
          <p className="mt-1.5 text-xs text-warning-700">
            Only {formatQuantity(item.quantityOnHand, item.unitOfMeasure)} in stock — reduce this line before checkout.
          </p>
        )}
      </div>
    </li>
  )
}
