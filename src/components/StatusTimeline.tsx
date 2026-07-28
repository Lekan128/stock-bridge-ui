import { Check, Circle, Loader, X } from 'lucide-react'

export type StatusTimelineState = 'complete' | 'current' | 'upcoming' | 'cancelled'

export interface StatusTimelineEntry {
  /** Stable key — an `order_status_events.id` where one exists. */
  id?: string
  label: string
  /** Pre-formatted timestamp. Formatting stays with the caller so it can pick date vs date+time. */
  timestamp?: string | null
  note?: string | null
  state: StatusTimelineState
}

export interface StatusTimelineProps {
  entries: StatusTimelineEntry[]
  className?: string
}

const dotStyles: Record<StatusTimelineState, string> = {
  complete: 'border-accent-600 bg-accent-600 text-white',
  current: 'border-primary-600 bg-primary-600 text-white',
  upcoming: 'border-neutral-300 bg-white text-neutral-300',
  cancelled: 'border-danger-600 bg-danger-600 text-white',
}

const labelStyles: Record<StatusTimelineState, string> = {
  complete: 'text-neutral-900',
  current: 'text-primary-700',
  upcoming: 'text-neutral-400',
  cancelled: 'text-danger-700',
}

const icons: Record<StatusTimelineState, typeof Check> = {
  complete: Check,
  current: Loader,
  upcoming: Circle,
  cancelled: X,
}

/**
 * Vertical order-tracking timeline, driven by `order_status_events` (contract §10). Built as a
 * plain <ol> so the sequence is conveyed to assistive tech without relying on the drawn line,
 * which is decorative.
 */
export function StatusTimeline({ entries, className = '' }: StatusTimelineProps) {
  if (entries.length === 0) return null

  return (
    <ol className={`flex flex-col ${className}`}>
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1
        const Icon = icons[entry.state]
        // The connector inherits the colour of the step *above* it, so the line reads as
        // "progress reached this far" rather than as a uniform rail.
        const connectorColour =
          entry.state === 'complete'
            ? 'bg-accent-200'
            : entry.state === 'cancelled'
              ? 'bg-danger-200'
              : entry.state === 'current'
                ? 'bg-primary-200'
                : 'bg-neutral-200'

        return (
          <li key={entry.id ?? `${entry.label}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${dotStyles[entry.state]}`}
              >
                <Icon className="h-3 w-3" strokeWidth={3} />
              </span>
              {!isLast && <span aria-hidden="true" className={`w-0.5 flex-1 ${connectorColour}`} />}
            </div>
            <div className={`min-w-0 ${isLast ? 'pb-0' : 'pb-5'}`}>
              <p className={`text-sm font-medium ${labelStyles[entry.state]}`}>
                {entry.label}
                {entry.state === 'current' && <span className="sr-only"> (current step)</span>}
              </p>
              {entry.timestamp && <p className="mt-0.5 text-xs text-neutral-500">{entry.timestamp}</p>}
              {entry.note && <p className="mt-1 text-sm text-neutral-600">{entry.note}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
