import { useRef, useState } from 'react'
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { useClickOutside } from '@/hooks/useClickOutside'

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase()
}

const itemClassName =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50'

/** Account menu. Shared by the workspace topbar and the public storefront header. */
export function UserMenu() {
  const { user, client, logout } = useAuth()
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
    // Back to the public storefront rather than the login form. `/` works from either layout and
    // is a live page with a prominent "Log in" — a bare login screen would be a dead end for
    // someone who was only browsing the catalog.
    navigate('/', { replace: true })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md p-1.5 hover:bg-neutral-100"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
          {getInitials(user.username)}
        </span>
        <span className="hidden text-sm font-medium text-neutral-700 sm:block">{user.username}</span>
        <ChevronDown className="hidden h-4 w-4 text-neutral-400 sm:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {client && (
            <div className="border-b border-neutral-100 px-3 py-2">
              <p className="text-xs text-neutral-500">Signed in for</p>
              <p className="truncate text-sm font-medium text-neutral-900">
                {client.name ?? client.identifier}
              </p>
            </div>
          )}
          {/* Reachable from the storefront, where there is no sidebar to get back from. */}
          <Link to="/app" role="menuitem" onClick={() => setOpen(false)} className={itemClassName}>
            <LayoutDashboard className="h-4 w-4" />
            My workspace
          </Link>
          <Link to="/app/profile" role="menuitem" onClick={() => setOpen(false)} className={itemClassName}>
            <UserRound className="h-4 w-4" />
            Profile
          </Link>
          <button type="button" role="menuitem" onClick={() => void handleLogout()} className={itemClassName}>
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
