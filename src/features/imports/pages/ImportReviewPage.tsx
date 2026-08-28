import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Clock, Columns3, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/useToast'
import { importsApi } from '@/features/imports/api/importsApi'
import { CleanFileSummary } from '@/features/imports/components/CleanFileSummary'
import { ColumnMappingPanel } from '@/features/imports/components/ColumnMappingPanel'
import { ImportReviewSkeleton } from '@/features/imports/components/ImportSkeletons'
import { ImportStepFrame } from '@/features/imports/components/ImportStepFrame'
import { ReviewCounters } from '@/features/imports/components/ReviewCounters'
import { ReviewGrid } from '@/features/imports/components/ReviewGrid'
import { RowIssueCards } from '@/features/imports/components/RowIssueCards'
import { ValueResolutionPanel } from '@/features/imports/components/ValueResolutionPanel'
import { MOBILE_BREAKPOINT_QUERY } from '@/features/imports/constants'
import { copy } from '@/features/imports/copy'
import { useImportRows, type RowFilter } from '@/features/imports/hooks/useImportRows'
import { useImportSession } from '@/features/imports/hooks/useImportSession'
import { useRowMutations } from '@/features/imports/hooks/useRowMutations'
import { visibleFields } from '@/features/imports/reviewColumns'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Pagination } from '@/components/Pagination'
import { isAppError } from '@/types/api'

/**
 * Step 2 — this screen is the whole feature (spec §9.3).
 *
 * The justification for the entire pipeline is that today a user with four bad rows out of three
 * hundred has to go back to Excel and re-upload. Everything on this page exists to make that
 * unnecessary, and the two rules that matter most pull in opposite directions:
 *
 *  - For the majority — clean files — this must be almost nothing. One green line and a button.
 *    A correct file that is made to scroll a grid has been charged a toll for being correct.
 *  - For the minority, it must be enough to finish the job here: the offending cell outlined
 *    with its message and editor in place, one decision that fixes every row sharing a value,
 *    and the option to stop and come back.
 *
 * So the grid is the exception rendering, mounted only when something is wrong — and never
 * below 768px, where stacked cards replace it entirely (contract §8.2, §8.5).
 */
