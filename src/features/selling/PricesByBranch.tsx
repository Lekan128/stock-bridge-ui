import type { Product } from '@/features/products/types'
import { priceInList, useBranchPrices, type PriceFields } from '@/features/selling/branchPrices'

/**
 * "Prices at each branch" on the product page (BRANCH_PRICES_PLAN.md, V107; owner 2026-11-21): the price at every
 * branch the person has access to and the product is for, or "No price yet", and which branches share. Shown with "Each branch
 * can have its own prices" on and the product at two or more of those branches.
 */
export function PricesByBranch({ product, text }: { product: Product; text: (price: PriceFields) => string | null }) {
  const { on, groups } = useBranchPrices()
  if (!on) return null
  const forBranch = (id: string) => product.forAllBranches !== false || (product.forBranchIds ?? []).includes(id)
  const rows = groups
    .flatMap((group) =>
      group.branches
        .filter((branch) => forBranch(branch.id))
        .map((branch) => {
          const said = text(priceInList(product, group.listId))
          const sharesWith = group.branches.filter((other) => other.id !== branch.id && forBranch(other.id)).map((other) => other.name)
          return { branch, said, sharesWith }
        }),
    )
    .sort((a, b) => Number(b.branch.main) - Number(a.branch.main) || a.branch.name.localeCompare(b.branch.name))
  if (rows.length < 2) return null
  return (
    <section aria-labelledby="branch-prices-title" className="rounded-lg border border-neutral-200 bg-white">
      <h2 id="branch-prices-title" className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-900">
        Prices at each branch
      </h2>
      <ul className="divide-y divide-neutral-100">
        {rows.map((row) => (
          <li key={row.branch.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0 text-neutral-700">
              {row.branch.name}
              {row.branch.main && <span className="ml-1.5 text-xs text-neutral-500">main branch</span>}
            </span>
            <span className="shrink-0 text-right tabular-nums">
              {row.said ? (
                <span className="font-medium text-neutral-900">{row.said}</span>
              ) : (
                <span className="font-medium text-warning-700">No price yet</span>
              )}
              {row.sharesWith.length > 0 && (
                <span className="block text-xs text-neutral-500">shares with {row.sharesWith.join(', ')}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
