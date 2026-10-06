export type StampKind = 'recorded' | 'synced' | 'check'

const STYLE: Record<StampKind, { text: string; className: string; meaning: string }> = {
  recorded: {
    text: 'Recorded',
    className: 'border-primary-600 text-primary-700',
    meaning: 'Saved on this phone, not sent yet',
  },
  synced: {
    text: 'Synced',
    className: 'border-accent-700 bg-accent-700 text-white',
    meaning: 'Sent and recorded',
  },
  check: {
    text: 'Check',
    className: 'border-warning-600 bg-warning-50 text-warning-800',
    meaning: 'Needs a decision',
  },
}

export interface StampProps {
  kind: StampKind
  /** Lands with a small scale-in — for a state that has just changed (plan §2 motion). */
  land?: boolean
}

/**
 * The rubber stamp (plan §2, "stamps for state"): the way waybills get stamped RECEIVED, every
 * write shows where it stands — an outlined RECORDED (on this phone), a solid SYNCED, an amber
 * CHECK (needs a decision). Functional first: it IS the sync status.
 */
export function Stamp({ kind, land = false }: StampProps) {
  const { text, className, meaning } = STYLE[kind]
  return (
    <span
      title={meaning}
      data-stamp={kind}
      className={`inline-block shrink-0 -rotate-2 rounded-sm border-2 px-1.5 py-0.5 text-[11px] leading-none font-semibold tracking-wider uppercase ${className} ${
        land ? 'animate-stamp-land' : ''
      }`}
    >
      {text}
      <span className="sr-only">: {meaning}</span>
    </span>
  )
}
