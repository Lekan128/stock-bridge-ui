import { formatNaira } from '@/utils/money'
import { formatPerUnit } from '@/utils/units'

export interface ProductPriceTagProps {
  price: number
  /** `products.unit_of_measure` — "bag (25kg)", "carton". A wholesale price is meaningless without it. */
  unitOfMeasure?: string | null
  /** Struck-through "was" price. Reserved for promotions; omit when there isn't one. */
  compareAtPrice?: number | null
  size?: 'sm' | 'md' | 'lg'
  /** Stack the unit under the price instead of beside it (product detail pages). */
  layout?: 'inline' | 'stacked'
  className?: string
}

const priceSizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
}

export function ProductPriceTag({
  price,
  unitOfMeasure,
  compareAtPrice,
  size = 'md',
  layout = 'inline',
  className = '',
}: ProductPriceTagProps) {
  const showCompare = compareAtPrice !== null && compareAtPrice !== undefined && compareAtPrice > price

  return (
    <div className={`${layout === 'stacked' ? 'flex flex-col gap-0.5' : 'flex flex-wrap items-baseline gap-x-1.5'} ${className}`}>
      <span className={`font-semibold text-neutral-900 ${priceSizes[size]}`}>{formatNaira(price)}</span>
      <span className="text-xs text-neutral-500">
        {formatPerUnit(unitOfMeasure)}
        {showCompare && (
          <>
            {' · '}
            <s className="text-neutral-400">{formatNaira(compareAtPrice)}</s>
          </>
        )}
      </span>
    </div>
  )
}
