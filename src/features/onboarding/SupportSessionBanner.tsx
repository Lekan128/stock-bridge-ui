import { ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/useToast'
import { deleteAllDrafts } from '@/features/drafts/draftStore'
import { stopOutbox } from '@/features/outbox/outboxStore'
import { useOutboxState } from '@/features/outbox/useOutbox'

/** The username of the setup team's account inside a shop (API SupportAccessService). */
export const SUPPORT_USERNAME = 'procurepaddy-support'

/**
 * Shown while the setup team is inside a shop's workspace as Procurepaddy support (step 5), so
 * nobody forgets whose shop this is, and with the way back to the admin queue. Logging out here
 * ends only this shop session; the super admin's own session is separate and stays.
 */
export function SupportSessionBanner() {
  const { user, client, logout } = useAuth()
  const navigate = useNavigate()
  const outbox = useOutboxState()
  const { showToast } = useToast()
  if (user?.username !== SUPPORT_USERNAME) return null

  // The same clean-up as signing out, so nothing of the shop stays in this browser; but never
  // with changes still waiting to send, which would lose the shop's stock.
  async function leave() {
    if (outbox.ops.length > 0) {
      showToast(`${outbox.ops.length} ${outbox.ops.length === 1 ? 'change is' : 'changes are'} still sending. Leave once they have gone.`, 'error')
      return
    }
    await Promise.all([stopOutbox({ deleteData: true }), deleteAllDrafts()])
    // Out of the workspace first: signing out while still in it would send the router to the
    // log-in form, and unmount this banner before it could navigate anywhere.
    navigate('/admin/setup-requests', { replace: true })
    await logout()
  }

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 bg-primary-900 px-4 py-2 text-sm text-white sm:px-6"
    >
      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        You&apos;re in <strong>{client?.name ?? client?.identifier}</strong> as Procurepaddy support. Everything you record
        is signed with that name.
      </p>
      <button
        type="button"
        onClick={() => void leave()}
        className="rounded-md border border-white/40 px-3 py-1 font-medium hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        Leave this shop
      </button>
    </div>
  )
}
