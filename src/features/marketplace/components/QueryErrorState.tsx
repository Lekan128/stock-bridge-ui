import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/Button'

export interface QueryErrorStateProps {
  /** The server's message where there is one — it is usually more specific than anything generic. */
  message: string
  onRetry: () => void
  /** What failed, so the operator knows which part of the screen is missing. */
  title?: string
  className?: string
}

/**
 * The one error surface for this feature. A failed load is a state with an action, not a red line
 * of text: the UX bar requires a retry the operator can actually press without reloading the page
 * and losing their filters.
 */
export function QueryErrorState({ message, onRetry, title = 'Something went wrong', className = '' }: QueryErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-danger-800">{title}</p>
          <p className="mt-0.5 text-sm text-danger-700">{message}</p>
        </div>
      </div>
      <Button variant="secondary" onClick={onRetry} className="shrink-0">
        <RotateCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  )
}
