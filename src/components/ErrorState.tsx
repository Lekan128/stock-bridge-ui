import type { ReactNode } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/Button'

export interface ErrorStateProps {
  title?: string
  /** The server's own message where there is one — it is almost always more useful than ours. */
  message?: string | null
  onRetry?: () => void
  retryLabel?: string
  /** Extra escape hatches ("back to the catalog", "contact support"). */
  action?: ReactNode
  /** `inline` is a compact banner above content that is still on screen; `block` is a full panel. */
  variant?: 'block' | 'inline'
  className?: string
}

/**
 * The counterpart to `EmptyState` for things that *failed* rather than things that are empty.
 * The UX bar requires an error state with a retry on every fetch, and a bare toast is not that —
 * a toast disappears and leaves the reader looking at a blank region with no way to recover.
 *
 * `role="alert"` so the failure is announced rather than silently swapped into the layout.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  action,
  variant = 'block',
  className = '',
}: ErrorStateProps) {
  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 ${className}`}
      >
        <TriangleAlert className="h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-danger-700">{message || title}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-md border border-danger-200 bg-white px-2.5 py-1.5 text-sm font-medium text-danger-700 hover:bg-danger-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {retryLabel}
          </button>
        )}
        {action}
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-danger-200 bg-white px-6 py-16 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-100 text-danger-600">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-neutral-900">{title}</h2>
      {message && <p className="mt-1 max-w-sm text-sm text-neutral-500">{message}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {retryLabel}
          </Button>
        )}
        {action}
      </div>
    </div>
  )
}
