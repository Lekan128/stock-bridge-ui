import { useRef, useState } from 'react'
import { ChevronDown, Download, LayoutDashboard, LogOut, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { useClickOutside } from '@/hooks/useClickOutside'
import { promptInstall, useServiceWorkerState } from '@/pwa/serviceWorker'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { deleteAllDrafts } from '@/features/drafts/draftStore'
import { useDraftCount } from '@/features/drafts/useDraft'
import { stopOutbox } from '@/features/outbox/outboxStore'
import { useOutboxState } from '@/features/outbox/useOutbox'

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
  const { canInstall } = useServiceWorkerState()
  const outbox = useOutboxState()
  const draftCount = useDraftCount()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  if (user?.type !== 'tenant') {
    return null
  }

  async function handleLogout() {
    setOpen(false)
    // Stock recorded on this phone and not yet sent would be lost with the session's data (A4).
    // Never silently: say so, and let the person choose to stay signed in until it has gone.
    // Unfinished forms (A5) go with the session too, so they are named in the same question.
    if ((outbox.ops.length > 0 || draftCount > 0) && !confirmLogout) {
      setConfirmLogout(true)
      return
    }
    await logoutNow()
  }

  async function logoutNow() {
    setConfirmLogout(false)
    await Promise.all([stopOutbox({ deleteData: true }), deleteAllDrafts()])
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
        <ChevronDown className="hidden h-4 w-4 text-neutral-500 sm:block" />
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
          {/* Only where the browser can actually install (Android Chrome, desktop Chromium). iOS
              has no install prompt; the workspace shows its own Add to Home Screen hint instead. */}
          {canInstall && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                void promptInstall()
              }}
              className={itemClassName}
            >
              <Download className="h-4 w-4" />
              Install Procure Paddy
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => void handleLogout()} className={itemClassName}>
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmLogout}
        title={outbox.ops.length > 0 ? 'Stock changes not sent yet' : 'Unfinished forms on this phone'}
        message={logoutWarning(outbox.ops.length, draftCount)}
        confirmLabel="Log out and discard"
        onConfirm={() => void logoutNow()}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  )
}

/** What logging out now would throw away, in the person's terms. */
function logoutWarning(unsent: number, drafts: number): string {
  const parts: string[] = []
  if (unsent > 0) {
    parts.push(
      `${unsent} stock change${unsent === 1 ? '' : 's'} recorded on this phone ${unsent === 1 ? 'has' : 'have'} not been sent. If you log out now, ${unsent === 1 ? 'it' : 'they'} will be deleted from this phone and never recorded. Stay signed in until ${unsent === 1 ? 'it has' : 'they have'} gone, or log out and discard ${unsent === 1 ? 'it' : 'them'}.`,
    )
  }
  if (drafts > 0) {
    const forms = `${drafts} unfinished form${drafts === 1 ? '' : 's'} (a delivery or a new product)`
    parts.push(
      unsent > 0
        ? `${forms} will be deleted too.`
        : `${forms} saved on this phone will be deleted if you log out now.`,
    )
  }
  return parts.join(' ')
}
