import { FileClock } from 'lucide-react'

function at(ms: number): string {
  const when = new Date(ms)
  const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return when.toDateString() === new Date().toDateString()
    ? time
    : `${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

export interface DraftNoteProps {
  /** When the draft on the phone was last saved; nothing shows without one. */
  savedAt: number | null
  /** This visit opened on a draft from an earlier one. */
  restored: boolean
  onDiscard: () => void
  /** Anything the draft could not keep, said once ("Add the photo again"). */
  caveat?: string
}

/**
 * "Draft saved on this phone at 10:42 · Discard draft" (A5). Says plainly that the typing is safe,
 * and — when the form opened on an earlier draft — that what is on screen came from it.
 */
export function DraftNote({ savedAt, restored, onDiscard, caveat }: DraftNoteProps) {
  if (savedAt == null) return null
  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600"
    >
      <FileClock className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
      <span className="flex-1">
        {restored ? 'Picked up your draft from ' : 'Draft saved on this phone at '}
        <span className="tabular-nums font-medium text-neutral-800">{at(savedAt)}</span>.
        {restored && caveat ? ` ${caveat}` : ''}
      </span>
      <button
        type="button"
        onClick={onDiscard}
        className="rounded-sm px-1 font-medium text-neutral-700 underline underline-offset-2 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        Discard draft
      </button>
    </p>
  )
}
