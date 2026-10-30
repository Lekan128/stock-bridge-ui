import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useApiQuery } from '@/data/useApiQuery'
import { formatDateTime } from '@/features/marketplace/formatters'
import { movesApi } from '@/features/moves/movesApi'
import { formatNumber, pluraliseUnitNoun } from '@/features/products/unitCopy'

const PAGE_SIZE = 25

/**
 * Stock movements' Moves filter (STOCK_AREAS_PART_2.md): every move between the branch's areas, newest
 * first - when, from → to, what, and who. A move is not a ledger row (it changes no branch figure), so it
 * is its own list rather than rows among the deliveries and issues.
 */
export function MovesList({ branchId }: { branchId: string }) {
  const [page, setPage] = useState(0)
  const { data, loading, error, refetch } = useApiQuery({
    queryKey: ['area-moves', 'list', branchId, page],
    queryFn: () => movesApi.list({ branchId, page, size: PAGE_SIZE }),
    fallbackError: "Couldn't load the moves.",
  })
  const moves = data?.content ?? []

  if (error) return <ErrorState title="We could not load the moves" message={error} onRetry={refetch} />
  if (loading && moves.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-md" />
        ))}
      </div>
    )
  }
  if (moves.length === 0) {
    return (
      <EmptyState
        icon={ArrowRight}
        title="Nothing moved between areas yet"
        description="Moves from the Store to the Kitchen, or anywhere else in this branch, show here."
      />
    )
  }
  return (
    <>
      <ul aria-label="Moves between areas" className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {moves.map((move) => (
          <li key={move.id} className="flex flex-col gap-1 px-4 py-3" data-move-row={move.status}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
                {move.fromAreaName}
                <ArrowRight className="h-3.5 w-3.5 text-neutral-500" aria-label="to" />
                {move.toAreaName}
                {!move.toKeepsStock && <span className="font-normal text-neutral-600">(used there)</span>}
                {move.status === 'VOIDED' && <span className="font-normal text-neutral-600">· undone</span>}
              </p>
              <p className="text-xs text-neutral-600">
                {formatDateTime(move.movedAt)}
                {move.movedByName ? ` · ${move.movedByName}` : ''}
              </p>
            </div>
            <p className={`text-sm text-neutral-700 ${move.status === 'VOIDED' ? 'line-through' : ''}`}>
              {move.lines
                .map((line) =>
                  `${line.productName} ${
                    line.enteredQuantity != null && line.enteredUnit
                      ? `${formatNumber(line.enteredQuantity)} ${pluraliseUnitNoun(line.enteredUnit.toLowerCase(), line.enteredQuantity)}`
                      : formatNumber(line.quantity)
                  }`,
                )
                .join(' · ')}
            </p>
            {move.note && <p className="text-xs text-neutral-600">{move.note}</p>}
          </li>
        ))}
      </ul>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </>
  )
}
