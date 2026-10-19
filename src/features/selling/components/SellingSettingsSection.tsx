import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/useToast'
import { formatDate } from '@/features/company/formatters'
import { LegacyPriceReviewSheet } from '@/features/selling/components/LegacyPriceReviewSheet'
import { sellingApi } from '@/features/selling/sellingApi'
import { useSellingSettings } from '@/features/selling/useSellingSettings'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

/**
 * "How you use your stock" on the Company page - the selling switch (`SELLING_PRICE_PLAN.md` §5.4).
 *
 * - The switch acts at once (no "are you sure"): on, a toast and one next step; off, a toast with
 *   Undo, because turning it off hides screens and deletes nothing.
 * - Owners only (MANAGE_COMPANY_PROFILE, as the API). Everyone else sees the state and who to ask.
 * - It edits a shared record, so it waits for a connection and says so (Pattern C part 5).
 * - Not rendered at all for a marketplace vendor, which cannot choose it.
 */
export function SellingSettingsSection() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const online = useOnlineStatus()
  const { data: settings, setData } = useSellingSettings()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)

  const permissions = user?.type === 'tenant' ? user.permissions : []
  const canChange = permissions.includes(PERMISSIONS.MANAGE_COMPANY_PROFILE)
  const canPrice = permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)

  if (!settings || !settings.available) return null
  const on = settings.sellsStock
  const reviewWaiting = on && canPrice && settings.legacyPriceCount > 0

  async function change(next: boolean) {
    setSaving(true)
    setError(null)
    try {
      const updated = await sellingApi.update({ sellsStock: next, source: 'OWNER' })
      setData(updated)
      if (next) {
        showToast('Selling is on. Products can now have a selling price.', 'success')
      } else {
        showToast('Selling is hidden. Your prices and sales are kept.', 'info', {
          action: { label: 'Undo', onAction: () => void change(true) },
        })
      }
    } catch (err) {
      setError(isAppError(err) ? err.message : "Couldn't change that. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const changedLine =
    settings.changedAt && settings.changedByName
      ? `${on ? 'Turned on' : 'Turned off'} by ${settings.changedByName}, ${formatDate(settings.changedAt)}`
      : null

  return (
    <section aria-labelledby="selling-heading" className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 id="selling-heading" className="text-base font-semibold text-neutral-900">
        How you use your stock
      </h2>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id="sell-from-stock-label" className="text-sm font-medium text-neutral-900">
            Sell from your stock
          </p>
          <p id="sell-from-stock-help" className="mt-0.5 max-w-prose text-sm text-neutral-500">
            Give products a selling price, record sales, and see your sales and profit. Products you only use yourself
            don't need a price.
          </p>
          {changedLine && <p className="mt-1 text-xs text-neutral-500">{changedLine}</p>}
        </div>
        {canChange ? (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="sell-from-stock-label"
            aria-describedby="sell-from-stock-help"
            disabled={saving || !online}
            onClick={() => void change(!on)}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none ${
              on ? 'bg-accent-600' : 'bg-neutral-300'
            } ${saving || !online ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        ) : (
          <span className="shrink-0 text-sm font-medium text-neutral-700">{on ? 'On' : 'Off'}</span>
        )}
      </div>

      {!canChange && <p className="text-xs text-neutral-500">Ask your owner to change this.</p>}
      {canChange && !online && <p className="text-xs text-neutral-500">Changing this needs a connection.</p>}
      {error && (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      )}

      {/* The one next step once it is on: the old prices waiting to be checked, or adding prices. */}
      {reviewWaiting && !settings.legacyPricesDismissed && (
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-700">
            {settings.legacyPriceCount.toLocaleString()} product{settings.legacyPriceCount === 1 ? '' : 's'} have an old
            price from before. Check them and use the right ones as selling prices.
          </p>
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="shrink-0 self-start rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Check old prices
          </button>
        </div>
      )}
      {on && canPrice && (!reviewWaiting || settings.legacyPricesDismissed) && (
        <div className="border-t border-neutral-100 pt-4">
          <Link
            to="/app/products?price=none"
            className="rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            Add selling prices
          </Link>
          {reviewWaiting && (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="ml-4 rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Check old prices
            </button>
          )}
        </div>
      )}

      {reviewOpen && (
        <LegacyPriceReviewSheet
          total={settings.legacyPriceCount}
          onClose={() => setReviewOpen(false)}
          onUpdated={(updated) => setData(updated)}
        />
      )}
    </section>
  )
}
