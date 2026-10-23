import { formatQuantity } from '@/features/products/unitCopy'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import type { Product } from '@/features/products/types'

/**
 * "At other branches" (MULTI_BRANCH_UX_PLAN.md §5.9): how many of this product every other branch the
 * person sees holds. Only what the server sent - a person without "View all branches" is never sent
 * another branch's figure. "Send to…" arrives with transfers (Phase 2). In "All branches" this is the
 * whole list, under the company figure.
 */
export function OtherBranchesList({ product, unitLabel }: { product: Product; unitLabel: string | null | undefined }) {
  const { isMultiBranch, working, isAll, nameOf } = useWorkingBranch()
  if (!isMultiBranch || product.branchStock == null) return null
  const rows = product.branchStock.filter((entry) => isAll || entry.branchId !== working?.id)
  if (rows.length === 0) return null

  return (
    <section aria-labelledby="other-branches-title" className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 id="other-branches-title" className="text-sm font-semibold text-neutral-900">
        {isAll ? 'By branch' : 'At other branches'}
      </h2>
      <ul className="mt-2 divide-y divide-neutral-100">
        {rows.map((entry) => (
          <li key={entry.branchId} className="flex items-center justify-between py-2 text-sm">
            <span className="text-neutral-700">{nameOf(entry.branchId) ?? 'Closed branch'}</span>
            <span
              className={`tabular-nums ${
                entry.stockStatus === 'OUT' ? 'text-danger-700' : entry.stockStatus === 'LOW' ? 'text-warning-700' : 'text-neutral-900'
              }`}
            >
              {formatQuantity(entry.quantityOnHand, unitLabel ?? undefined)}
              {entry.stockStatus === 'OUT' ? ' · out' : entry.stockStatus === 'LOW' ? ' · low' : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
