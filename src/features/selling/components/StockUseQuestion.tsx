import { useState } from 'react'
import { PERMISSIONS } from '@/auth/permissions'
import { useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/useToast'
import { sellingApi } from '@/features/selling/sellingApi'
import type { StockUse } from '@/features/selling/types'
import { useSellingSettings } from '@/features/selling/useSellingSettings'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { isAppError } from '@/types/api'

const ANSWERS: { value: StockUse; label: string }[] = [
  { value: 'USE', label: 'We use it to make or serve things' },
  { value: 'SELL', label: 'We sell it as it is' },
  { value: 'BOTH', label: 'Both' },
]

/**
 * "What happens to your stock?" - asked once, in the owner's setup checklist (`SELLING_PRICE_PLAN.md`
 * §5.1), after they have seen the app rather than at sign-up. The answers say what a business does,
 * so a bakery that sells bread and uses flour finds itself in "Both" without having to think.
 *
 * "Sell" and "Both" turn selling on; "Use" changes nothing else. All three are remembered on the
 * server, so the question never comes back on another phone. Gone once answered, and never asked of
 * a company that already sells or cannot choose.
 */
export function StockUseQuestion() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const online = useOnlineStatus()
  const { data: settings, setData } = useSellingSettings()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canAnswer = user?.type === 'tenant' && user.permissions.includes(PERMISSIONS.MANAGE_COMPANY_PROFILE)

  if (!canAnswer || !settings || !settings.available || settings.stockUse != null || settings.sellsStock) return null

  async function answer(stockUse: StockUse) {
    setSaving(true)
    setError(null)
    try {
      const sells = stockUse !== 'USE'
      setData(await sellingApi.update({ sellsStock: sells, source: 'FIRST_WEEK', stockUse }))
      if (sells) showToast('Selling is on. You can give your products a selling price.', 'success')
    } catch (err) {
      setError(isAppError(err) ? err.message : "Couldn't save that. Try again.")
      setSaving(false)
    }
  }

  return (
    <div className="border-b border-neutral-100 p-5" data-stock-use-question>
      <p id="stock-use-question" className="text-sm font-semibold text-neutral-900">
        What happens to your stock?
      </p>
      <div role="group" aria-labelledby="stock-use-question" className="mt-3 flex flex-wrap gap-2">
        {ANSWERS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={saving || !online}
            onClick={() => void answer(option.value)}
            className="min-h-10 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60"
          >
            {option.label}
          </button>
        ))}
      </div>
      {!online && <p className="mt-2 text-xs text-neutral-500">Answering needs a connection.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}
