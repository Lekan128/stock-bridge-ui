import { useEffect, useRef, useState } from 'react'
import { KeyRound, MoreVertical, Pencil, UserX } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'
import type { TenantUserSummary } from '@/features/users/types'

export interface UserActionsMenuProps {
  user: TenantUserSummary
  isSelf?: boolean
  onEdit: () => void
  onResetPassword: () => void
  onDeactivate: () => void
}

const MENU_WIDTH = 176 // w-44
const MENU_GAP = 8 // mt-2 / mb-2
const VIEWPORT_MARGIN = 8

export function UserActionsMenu({ user, isSelf, onEdit, onResetPassword, onDeactivate }: UserActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const items = [
    { label: 'Edit', icon: Pencil, onClick: onEdit },
    { label: 'Reset password', icon: KeyRound, onClick: onResetPassword },
    ...(user.active
      ? [
          {
            label: 'Deactivate',
            icon: UserX,
            onClick: onDeactivate,
            danger: true,
            disabled: isSelf,
            title: isSelf ? "You can't change your own role or status" : undefined,
          },
        ]
      : []),
  ]

  function toggleOpen() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const estimatedHeight = items.length * 36 + 8
      const openUp = rect.bottom + MENU_GAP + estimatedHeight > window.innerHeight
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
      )
      setPosition({
        top: openUp ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
        left,
        openUp,
      })
    }
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    function close() {
      setOpen(false)
    }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${user.username}`}
        className="inline-flex items-center justify-center rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && position && (
        <div
          role="menu"
          style={{
            top: position.top,
            left: position.left,
            transform: position.openUp ? 'translateY(-100%)' : undefined,
          }}
          className="fixed z-20 w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent ${
                item.danger ? 'text-danger-600' : 'text-neutral-700'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
