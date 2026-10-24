import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { formatQuantity } from '@/features/products/unitCopy'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import type { Product } from '@/features/products/types'

/**
 * "At other branches" (MULTI_BRANCH_UX_PLAN.md §5.9): how many of this product every other branch the
 * person sees holds. Only what the server sent - a person without "View all branches" is never sent
 * another branch's figure. Beside each, "Send to…" from the branch this phone is at (§5.4), for
 * someone who can send from it. In "All branches" this is the whole list, under the company figure.
 */
export function OtherBranchesList({ product, unitLabel }: { product: Product; unitLabel: string | null | undefined }) {
  const { isMultiBranch, working, isAll, nameOf, recordable, sendTo } = useWorkingBranch()
  const { user } = useAuth()
  const canSend =
    user?.type === 'tenant' &&
    user.permissions.includes(PERMISSIONS.SEND_STOCK) &&
    working != null &&
    recordable.some((branch) => branch.id === working.id)
  if (!isMultiBranch || product.branchStock == null) return null
  const rows = product.branchStock.filter((entry) => isAll || entry.branchId !== working?.id)
  if (rows.length === 0) return null
  // Nothing anywhere else, and nothing on its way there: "Only at Bolade so far" (UX §6, empty).
  const holds = (entry: (typeof rows)[number]) => entry.quantityOnHand > 0 || (entry.onTheWay ?? 0) > 0
  const holders = product.branchStock.filter(holds)
  const here = product.branchStock.find((entry) => entry.branchId === working?.id)
  const onlyAt = isAll
    ? holders.length === 1 ? nameOf(holders[0].branchId) : undefined
    : here && holds(here) && !rows.some(holds) ? working?.name : undefined
  // When each branch last counted it, where the server says (the product page).
  const countedOn = (entry: (typeof rows)[number]) =>
    entry.lastCountedAt ? new Date(entry.lastCountedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null

  return (
    <section aria-labelledby="other-branches-title" className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 id="other-branches-title" className="text-sm font-semibold text-neutral-900">
        {isAll ? 'By branch' : 'At other branches'}
      </h2>
      {here && countedOn(here) && <p className="mt-1 text-xs text-neutral-500">Counted here {countedOn(here)}</p>}
      {onlyAt && (
        <p className="mt-1 text-sm text-neutral-600" data-only-at>
          Only at {onlyAt} so far
        </p>
      )}
      <ul className="mt-2 divide-y divide-neutral-100">
        {rows.map((entry) => {
          const onTheWay = entry.onTheWay ?? 0
          const offerSend = canSend && !isAll && sendTo.some((branch) => branch.id === entry.branchId)
          return (
            <li key={entry.branchId} className="flex flex-col gap-0.5 py-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-neutral-700">{nameOf(entry.branchId) ?? 'Closed branch'}</span>
                <span
                  className={`shrink-0 tabular-nums ${
                    entry.stockStatus === 'OUT' ? 'text-danger-700' : entry.stockStatus === 'LOW' ? 'text-warning-700' : 'text-neutral-900'
                  }`}
                >
                  {formatQuantity(entry.quantityOnHand, unitLabel ?? undefined)}
                  {entry.stockStatus === 'OUT' ? ' · out' : entry.stockStatus === 'LOW' ? ' · low' : ''}
                </span>
              </div>
              {countedOn(entry) && <span className="text-xs text-neutral-500">Counted {countedOn(entry)}</span>}
              {(onTheWay > 0 || offerSend) && (
                <div className="flex items-center justify-between gap-3">
                  {/* Beside the figure, never in it (rule 5). */}
                  <span className="text-xs tabular-nums text-neutral-500">
                    {onTheWay > 0 ? `${formatQuantity(onTheWay, unitLabel ?? undefined)} on the way` : ''}
                  </span>
                  {offerSend && (
                    <Link
                      to={`/app/transfers/send?product=${product.id}&to=${entry.branchId}`}
                      className="-my-2 inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      Send to {nameOf(entry.branchId)}
                    </Link>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
