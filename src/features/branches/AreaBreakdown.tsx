import { areaBreakdown } from '@/features/branches/areas'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { formatNumber, formatQuantity } from '@/features/products/unitCopy'
import type { Product } from '@/features/products/types'

/**
 * "Store 30 kg · Kitchen 6 kg" (STOCK_AREAS_PLAN.md §4.3): where in the branch being viewed this
 * product is, under its figure. Areas holding none are left out. Nothing at a branch without areas, or
 * in "All branches" - the breakdown is of one building.
 *
 * `compact` is the Inventory row's form: names and numbers only, the row already says the unit.
 */
export function AreaBreakdown({
  product,
  unitLabel,
  compact = false,
}: {
  product: Product
  unitLabel: string | null | undefined
  compact?: boolean
}) {
  // Optional: the Inventory table is also drawn where no branch is known, and shows no areas there.
  const working = useOptionalWorkingBranch()?.working ?? null
  const parts = areaBreakdown(product, working)
  if (parts.length === 0) return null
  const unit = unitLabel ?? undefined
  if (compact) {
    return (
      <p className="truncate text-xs tabular-nums text-neutral-600" data-area-breakdown>
        {parts.map(({ area, quantity }) => `${area.name} ${formatNumber(quantity)}`).join(' · ')}
      </p>
    )
  }
  return (
    <p className="text-sm tabular-nums text-neutral-700" data-area-breakdown>
      {parts.map(({ area, quantity }, index) => (
        <span key={area.id}>
          {index > 0 && <span className="text-neutral-500"> · </span>}
          <span className="text-neutral-600">{area.name}</span> {formatQuantity(quantity, unit)}
        </span>
      ))}
    </p>
  )
}
