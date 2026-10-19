import { useEffect, useState } from 'react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/useToast'
import { sellingApi } from '@/features/selling/sellingApi'
import { useSellingSettings } from '@/features/selling/useSellingSettings'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

const SHOWN_KEY = 'pp.sellingOfferShown.'
const QUIET_FOR_MS = 30 * 24 * 60 * 60 * 1000

function shownRecently(userKey: string): boolean {
  try {
    const at = Number(localStorage.getItem(SHOWN_KEY + userKey))
    return Number.isFinite(at) && at > 0 && Date.now() - at < QUIET_FOR_MS
  } catch {
    return false
  }
}

function remember(userKey: string) {
  try {
    localStorage.setItem(SHOWN_KEY + userKey, String(Date.now()))
  } catch {
    // Offered again next time; that is all it costs.
  }
}

/**
 * The offer made where selling is needed (`SELLING_PRICE_PLAN.md` §5.2): someone picked "Sold" on a
 * stock-out while their company does not record sales. The owner gets one line and one tap; anyone
 * else is told who can turn it on. Shown to a person at most once every 30 days - an offer that
 * appears on every sale stops being read. Ignoring it is fine: the stock-out is saved as Sold.
 */
export function SellingOffer() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const online = useOnlineStatus()
  const { data: settings, setData } = useSellingSettings()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const userKey = user?.type === 'tenant' ? user.id : ''
  // Decided once, when it first appears: it must not vanish mid-read because it was just recorded.
  const [visible] = useState(() => userKey !== '' && !shownRecently(userKey))

  useEffect(() => {
    if (visible) remember(userKey)
  }, [visible, userKey])

  if (!visible || !settings || !settings.available || settings.sellsStock) return null
  const isOwner = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_COMPANY_PROFILE)

  async function turnOn() {
    setSaving(true)
    setError(null)
    try {
      setData(await sellingApi.update({ sellsStock: true, source: 'IN_CONTEXT' }))
      showToast('Selling is on. Add what this went for below.', 'success')
    } catch (err) {
      setError(isAppError(err) ? err.message : "Couldn't turn it on. Try again.")
      setSaving(false)
    }
  }

  if (!isOwner) {
    return <p className="text-xs text-neutral-500">Your owner can turn on selling to record prices and profit.</p>
  }
  return (
    <div className="flex flex-col gap-1" data-selling-offer>
      <p className="text-sm text-neutral-700">
        Want to record what you sold it for and see your profit?{' '}
        <button
          type="button"
          disabled={saving || !online}
          onClick={() => void turnOn()}
          className="rounded-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60"
        >
          Turn on selling
        </button>
      </p>
      {!online && <p className="text-xs text-neutral-500">Turning it on needs a connection.</p>}
      {error && (
        <p role="alert" className="text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}
