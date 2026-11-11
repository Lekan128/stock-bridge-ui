import type { ReactNode } from 'react'
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { isNetworkMessage } from '@/api/createApiClient'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/Spinner'
import { useRetry } from '@/hooks/useRetry'

export interface ErrorStateProps {
  title?: string
  /** The server's own message where there is one — it is almost always more useful than ours. */
  message?: string | null
  /** Asks again; a promise lets "Trying…" last as long as the attempt (never less than a moment). */
  onRetry?: () => unknown
  retryLabel?: string
  /** Extra escape hatches ("back to the catalog", "contact support"). */
  action?: ReactNode
  /** `inline` is a compact banner above content that is still on screen; `block` is a full panel. */
  variant?: 'block' | 'inline'
  className?: string
}

const DEFAULT_TITLE = 'Something went wrong'
/** U8: a dropped connection is not a fault, and saying "Something went wrong" makes it sound like one. */
const NETWORK_TITLE = "Can't reach the server right now"

/**
 * The counterpart to `EmptyState` for things that *failed* rather than things that are empty
 * (B2, v2: left-aligned, the next step as a sentence and a button). The UX bar requires an error
 * state with a retry on every fetch, and a bare toast is not that.
 *
 * A request that never got an answer is set calm — neutral, a cloud, "Can't reach the server
 * right now" — because nothing is broken and nothing was lost. Red is kept for real failures.
 *
 * `role="alert"` so the failure is announced rather than silently swapped into the layout.
 */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
  action,
  variant = 'block',
  className = '',
}: ErrorStateProps) {
  // "Try again" shows it tried: a spinner at once, for at least a moment, however fast the answer (owner, 2026-11-10).
  const { trying, triedAt, retry } = useRetry(onRetry)
  const network = isNetworkMessage(message)
  const heading = title ?? (network ? NETWORK_TITLE : DEFAULT_TITLE)
  const Icon = network ? CloudOff : TriangleAlert

  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 ${
          network ? 'border-neutral-200 bg-white' : 'border-danger-200 bg-danger-50'
        } ${className}`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${network ? 'text-neutral-500' : 'text-danger-600'}`} aria-hidden="true" />
        <p className={`min-w-0 flex-1 text-sm ${network ? 'text-neutral-700' : 'text-danger-700'}`}>
          {message || heading}
          {triedAt != null && !trying && <span className="text-neutral-500"> · tried again {clock(triedAt)}</span>}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={() => void retry()}
            disabled={trying}
            aria-busy={trying || undefined}
            className={`inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 ${
              network
                ? 'border-neutral-200 text-neutral-700 hover:bg-neutral-50 focus-visible:ring-neutral-400'
                : 'border-danger-200 text-danger-700 hover:bg-danger-50 focus-visible:ring-danger-500'
            }`}
          >
            {trying ? <Spinner size={14} /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            {trying ? 'Trying…' : retryLabel}
          </button>
        )}
        {action}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-2 rounded-lg border bg-white px-5 py-8 text-left sm:px-8 ${
        network ? 'border-neutral-200' : 'border-danger-200'
      } ${className}`}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
        <Icon className={`h-5 w-5 shrink-0 ${network ? 'text-neutral-500' : 'text-danger-600'}`} aria-hidden="true" />
        {heading}
      </h2>
      {message && <p className="max-w-prose text-sm text-neutral-600">{message}</p>}
      {triedAt != null && !trying && <p className="text-sm text-neutral-500">Tried again at {clock(triedAt)}.</p>}
      {(onRetry || action) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onRetry && (
            <Button variant="secondary" onClick={() => void retry()} loading={trying}>
              {!trying && <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              {trying ? 'Trying…' : retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}

/** "22:14": when it last tried. */
function clock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
