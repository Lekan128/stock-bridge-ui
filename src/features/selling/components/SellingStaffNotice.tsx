import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useSellingSettings } from '@/features/selling/useSellingSettings'

const SEEN_KEY = 'pp.sellingNoticeSeen.'

function seen(userKey: string, stamp: string): boolean {
  try {
    return localStorage.getItem(SEEN_KEY + userKey) === stamp
  } catch {
    return false
  }
}

/**
 * The one-time word to staff when the owner turns selling on (`SELLING_PRICE_PLAN.md` §5.4): the
 * screens they use every day have changed - Record a sale is now the Inventory's main action - and
 * nobody should meet that without being told. Once per person, per time it is turned on; the owner
 * who turned it on already knows. Gone for good on "Got it" or on following it.
 */
export function SellingStaffNotice() {
  const { user } = useAuth()
  const { data: settings } = useSellingSettings()
  const userKey = user?.type === 'tenant' ? user.id : ''
  const stamp = settings?.changedAt ?? 'on'
  const [dismissed, setDismissed] = useState(false)

  if (user?.type !== 'tenant' || !settings?.available || !settings.sellsStock || dismissed) return null
  if (!user.permissions.includes(PERMISSIONS.STOCK_OUT) || user.permissions.includes(PERMISSIONS.MANAGE_COMPANY_PROFILE)) return null
  if (seen(userKey, stamp)) return null

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY + userKey, stamp)
    } catch {
      // Shown once more next time; that is all it costs.
    }
    setDismissed(true)
  }

  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
      <p className="min-w-0 flex-1 text-sm text-neutral-800">
        Your company now records sales. When a customer buys, use{' '}
        <Link to="/app/sell" onClick={dismiss} className="font-medium text-primary-700 underline">
          Record a sale
        </Link>
        : the price is filled in, and you can change it.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="-m-1 inline-flex shrink-0 items-center gap-1 rounded-md p-1 text-sm font-medium text-neutral-600 hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        Got it
      </button>
    </div>
  )
}
