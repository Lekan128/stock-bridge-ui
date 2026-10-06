import { useEffect, useState } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useOutboxState } from '@/features/outbox/useOutbox'

const DAY_MS = 24 * 60 * 60 * 1000
/** How long "All caught up" stays spelled out after the last waiting change goes. */
const CAUGHT_UP_MS = 5_000

export type SyncTone = 'quiet' | 'info' | 'good' | 'warning' | 'danger'

export interface SyncStatus {
  kind:
    /** Nothing waiting, nothing just sent: the pill is a quiet icon. */
    | 'idle'
    /** The last waiting change has just been sent. */
    | 'caughtUp'
    | 'offline'
    | 'sending'
    /** Online, but the server couldn't be reached last time: retrying on its own. */
    | 'waiting'
    /** The server refused something once it arrived; a person has to decide. */
    | 'attention'
  online: boolean
  /** Changes still to send (not counting ones that need you). */
  waiting: number
  /** Changes the server refused. */
  attention: number
  /** "Sending 2 of 5". */
  sendingPosition: number
  sendingTotal: number
  /** Whole days the oldest unsent change has waited: 1 is "a day", 3 is "escalate" (Square's rule). */
  ageDays: number
  tone: SyncTone
  /** What the pill says. `short` fits a phone's top bar. */
  label: string
  short: string
}

/**
 * One reading of "where does this phone stand with the server" (A6), shared by the top bar's pill
 * and the sync centre so the two can never disagree.
 */
export function useSyncStatus(): SyncStatus {
  const online = useOnlineStatus()
  const { ops, sending, sentThisRound, lastSentAt } = useOutboxState()
  const now = useClock(lastSentAt)

  const waiting = ops.filter((op) => op.status === 'pending').length
  const attention = ops.length - waiting
  const oldest = ops.length > 0 ? Math.min(...ops.map((op) => op.createdAt)) : null
  const ageDays = oldest == null ? 0 : Math.floor((now - oldest) / DAY_MS)
  const aged: SyncTone | null = ageDays >= 3 ? 'danger' : ageDays >= 1 ? 'warning' : null
  const age = ageDays >= 1 ? ` · ${ageDays === 1 ? 'a day' : `${ageDays} days`}` : ''
  const base = { online, waiting, attention, sendingPosition: 0, sendingTotal: 0, ageDays }

  if (attention > 0) {
    const label = `${attention} need${attention === 1 ? 's' : ''} you`
    return { ...base, kind: 'attention', tone: aged === 'danger' ? 'danger' : 'warning', label, short: label }
  }
  if (!online) {
    return {
      ...base,
      kind: 'offline',
      tone: aged ?? 'warning',
      label: ops.length > 0 ? `Offline · ${ops.length} saved on this phone${age}` : 'Offline',
      short: ops.length > 0 ? `Offline · ${ops.length}` : 'Offline',
    }
  }
  if (sending) {
    const position = sentThisRound + 1
    const total = sentThisRound + waiting
    return {
      ...base,
      kind: 'sending',
      sendingPosition: position,
      sendingTotal: total,
      tone: 'info',
      label: total > 1 ? `Sending ${position} of ${total}` : 'Sending…',
      short: total > 1 ? `${position} of ${total}` : 'Sending…',
    }
  }
  if (waiting > 0) {
    return {
      ...base,
      kind: 'waiting',
      tone: aged ?? 'info',
      label: `${waiting} waiting to send${age}`,
      short: `${waiting} waiting`,
    }
  }
  if (lastSentAt != null && now - lastSentAt < CAUGHT_UP_MS) {
    return { ...base, kind: 'caughtUp', tone: 'good', label: 'All caught up', short: 'All caught up' }
  }
  return { ...base, kind: 'idle', tone: 'quiet', label: 'All caught up', short: 'All caught up' }
}

/**
 * The time, refreshed when "All caught up" should fold away and once a minute besides (so a
 * change that has waited all night turns amber without anything else happening).
 */
function useClock(lastSentAt: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const minute = window.setInterval(tick, 60_000)
    const fold = lastSentAt != null ? window.setTimeout(tick, Math.max(0, lastSentAt + CAUGHT_UP_MS - Date.now()) + 50) : undefined
    return () => {
      window.clearInterval(minute)
      if (fold != null) window.clearTimeout(fold)
    }
  }, [lastSentAt])
  return now
}
