import { useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { useClickOutside } from '@/hooks/useClickOutside'

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase()
}

export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  if (user?.type !== 'tenant') {
    return null
  }

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md p-1.5 hover:bg-neutral-100"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
          {getInitials(user.username)}
        </span>
        <span className="hidden text-sm font-medium text-neutral-700 sm:block">{user.username}</span>
        <ChevronDown className="hidden h-4 w-4 text-neutral-400 sm:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
