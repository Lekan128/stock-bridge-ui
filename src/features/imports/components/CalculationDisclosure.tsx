import { useState } from 'react'
import { Info } from 'lucide-react'
import { copy } from '@/features/imports/copy'

export interface CalculationDisclosureProps {
  /**
   * The plugged-in sentence to reveal, or null when there is nothing to explain — renders
   * nothing on null, same contract as `PackCostEcho`, so a caller needs no guard of its own.
   */
  sentence: string | null
  className?: string
}

/**
 * The (i) click/tap/keyboard-focus toggle behind the quantity and cost echoes —
 * `UNIT_UX_CONTRACT.md` §9.1/§9.2's compact "= 1,350 kg" and "₦2,600.00 / kg stored" lines state
 * a result; this states how it was reached, for whoever asks. An icon rather than a text link so
 * it does not out-weigh the number it sits under on a grid where this repeats down every row.
 *
 * <h2>Why not a hover tooltip</h2>
 * Hover must never be the only way to reach content that matters: touch devices have no hover at
 * all, and a hover popover inside a horizontally-scrolling grid (`ReviewGrid`'s own
 * `overflow-x-auto`) tends to cover the row it is explaining rather than sit beside it. This
 * expands in place instead — the sentence pushes the row taller rather than floating over
 * anything — so it is reachable by mouse click, touch tap and keyboard (`Tab` then
 * `Enter`/`Space`) identically, and needs no dismiss-on-click-away logic because nothing is ever
 * drawn on top of another cell.
 *
 * Collapsed by default on every row: the operands are already implied by the row's own cells, so
 * this is a check a reader asks for, not something everyone needs on every glance.
 */
export function CalculationDisclosure({ sentence, className = '' }: CalculationDisclosureProps) {
  const [open, setOpen] = useState(false)
  if (sentence == null) return null

  return (
    <div className={className}>
      {/*
       * Icon-only, so the accessible name has to carry what the visible label used to say —
       * `aria-label` rather than `title` (see `PackCostEcho`: a `title` is unreachable by
       * keyboard and touch and not reliably announced). `aria-expanded` still states open/closed
       * to a screen reader; the filled background is the same fact for a sighted reader, replacing
       * the chevron flip and label swap the earlier text-link version used.
       */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={copy.review.calculationToggle(open)}
        className={`inline-flex items-center justify-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          open ? 'bg-neutral-200 text-neutral-700' : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
        }`}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && <p className="mt-0.5 text-xs text-neutral-600 tabular-nums">{sentence}</p>}
    </div>
  )
}
