import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'

export interface OverflowMenuItem {
  label: string
  onSelect: () => void
  icon?: ReactNode
  /** Red text — the only way a destructive action appears outside a confirmation (B2). */
  tone?: 'danger'
  disabled?: boolean
}

export interface OverflowMenuProps {
  items: OverflowMenuItem[]
  /** Read out for the "⋯" button: "More actions for Mama Gold Rice". */
  label?: string
  align?: 'left' | 'right'
}

/**
 * "⋯": where the less common and the destructive actions live (plan Track B, B2), so a screen's
 * header carries its main action and nothing loud beside it. Arrow keys move between items,
 * Escape closes and puts focus back on the button.
 */
export function OverflowMenu({ items, label = 'More actions', align = 'right' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  useClickOutside(ref, () => setOpen(false))

  useEffect(() => {
    if (open) itemRefs.current.find((item) => item && !item.disabled)?.focus()
  }, [open])

  function close({ returnFocus }: { returnFocus: boolean }) {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  function move(from: number, step: 1 | -1) {
    const enabled = itemRefs.current.filter((item): item is HTMLButtonElement => item != null && !item.disabled)
    if (enabled.length === 0) return
    const current = enabled.indexOf(itemRefs.current[from] as HTMLButtonElement)
    enabled[(current + step + enabled.length) % enabled.length].focus()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute z-30 mt-2 min-w-48 rounded-md border border-neutral-200 bg-white py-1 shadow-paper ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onKeyDown={(event) => {
            const index = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement)
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              move(index, 1)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              move(index, -1)
            } else if (event.key === 'Home') {
              event.preventDefault()
              move(-1, 1)
            } else if (event.key === 'End') {
              event.preventDefault()
              move(0, -1)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              close({ returnFocus: true })
            } else if (event.key === 'Tab') {
              close({ returnFocus: false })
            }
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                itemRefs.current[index] = element
              }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              tabIndex={-1}
              onClick={() => {
                close({ returnFocus: true })
                item.onSelect()
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 focus-visible:bg-neutral-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                item.tone === 'danger' ? 'text-danger-700' : 'text-neutral-700'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
