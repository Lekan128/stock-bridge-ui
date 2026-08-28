import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CircleAlert, CircleCheck, Download, Undo2 } from 'lucide-react'
import { Button, buttonClassName } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { useToast } from '@/components/useToast'
import { importsApi, undoBlockedFrom } from '@/features/imports/api/importsApi'
import { ImportPreviewSkeleton } from '@/features/imports/components/ImportSkeletons'
import { ImportStepFrame } from '@/features/imports/components/ImportStepFrame'
import { UndoBlockedPanel } from '@/features/imports/components/UndoBlockedPanel'
import { copy } from '@/features/imports/copy'
import type { ImportResult, UndoBlockedResponse } from '@/features/imports/types'
import { isAppError } from '@/types/api'

/**
 * Step 4 (spec §9.5) — what happened, and the way back.
 *
 * `commit` hands the result over in navigation state, which covers the path everyone actually
 * takes. The refetch behind it is for the refresh and the shared link — see the note on
 * `importsApi.result`, which is additive to the contract and flagged rather than papered over.
 *
 * Undo sits behind a confirm because it is a real write, and its *refusal* is treated as a
 * message rather than an error: a delivery already sold from cannot be un-received without
 * deleting ledger rows, which would defeat the traceability the whole model exists for.
 */
export function ImportResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const { showToast } = useToast()

  const handed = (location.state as { result?: ImportResult } | null)?.result ?? null
  const [result, setResult] = useState<ImportResult | null>(handed)
  const [loading, setLoading] = useState(handed === null)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [undoOpen, setUndoOpen] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [blocked, setBlocked] = useState<UndoBlockedResponse | null>(null)
  const [downloadingReport, setDownloadingReport] = useState(false)

  async function handleDownloadReport() {
    if (!sessionId) return
    setDownloadingReport(true)
    try {
      await importsApi.downloadReport(sessionId)
    } catch {
      showToast('We could not fetch that report. Please try again.', 'error')
    } finally {
      setDownloadingReport(false)
    }
  }

  useEffect(() => {
    if (!sessionId || handed) return
    let cancelled = false
    setLoading(true)
    setError(null)

    importsApi
      .result(sessionId)
      .then((response) => {
        if (!cancelled) setResult(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : 'We could not load this import.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, handed, reloadToken])

  async function handleUndo() {
    if (!sessionId) return
    setUndoing(true)
    setBlocked(null)
    try {
      const undone = await importsApi.undo(sessionId)
      setResult(undone)
      showToast(copy.result.undoneToast, 'success')
      setUndoOpen(false)
    } catch (err: unknown) {
      const blockedResponse = undoBlockedFrom(err)
      if (blockedResponse) {
        setBlocked(blockedResponse)
      } else {
        showToast(isAppError(err) ? err.message : copy.result.undoFailed, 'error')
      }
      setUndoOpen(false)
    } finally {
      setUndoing(false)
    }
  }

  if (loading) {
    return (
      <ImportStepFrame step={2} title={copy.steps.confirm}>
        <ImportPreviewSkeleton />
      </ImportStepFrame>
    )
  }

  if (error || !result) {
    return (
      <ImportStepFrame step={2} title={copy.steps.confirm}>
        <ErrorState
          message={error}
          onRetry={() => setReloadToken((token) => token + 1)}
          action={
            <Link to="/app/products/import" className={buttonClassName('secondary')}>
              {copy.result.importAnother}
            </Link>
          }
        />
      </ImportStepFrame>
    )
  }

  // A commit that blew up part-way rolls back and lands here with a real, readable result whose
  // every count is zero. It is not a success and must not wear a success's chrome: a green tick
  // over "This import could not be completed" is the screen contradicting its own headline, and
  // "View products" would send the reader off to a list of nothing. The lines the server wrote
  // already say the right thing; only the frame around them was lying.
  const failed = result.status === 'FAILED'

  return (
    <ImportStepFrame step={3} title={result.headline}>
      <div className="flex flex-col gap-6">
        <div
          className={
            failed
              ? 'flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-4'
              : 'flex items-start gap-3 rounded-lg border border-accent-200 bg-accent-50 px-4 py-4'
          }
        >
          {failed ? (
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
          ) : (
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden="true" />
          )}
          <dl className="flex flex-col gap-1">
            {result.lines.map((line) => (
              <div key={line.key} className="flex flex-wrap gap-x-2 text-sm">
                <dt className={failed ? 'font-semibold text-warning-800' : 'font-semibold text-accent-800'}>
                  {line.label}
                </dt>
                <dd className={failed ? 'text-warning-700' : 'text-accent-700'}>{line.text}</dd>
              </div>
            ))}
          </dl>
        </div>

        {blocked && <UndoBlockedPanel blocked={blocked} />}

        <div className="flex flex-wrap items-center gap-2">
          {!failed && (
            <Link to={result.targetUrl} className={buttonClassName('primary')}>
              {copy.result.viewProducts}
            </Link>
          )}
          {/* A button, not an `<a href>`: the report is an authenticated binary and the bearer
            token lives in memory, so a plain link would answer 401. `downloadReport` fetches it
            through the authed client and saves it from an object URL. */}
          <Button variant="secondary" loading={downloadingReport} onClick={() => void handleDownloadReport()}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {copy.result.downloadReport}
          </Button>
          {result.undoable ? (
            <Button variant="secondary" onClick={() => setUndoOpen(true)}>
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              {copy.result.undo}
            </Button>
          ) : (
            <p className="text-sm text-neutral-500">{result.undoBlockedReason ?? copy.result.notUndoable}</p>
          )}
        </div>

        <p className="text-xs text-neutral-500">{copy.result.reportHint}</p>

        <div>
          <Link
            to="/app/products/import"
            className="rounded-md text-sm font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {copy.result.importAnother}
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={undoOpen}
        title={copy.result.undoTitle}
        message={copy.result.undoBody}
        confirmLabel={copy.result.undoConfirm}
        loading={undoing}
        onConfirm={() => void handleUndo()}
        onCancel={() => setUndoOpen(false)}
      />
    </ImportStepFrame>
  )
}
