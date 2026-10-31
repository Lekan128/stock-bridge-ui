import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AreaMenu } from '@/features/branches/AreaMenu'
import type { Area } from '@/features/branches/types'
import { useClickOutside } from '@/hooks/useClickOutside'

/**
 * " · Kitchen ⌄" in quick mode's title (owner, 2026-10-31): where every scan here lands, said where the eye
 * already is and changed there - plain text with a small chevron, no box, so the header looks as it did.
 * Tapping it opens the same menu as the top bar's area chip; it's the same setting. One area to choose
 * from (the cook's Kitchen): just the name.
 */
export function QuickAreaTitle({
  areaId,
  areaName,
  choices,
  onChoose,
}: {
  areaId: string | undefined
  areaName: string | undefined
  choices: Area[]
  onChoose: (areaId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useClickOutside(ref, () => setOpen(false))
  // Escape closes the menu first, before quick mode hears it (there, Escape steps out of quick mode).
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
  if (!areaId || !areaName) return null
  if (choices.length < 2) return <> · {areaName}</>
  return (
    <span ref={ref} className="relative">
      {' · '}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Recording in the ${areaName}. Change area`}
        className="-my-2 inline-flex min-h-11 max-w-[9rem] items-center gap-0.5 rounded-md px-1 align-middle font-semibold text-primary-800 hover:bg-neutral-100 sm:max-w-[14rem]"
      >
        <span className="truncate">{areaName}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      {open && (
        <AreaMenu
          areas={choices}
          currentId={areaId}
          desktopClassName="sm:absolute sm:top-full sm:left-1/2 sm:mt-2 sm:-translate-x-1/2"
          onClose={() => setOpen(false)}
          onPick={(area) => {
            setOpen(false)
            if (area.id !== areaId) onChoose(area.id)
          }}
        />
      )}
    </span>
  )
}
