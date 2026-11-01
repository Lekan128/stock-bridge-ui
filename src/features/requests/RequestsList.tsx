import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Pagination } from '@/components/Pagination'
import { Skeleton } from '@/components/Skeleton'
import { useApiQuery } from '@/data/useApiQuery'
import { formatDateTime } from '@/features/marketplace/formatters'
import { useMoveSheet } from '@/features/moves/useMoveSheet'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { requestsApi } from '@/features/requests/requestsApi'
import { RequestSheet } from '@/features/requests/RequestSheet'
import { askedAmount, lineState, requestState } from '@/features/requests/requestWords'
import type { StockRequest } from '@/features/requests/types'

const PAGE_SIZE = 25

/**
 * Stock movements' Requests (STOCK_AREAS_PART_5.md): what one area asked another for, newest first - who asked,
 * where it stands, each line's state. A row opens the request: Cancel for the asker while nothing has moved, Move
 * them for the area asked.
 */
export function RequestsList({ branchId }: { branchId: string }) {
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<StockRequest | null>(null)
  const moveSheet = useMoveSheet()
  const { options } = useUnitOfMeasureOptions()
  const { data, loading, error, refetch } = useApiQuery({
    queryKey: ['stock-requests', 'list', branchId, page],
    queryFn: () => requestsApi.list({ branchId, page, size: PAGE_SIZE }),
    fallbackError: "Couldn't load the requests.",
  })
  const requests = data?.content ?? []

  if (error) return <ErrorState title="We could not load the requests" message={error} onRetry={refetch} />
  if (loading && requests.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-md" />
        ))}
      </div>
    )
  }
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nothing asked for yet"
        description="When the Kitchen asks the Store for stock, from Move, it shows here."
      />
    )
  }
  return (
    <>
      <ul aria-label="Requests" className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {requests.map((request) => (
          <li key={request.id}>
            <button
              type="button"
              onClick={() => setOpen(request)}
              data-request-row={request.status}
              className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-neutral-50"
            >
              <span className="flex w-full flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium text-neutral-900">
                  {request.toAreaName} asked the {request.fromAreaName}
                </span>
                <span className="text-xs text-neutral-600">
                  {formatDateTime(request.askedAt)}
                  {request.askedByName ? ` · ${request.askedByName}` : ''}
                </span>
              </span>
              {/* Where it stands, on its own line: it reads whole on a phone. */}
              <span
                className={`text-sm ${request.status === 'OPEN' ? 'font-medium text-primary-700' : 'text-neutral-700'}`}
                data-request-state
              >
                {requestState(request)}
              </span>
              <span className="text-sm text-neutral-700">
                {request.lines
                  .map((line) => {
                    const state = lineState(line, request.fromAreaName)
                    return `${line.productName} ${askedAmount(line, resolveUnitSymbol(line.unitOfMeasure, options))}${state ? ` (${state})` : ''}`
                  })
                  .join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      {open && (
        <RequestSheet
          key={open.id}
          request={open}
          onClose={() => setOpen(null)}
          onMove={(request) => {
            setOpen(null)
            moveSheet.openRequest(request)
          }}
        />
      )}
      {moveSheet.sheet}
    </>
  )
}
