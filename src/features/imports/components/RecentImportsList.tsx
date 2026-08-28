import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, FileSpreadsheet, Undo2 } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/Skeleton'
import { useToast } from '@/components/useToast'
import { importsApi, undoBlockedFrom } from '@/features/imports/api/importsApi'
import { UndoBlockedPanel } from '@/features/imports/components/UndoBlockedPanel'
import { KIND_COPY, copy } from '@/features/imports/copy'
import { formatWhen, summariseOutcome } from '@/features/imports/formatters'
import { useRecentImports } from '@/features/imports/hooks/useRecentImports'
import type { ImportKind, ImportSessionSummary, UndoBlockedResponse } from '@/features/imports/types'
import { isAppError } from '@/types/api'

export interface RecentImportsListProps {
  kind?: ImportKind
  /** Suppresses the heading when the caller already has one. */
  bare?: boolean
}

function statusBadge(entry: ImportSessionSummary) {
  switch (entry.status) {
    case 'COMMITTED':
      return null
    case 'EXPIRED':
      return <Badge variant="neutral">{copy.recent.expired}</Badge>
    case 'FAILED':
      return <Badge variant="danger">{copy.recent.failed}</Badge>
    default:
      return <Badge variant="warning">{copy.recent.inProgress}</Badge>
  }
}

/** Where an entry takes you when you click it, derived from status — never held in state. */
function destinationFor(entry: ImportSessionSummary): { to: string; label: string } | null {
  if (entry.status === 'COMMITTED') return { to: `/app/products/import/${entry.id}/result`, label: copy.recent.view }
  if (entry.status === 'EXPIRED' || entry.status === 'FAILED') return null
  return { to: `/app/products/import/${entry.id}`, label: copy.recent.resume }
}

export function RecentImportsList({ kind, bare = false }: RecentImportsListProps) {
  const { items, loading, error, refetch } = useRecentImports(kind)
  const { showToast } = useToast()
  const [pendingUndo, setPendingUndo] = useState<ImportSessionSummary | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [blocked, setBlocked] = useState<{ id: string; response: UndoBlockedResponse } | null>(null)

  async function confirmUndo() {
    if (!pendingUndo) return
    setUndoing(true)
    try {
      await importsApi.undo(pendingUndo.id)
      showToast(copy.result.undoneToast, 'success')
      setBlocked(null)
      setPendingUndo(null)
      refetch()
    } catch (err: unknown) {
      const blockedResponse = undoBlockedFrom(err)
      if (blockedResponse) {
        setBlocked({ id: pendingUndo.id, response: blockedResponse })
      } else {
        showToast(isAppError(err) ? err.message : copy.result.undoFailed, 'error')
      }
      setPendingUndo(null)
    } finally {
      setUndoing(false)
    }
  }

  const heading = bare ? null : (
    <h2 className="text-base font-semibold text-neutral-900">{copy.recent.title}</h2>
  )

  if (loading) {
    return (
      <section className="flex flex-col gap-3">
        {heading}
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </section>
    )
  }

  if (error) {
    return (
      <section className="flex flex-col gap-3">
        {heading}
        <ErrorState variant="inline" message={error} onRetry={refetch} />
      </section>
    )
  }

  if (!items || items.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        {heading}
        <EmptyState icon={Clock} title={copy.recent.empty} description={copy.recent.emptyBody} />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      {heading}
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {items.map((entry) => {
          const destination = destinationFor(entry)
          return (
            <li key={entry.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-900">
                      <span className="truncate">{entry.originalFilename}</span>
                      {statusBadge(entry)}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {KIND_COPY[entry.kind].shortTitle} · {formatWhen(entry.createdAt)} · {summariseOutcome(entry)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {destination && (
                    <Link
                      to={destination.to}
                      className="inline-flex min-h-11 items-center rounded-md px-2 py-1 text-sm font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:min-h-0"
                    >
                      {destination.label}
                    </Link>
                  )}
                  {entry.status === 'COMMITTED' && entry.undoable && (
                    <button
                      type="button"
                      onClick={() => setPendingUndo(entry)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:min-h-0"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.recent.undo}
                    </button>
                  )}
                </div>
              </div>

              {blocked?.id === entry.id && <UndoBlockedPanel blocked={blocked.response} />}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={pendingUndo !== null}
        title={copy.result.undoTitle}
        message={copy.result.undoBody}
        confirmLabel={copy.result.undoConfirm}
        loading={undoing}
        onConfirm={() => void confirmUndo()}
        onCancel={() => setPendingUndo(null)}
      />
    </section>
  )
}
