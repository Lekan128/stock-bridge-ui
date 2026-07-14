import { useRef, useState } from 'react'
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

export function UserActionsMenu({ user, isSelf, onEdit, onResetPassword, onDeactivate }: UserActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${user.username}`}
        className="inline-flex items-center justify-center rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
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
