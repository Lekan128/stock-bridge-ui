const currencyFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
const compactCurrencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const compactNumberFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const numberFormatter = new Intl.NumberFormat(undefined)
const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' })
const rangeFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

export function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter.format(value)
}

export function formatCompactNumber(value: number): string {
  return compactNumberFormatter.format(value)
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatDateRange(from: Date, to: Date): string {
  return `${rangeFormatter.format(from)} – ${rangeFormatter.format(to)}`
}

/**
 * Formats a "YYYY-MM-DD" bucket period for chart axes/tooltips, by granularity.
 * `compact` drops the "Wk of" prefix for week buckets — used on narrow axis ticks,
 * where the full label collides with its neighbors; tooltips always use the full form.
 */
export function formatPeriod(period: string, granularity: 'day' | 'week' | 'month', compact = false): string {
  const date = new Date(`${period}T00:00:00`)
  if (granularity === 'month') return monthFormatter.format(date)
  if (granularity === 'week') return compact ? dayFormatter.format(date) : `Wk of ${dayFormatter.format(date)}`
  return dayFormatter.format(date)
}
