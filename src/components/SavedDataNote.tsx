import { CloudOff } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useRetry } from '@/hooks/useRetry'

export interface SavedDataNoteProps {
  /** Whether what's on screen is a saved copy the latest refresh couldn't replace. */
  showing: boolean
  /** When that copy was fetched (epoch ms). */
  updatedAt: number | null
  /** What the saved copy is of, for the sentence: "stock levels", "this product". */
  subject?: string
  /** Asks the server again; a promise lets "Trying…" last as long as the attempt. It also retries every 30 seconds. */
  onRetry?: () => unknown
}

/** "10:42" today, "3 Oct, 10:42" before that — the moment the figures on screen were true. */
function formatSavedAt(updatedAt: number): string {
  const at = new Date(updatedAt)
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const sameDay = at.toDateString() === new Date().toDateString()
  return sameDay ? time : `${at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

/**
 * The honest line above data served from the device: what it is and when it was true.
 *
 * Offline-honest UI (INVENTORY_OFFLINE_AND_CHARACTER_PLAN.md, B3): a stock figure shown without
 * a connection is a figure from the past, and a storekeeper deciding whether there are enough
 * bags must be able to tell. Quiet rather than alarming — the app is working as intended.
 */
export function SavedDataNote({ showing, updatedAt, subject = 'what was saved', onRetry }: SavedDataNoteProps) {
  const online = useOnlineStatus()
  const { trying, triedAt, retry } = useRetry(onRetry)
  if (!showing || updatedAt == null) return null
  // Tried and still here: said, with when, so a tap that changed nothing still visibly did something.
  const triedText = triedAt != null ? ` · tried ${formatSavedAt(triedAt)}` : ''

  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800"
    >
      <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">
        {online ? (triedAt != null ? "Still can't reach the server" : "Couldn't reach the server") : 'Offline'} · showing{' '}
        {subject} as of <span className="font-medium tabular-nums">{formatSavedAt(updatedAt)}</span>
        {triedText}
      </span>
      {onRetry &&
        (trying ? (
          // In place of the button while it tries - at once, and for at least a moment, however fast the answer.
          <span className="inline-flex shrink-0 items-center gap-1.5 px-1.5 py-0.5 font-medium text-warning-900" data-retrying>
            <Spinner size={14} />
            Trying…
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void retry()}
            className="shrink-0 rounded-sm px-1.5 py-0.5 font-medium text-warning-900 underline underline-offset-2 hover:bg-warning-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-500"
          >
            Try again
          </button>
        ))}
    </p>
  )
}
