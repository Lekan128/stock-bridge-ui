import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/Button'
import { ErrorState } from '@/components/ErrorState'
import { importsApi } from '@/features/imports/api/importsApi'
import { ImportPreviewSkeleton } from '@/features/imports/components/ImportSkeletons'
import { ImportStepFrame } from '@/features/imports/components/ImportStepFrame'
import { copy } from '@/features/imports/copy'
import { useImportSession } from '@/features/imports/hooks/useImportSession'
import type { CommitPreview } from '@/features/imports/types'
import { isAppError } from '@/types/api'

/**
 * Step 3 (spec §9.4) — read-only prose, not a form to refill.
 *
 * The user already typed all of this into a spreadsheet. Handing them inputs again at the last
 * step is the mistake §5.1 spends a page rejecting, so every line here is text: label on the
 * left, the server's own sentence on the right.
 *
 * The button says what it does. "Import 42 rows", never "Confirm" — and the label comes from
 * `confirmLabel` rather than being assembled here, so the two import kinds read alike and the
 * count in the button is the same count the backend is about to act on.
 *
 * The Stock line matters: an import now writes to the ledger (spec §3), and nobody should learn
 * that afterwards.
 */
export function ImportConfirmPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { session } = useImportSession(sessionId)

  const [preview, setPreview] = useState<CommitPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    importsApi
      .preview(sessionId)
      .then((response) => {
        if (!cancelled) setPreview(response)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(isAppError(err) ? err.message : copy.confirm.loadFailed)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, reloadToken])

  async function handleCommit() {
    if (!sessionId) return
    setCommitting(true)
    setCommitError(null)
    try {
      const result = await importsApi.commit(sessionId)
      navigate(`/app/products/import/${sessionId}/result`, { replace: true, state: { result } })
    } catch (err: unknown) {
      setCommitError(isAppError(err) ? err.message : copy.confirm.failed)
      setCommitting(false)
    }
  }

  return (
    <ImportStepFrame
      step={2}
      title={preview?.headline ?? copy.steps.confirm}
      onStepClick={(index) => {
        if (index === 1 && sessionId) navigate(`/app/products/import/${sessionId}`)
      }}
    >
      {loading && <ImportPreviewSkeleton />}

      {!loading && error && (
        <ErrorState title={copy.confirm.loadFailed} message={error} onRetry={() => setReloadToken((t) => t + 1)} />
      )}

      {!loading && !error && preview && (
        <div className="flex flex-col gap-6">
          <dl className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {preview.lines.map((line) => (
              <div key={line.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6">
                <dt className="text-sm font-semibold text-neutral-500 sm:w-32 sm:shrink-0">{line.label}</dt>
                <dd className="text-sm text-neutral-800">{line.text}</dd>
              </div>
            ))}
          </dl>

          <p className="text-sm text-neutral-500">
            {session?.kind === 'STOCK_IN' ? copy.confirm.reassureStockIn : copy.confirm.reassure}
          </p>

          {preview.blocked && preview.blockedReason && (
            <ErrorState variant="inline" title={copy.confirm.blockedTitle} message={preview.blockedReason} />
          )}

          {commitError && <ErrorState variant="inline" message={commitError} />}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate(`/app/products/import/${sessionId}`)}
              disabled={committing}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {copy.confirm.back}
            </Button>
            <Button loading={committing} disabled={preview.blocked} onClick={() => void handleCommit()}>
              {committing ? copy.confirm.working : preview.confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </ImportStepFrame>
  )
}
