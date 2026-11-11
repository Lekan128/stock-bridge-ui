import { useApiQuery } from '@/data/useApiQuery'
import { hasAreas } from '@/features/branches/areas'
import { useOptionalWorkingBranch } from '@/features/branches/useWorkingBranch'
import { formatDateTime } from '@/features/marketplace/formatters'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { requestsApi } from '@/features/requests/requestsApi'
import { askedAmount } from '@/features/requests/requestWords'

/**
 * "Asked for, none in the store" (STOCK_AREAS_PART_5.md, §5.4): at the top of the Low stock page, for the people
 * who buy - "The Kitchen needs 2 cartons of tomato paste. The Store has none." Gone once it's moved, the request
 * is cancelled, or it's two weeks old. Nothing at all where there are no areas, or nothing to say.
 */
export function NoneInStorePanel() {
  const branch = useOptionalWorkingBranch()
  const here = branch && !branch.isAll ? branch.working : null
  const withAreas = (here ? [here] : (branch?.branches ?? [])).some((candidate) => hasAreas(candidate))
  const { options } = useUnitOfMeasureOptions()
  const { data } = useApiQuery({
    queryKey: ['stock-requests', 'none-in-store', here?.id ?? 'all'],
    queryFn: () => requestsApi.noneInStoreLines(here?.id),
    fallbackError: "Couldn't load what's been asked for.",
    enabled: withAreas,
  })
  const lines = withAreas ? (data ?? []) : []
  if (lines.length === 0) return null
  return (
    <section aria-labelledby="none-in-store-heading" className="rounded-lg border border-neutral-200 bg-white">
      <h2 id="none-in-store-heading" className="px-4 pt-3 text-sm font-semibold text-neutral-900">
        Asked for, none in the store
      </h2>
      <ul className="divide-y divide-neutral-100">
        {lines.map((line) => (
          <li key={`${line.requestId}-${line.productId}`} className="px-4 py-2.5" data-none-in-store={line.productId}>
            <p className="text-sm text-neutral-900">
              The {line.toAreaName} needs {askedAmount(line, resolveUnitSymbol(line.unitOfMeasure, options))} of{' '}
              {line.productName}. The {line.fromAreaName} has none.
            </p>
            <p className="text-xs text-neutral-600">
              {line.askedByName ? `${line.askedByName} · ` : ''}
              {formatDateTime(line.askedAt)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
