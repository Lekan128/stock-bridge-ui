import { useState } from 'react'

const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })

/**
 * "Price against the loss, not against other software" (LANDING_PAGE_PLAN.md §1, the higher plans):
 * the visitor's own numbers, never ours. What goes missing in a month, beside what Procurepaddy costs.
 */
export function LossCalculator({ price = 10_000 }: { price?: number }) {
  // Fixed, not useId: an island hydrates on its own, so a generated id wouldn't match the page's.
  const id = 'loss'
  const [sales, setSales] = useState('3000000')
  const [percent, setPercent] = useState('1')
  const monthly = Number(sales.replace(/[^\d.]/g, '')) || 0
  const lost = (monthly * (Number(percent) || 0)) / 100

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-paper">
      <p className="font-semibold text-neutral-900">What goes missing costs more than the app</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-800" htmlFor={`${id}-sales`}>
          Stock you sell in a month (₦)
          <input
            id={`${id}-sales`}
            inputMode="numeric"
            value={sales}
            onChange={(event) => setSales(event.target.value)}
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-base tabular-nums focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-800" htmlFor={`${id}-percent`}>
          How much goes missing (%)
          <input
            id={`${id}-percent`}
            inputMode="decimal"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            className="min-h-11 rounded-md border border-neutral-300 px-3 text-base tabular-nums focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
          />
        </label>
      </div>
      <p className="mt-4 text-base text-neutral-800" aria-live="polite">
        You lose about <strong className="text-neutral-900 tabular-nums">{naira.format(lost)}</strong> a month, about{' '}
        <strong className="text-neutral-900 tabular-nums">{naira.format(lost * 12)}</strong> a year.{' '}
        {lost > price
          ? `That is ${Math.floor(lost / price)} times what Procurepaddy costs.`
          : 'Even one bag or carton a month that you can account for pays for it.'}
      </p>
      <p className="mt-2 text-sm text-neutral-600">Your figures stay on this page. Nothing is sent anywhere.</p>
    </div>
  )
}
