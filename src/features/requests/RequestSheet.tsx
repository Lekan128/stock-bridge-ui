import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/useToast'
import { formatDateTime } from '@/features/marketplace/formatters'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { resolveUnitSymbol } from '@/features/products/unitSet'
import { requestsApi } from '@/features/requests/requestsApi'
import { askedAmount, askedFor, lineState, requestState } from '@/features/requests/requestWords'
import type { StockRequest } from '@/features/requests/types'
import { isAppError } from '@/types/api'

/**
 * One request, as the person who asked sees it (STOCK_AREAS_PART_5.md) - from the bell's "The Store moved the 2
 * items you asked for", or the Requests list: what was asked, where each line stands, and **Cancel** while nothing
 * has moved. Someone who can fill it gets **Move them** instead, which opens Move filled.
 */
export function RequestSheet({
  request,
  onClose,
  onMove,
}: {
  request: StockRequest
  onClose: () => void
  /** Opens Move filled from this request; absent where there's no Move to open. */
  onMove?: (request: StockRequest) => void
}) {
  const { options } = useUnitOfMeasureOptions()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const canMove = request.canFill && request.status === 'OPEN' && onMove != null

  async function cancel() {
    setBusy(true)
    setProblem(null)
    try {
      await requestsApi.cancel(request.id)
      await queryClient.invalidateQueries({ queryKey: ['stock-requests'] })
      onClose()
      showToast(`Cancelled · nothing more is asked of the ${request.fromAreaName}`, 'info')
    } catch (error) {
      setProblem(isAppError(error) ? error.message : "Couldn't cancel this. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={askedFor(request)}
      size="md"
      footer={
        canMove ? (
          <Button variant="action" className="w-full" onClick={() => onMove(request)}>
            Move them
          </Button>
        ) : request.canCancel ? (
          <Button variant="secondary" className="w-full" loading={busy} onClick={() => void cancel()}>
            Cancel this request
          </Button>
        ) : null
      }
    >
      <div className="flex flex-col gap-4" data-request-sheet={request.id}>
        <p className="text-sm text-neutral-600">
          Asked of the {request.fromAreaName}
          {request.askedByName ? ` by ${request.askedByName}` : ''} · {formatDateTime(request.askedAt)}
          <br />
          <span className="font-medium text-neutral-800" data-request-state>
            {requestState(request)}
          </span>
        </p>
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {request.lines.map((line) => {
            const state = lineState(line, request.fromAreaName)
            return (
              <li key={line.productId} className="flex items-baseline justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0 truncate text-base text-neutral-900">{line.productName}</span>
                <span className="shrink-0 text-sm text-neutral-600">
                  {askedAmount(line, resolveUnitSymbol(line.unitOfMeasure, options))}
                  {state ? ` · ${state}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
        {request.note && <p className="text-sm text-neutral-700">{request.note}</p>}
        {problem && (
          <p role="alert" className="text-sm text-danger-700">
            {problem}
          </p>
        )}
      </div>
    </Sheet>
  )
}