export function ImportReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT_QUERY)

  const { session, loading, error, apply, refetch, refresh } = useImportSession(sessionId)
  const [filter, setFilter] = useState<RowFilter>('ALL')
  const [filterChosen, setFilterChosen] = useState(false)
  const [page, setPage] = useState(0)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [mappingSaving, setMappingSaving] = useState(false)
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [discarding, setDiscarding] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  const {
    rows,
    totalPages,
    loading: rowsLoading,
    error: rowsError,
    applyRow,
    refetch: refetchRows,
  } = useImportRows(sessionId, filter, page)

  const mutations = useRowMutations(sessionId, { applyRow, applySession: apply })

  // "Issues" is the default view when there is anything to act on, "All" when there isn't —
  // nobody scrolls three hundred rows looking for red (spec §9.3).
  useEffect(() => {
    if (!session || filterChosen) return
    setFilter(session.errorCount > 0 || session.warningCount > 0 ? 'ISSUES' : 'ALL')
    setFilterChosen(true)
  }, [session, filterChosen])

  if (loading) {
    return (
      <ImportStepFrame step={1} title={copy.steps.review}>
        <ImportReviewSkeleton />
      </ImportStepFrame>
    )
  }

  if (error || !session) {
    return (
      <ImportStepFrame step={1} title={copy.steps.review}>
        <ErrorState title={copy.review.loadFailed} message={error} onRetry={refetch} />
      </ImportStepFrame>
    )
  }

  // Status decides the step, always — so a refresh or a shared link lands where it should
  // (contract §7). Held nowhere in component state.
  if (session.status === 'COMMITTED' || session.status === 'COMMITTING') {
    return <Navigate to={`/app/products/import/${session.id}/result`} replace />
  }

  if (session.status === 'EXPIRED') {
    return (
      // The heading keeps the filename so the reader knows *which* upload lapsed; the panel
      // below carries the "expired" message, rather than saying it twice.
      <ImportStepFrame step={1} title={copy.review.title(session.originalFilename)}>
        <EmptyState
          icon={Clock}
          title={copy.review.expiredTitle}
          description={copy.review.expiredBody}
          action={
            <Link
              to="/app/products/import"
              className="rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {copy.result.importAnother}
            </Link>
          }
        />
      </ImportStepFrame>
    )
  }

  if (session.status === 'FAILED') {
    return (
      <ImportStepFrame step={1} title={copy.review.failedTitle}>
        <ErrorState
          title={copy.review.failedTitle}
          message={copy.review.failedBody}
          action={
            <Link
              to="/app/products/import"
              className="rounded-md border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {copy.result.importAnother}
            </Link>
          }
        />
      </ImportStepFrame>
    )
  }

  if (session.status === 'PARSING') {
    return (
      <ImportStepFrame step={1} title={copy.review.parsing} subtitle={copy.review.parsingBody}>
        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-6">
          <Spinner size={20} className="text-primary-600" />
          <p className="text-sm text-neutral-600">{copy.review.parsing}</p>
        </div>
      </ImportStepFrame>
    )
  }

  async function handleMapping(columnMapping: Record<string, string | null>) {
    if (!sessionId) return
    setMappingSaving(true)
    setMappingError(null)
    try {
      apply(await importsApi.patchMapping(sessionId, columnMapping))
      refetchRows()
    } catch (err: unknown) {
      setMappingError(isAppError(err) ? err.message : copy.mapping.saveFailed)
    } finally {
      setMappingSaving(false)
    }
  }

  async function handleDiscard() {
    if (!sessionId) return
    setDiscarding(true)
    try {
      await importsApi.discard(sessionId)
      showToast(copy.review.discardedToast, 'info')
      navigate('/app/products/import', { replace: true })
    } catch (err: unknown) {
      showToast(isAppError(err) ? err.message : copy.review.editFailed, 'error')
      setDiscarding(false)
      setDiscardOpen(false)
    }
  }

  // `== null`, not `=== null`: an unanswered question arrives with `resolution` ABSENT, because
  // the API omits null fields entirely. Against `=== null` this counted zero every time, which
  // made `isClean` true for a file whose only problem was three suppliers nobody had matched —
  // and `isClean` renders the green summary INSTEAD of the resolution panel. The questions
  // disappeared and Continue imported rows whose supplier was never resolved, which is precisely
  // the silent drop §8.8 exists to forbid.
  const unresolvedCount = session.unresolvedValues.filter((value) => value.resolution == null).length
  const isClean =
    !session.needsMapping && session.errorCount === 0 && session.warningCount === 0 && unresolvedCount === 0
  const canContinue = session.errorCount === 0 && !session.needsMapping
  const fields = showAllColumns ? session.fields : visibleFields(session.fields, rows)

  return (
    <ImportStepFrame step={1} title={copy.review.title(session.originalFilename)}>
      <div className="flex flex-col gap-5">
        {session.needsMapping && (
          <ColumnMappingPanel
            session={session}
            saving={mappingSaving}
            error={mappingError}
            onSave={(mapping) => void handleMapping(mapping)}
          />
        )}

        {!session.needsMapping && (
          <>
            {isClean ? (
              <CleanFileSummary session={session} />
            ) : (
              <>
                <ReviewCounters
                  session={session}
                  filter={filter}
                  onFilterChange={(next) => {
                    setFilter(next)
                    setFilterChosen(true)
                    setPage(0)
                  }}
                  showFilter
                />

                <ValueResolutionPanel
                  session={session}
                  isValueBusy={mutations.isValueBusy}
                  onResolve={async (body, affected) => {
                    const ok = await mutations.resolveValue(body, affected)
                    if (ok) refetchRows()
                    return ok
                  }}
                />

                {rowsError && <ErrorState variant="inline" message={rowsError} onRetry={refetchRows} />}

                {rowsLoading && <ImportReviewSkeleton />}

                {!rowsLoading && !rowsError && rows.length === 0 && (
                  <EmptyState
                    tone="positive"
                    title={filter === 'ISSUES' ? copy.review.noIssues : copy.review.noRows}
                    description={filter === 'ISSUES' ? copy.review.noIssuesBody : undefined}
                  />
                )}

                {!rowsLoading && !rowsError && rows.length > 0 && (
                  <>
                    {isMobile ? (
                      <RowIssueCards
                        fields={session.fields}
                        rows={rows}
                        isRowBusy={mutations.isRowBusy}
                        isValueBusy={mutations.isValueBusy}
                        onEdit={(row, column, value) => {
                          void mutations.editCell(row, column, value).then(refresh)
                        }}
                        onBulkFix={(row, column, value, count) => {
                          void mutations
                            .resolveValue(
                              {
                                column,
                                from: String(row.raw[column] ?? ''),
                                to: { kind: 'LITERAL', value },
                              },
                              count,
                            )
                            .then((ok) => ok && refetchRows())
                        }}
                        onToggleSkip={(row, skipped) => {
                          void mutations.toggleSkip(row, skipped).then(refresh)
                        }}
                      />
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-neutral-500">
                            {showAllColumns
                              ? copy.review.columnsNote(session.fields.length, session.fields.length)
                              : copy.review.columnsNote(fields.length, session.fields.length)}
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowAllColumns((current) => !current)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          >
                            <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
                            {showAllColumns ? copy.review.showFewerColumns : copy.review.showAllColumns}
                          </button>
                        </div>

                        <ReviewGrid
                          fields={fields}
                          rows={rows}
                          isRowBusy={mutations.isRowBusy}
                          isValueBusy={mutations.isValueBusy}
                          onEdit={(row, column, value) => {
                            void mutations.editCell(row, column, value).then(refresh)
                          }}
                          onBulkFix={(row, column, value, count) => {
                            void mutations
                              .resolveValue(
                                {
                                  column,
                                  from: String(row.raw[column] ?? ''),
                                  to: { kind: 'LITERAL', value },
                                },
                                count,
                              )
                              .then((ok) => ok && refetchRows())
                          }}
                          onToggleSkip={(row, skipped) => {
                            void mutations.toggleSkip(row, skipped).then(refresh)
                          }}
                        />
                      </>
                    )}

                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                  </>
                )}
              </>
            )}

            <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.review.retention}
              </p>

              {!canContinue && (
                <p role="status" className="flex items-center gap-1.5 text-sm text-danger-700">
                  <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  {copy.review.continueBlocked(session.errorCount)}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDiscardOpen(true)}
                  className="inline-flex min-h-11 items-center rounded-md px-2 py-1.5 text-sm font-medium text-neutral-500 underline underline-offset-2 hover:text-danger-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:min-h-0"
                >
                  {copy.review.discard}
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      showToast(copy.review.savedToast, 'success')
                      navigate('/app/products/import')
                    }}
                  >
                    {copy.review.saveForLater}
                  </Button>
                  <Button
                    disabled={!canContinue}
                    onClick={() => navigate(`/app/products/import/${session.id}/confirm`)}
                  >
                    {copy.review.continue}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={discardOpen}
        title={copy.review.discardTitle}
        message={copy.review.discardBody}
        confirmLabel={copy.review.discardConfirm}
        loading={discarding}
        onConfirm={() => void handleDiscard()}
        onCancel={() => setDiscardOpen(false)}
      />
    </ImportStepFrame>
  )
}
