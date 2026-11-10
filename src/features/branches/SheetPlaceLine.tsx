import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AreaMenu } from '@/features/branches/AreaMenu'
import { useClickOutside } from '@/hooks/useClickOutside'

/** One part of the line: a name, and - where there's a choice - the menu that changes it. */
export interface PlacePart {
  key: string
  /** "Oshodi", "Kitchen", or "Choose a branch" while none is chosen. */
  label: string
  choice?: {
    /** The menu's caption, saying what the choice does: "Record at", "Record in". */
    caption: string
    /** For a screen reader: "Recording in the Kitchen. Change area". */
    ariaLabel: string
    options: { id: string; name: string }[]
    currentId: string | undefined
    onPick: (id: string) => void
  }
}

/**
 * The line under a stock sheet's title (STOCK_SHEETS_AND_AREA_COUNT_PLAN.md Part 1): where it records and how
 * much is there - "Oshodi · Kitchen ⌄ · 12 bags here", or "150 kg here (3 bags)". Only the parts that mean
 * something are said: no branch at a one-branch company, no area at a branch without areas, so a one-shop
 * company reads "30 bags here". A part with a choice is changed right there, the same menu as quick mode's
 * title (no box above the form).
 */
export function SheetPlaceLine({ parts, figure, inPacks }: { parts: PlacePart[]; figure: string | null; inPacks?: string | null }) {
  const pieces = [
    ...parts.map((part) => (part.choice ? <Chooser key={part.key} part={part} /> : <span key={part.key}>{part.label}</span>)),
    ...(figure != null ? [<span key="figure">{figure} here{inPacks ? ` (${inPacks})` : ''}</span>] : []),
  ]
  if (pieces.length === 0) return null
  return (
    <p data-sheet-place className="flex flex-wrap items-center gap-x-1">
      {pieces.map((piece, index) => (
        <span key={index} className="inline-flex items-center gap-x-1">
          {index > 0 && <span aria-hidden="true">·</span>}
          {piece}
        </span>
      ))}
    </p>
  )
}

function Chooser({ part }: { part: PlacePart }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useClickOutside(ref, () => setOpen(false))
  // Escape closes the menu first, before the sheet hears it (there, Escape closes the sheet).
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open])
  const choice = part.choice!
  return (
    <span ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={choice.ariaLabel}
        // The padding is for the touch target only: -mx-1 keeps the name lined up with the title above it.
        className="-mx-1 -my-2 inline-flex min-h-11 max-w-[12rem] items-center gap-0.5 rounded-md px-1 font-medium text-primary-800 hover:bg-neutral-100"
      >
        <span className="truncate">{part.label}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      {open && (
        <AreaMenu
          areas={choice.options}
          currentId={choice.currentId}
          caption={choice.caption}
          className="absolute top-full left-0 mt-1 w-64"
          onPick={(option) => {
            setOpen(false)
            if (option.id !== choice.currentId) choice.onPick(option.id)
          }}
        />
      )}
    </span>
  )
}
