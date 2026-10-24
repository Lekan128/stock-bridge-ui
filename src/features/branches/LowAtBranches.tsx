import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import type { Product } from '@/features/products/types'

/**
 * "Low at 2 branches" (MULTI_BRANCH_UX_PLAN.md §5.1): in "All branches" a row is low if it is low at any
 * branch, and this says how widely. Nothing at a branch, or at a one-branch company (rule 1).
 */
export function LowAtBranches({ product }: { product: Product }) {
  const branch = useOptionalWorkingBranch()
  if (!branch?.isMultiBranch || !branch.isAll) return null
  const lowAt = (product.branchStock ?? []).filter((entry) => entry.stockStatus !== 'OK').length
  if (lowAt === 0) return null
  return (
    <span className="text-xs text-warning-700" data-low-at>
      Low at {lowAt} {lowAt === 1 ? 'branch' : 'branches'}
    </span>
  )
}
