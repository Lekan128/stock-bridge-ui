import { useState } from 'react'
import { useOutboxState } from '@/features/outbox/useOutbox'
import { SyncCentre } from '@/features/sync/SyncCentre'
import { SyncIcon } from '@/features/sync/SyncIcon'
import { TONE_CLASS } from '@/features/sync/syncTone'
import { useSyncStatus } from '@/features/sync/useSyncStatus'

/**
 * The top bar's one word on syncing (A6) — it replaces both the old "Offline" tag and the A4
 * "3 waiting to send" button: "Offline · 3 saved on this phone", "Sending 2 of 5", "1 needs you",
 * "All caught up". When there is nothing to say it shrinks to a quiet cloud icon, still a button,
 * so the sync centre is always one tap away.
 */
export function SyncPill({ large = false }: { /** A 44 px target, for quick mode's gloved thumbs. */ large?: boolean } = {}) {
  const status = useSyncStatus()
  const { ready } = useOutboxState()
  const [open, setOpen] = useState(false)

  // Not a stock-keeping session (the outbox only opens for a signed-in workspace user).
  if (!ready && status.online) return null

  const quiet = status.kind === 'idle'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={quiet ? 'All caught up. Open sync details' : `${status.label}. Open sync details`}
        title={quiet ? 'All caught up' : undefined}
        className={`inline-flex items-center justify-center gap-1.5 rounded-sm border text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          quiet ? 'p-1.5' : 'px-2 py-1'
        } ${large ? 'min-h-11 min-w-11' : ''} ${TONE_CLASS[status.tone]}`}
      >
        <SyncIcon status={status} className={quiet ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
        {!quiet && (
          <span className="tabular-nums" aria-hidden="true">
            <span className="sm:hidden">{status.short}</span>
            <span className="hidden sm:inline">{status.label}</span>
          </span>
        )}
      </button>
      {/* Said once per change of state — not "Sending 2 of 5", "3 of 5", "4 of 5" one after another. */}
      <span className="sr-only" role="status">
        {quiet ? '' : status.kind === 'sending' ? 'Sending' : status.label}
      </span>
      <SyncCentre open={open} onClose={() => setOpen(false)} />
    </>
  )
}
