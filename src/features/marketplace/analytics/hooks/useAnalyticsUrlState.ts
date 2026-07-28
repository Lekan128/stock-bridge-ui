import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  defaultDateRange,
  fromDateInputValue,
  resolvePresetRange,
  toDateInputValue,
  type DateRange,
  type DateRangePreset,
} from '@/components/analytics/dateRange'
import type { CustomerMetric, Granularity, ProductMetric } from '@/features/marketplace/analytics/types'

const PRESETS: DateRangePreset[] = ['thisWeek', 'thisMonth', 'lastMonth', 'thisQuarter', 'custom']
const GRANULARITIES: Granularity[] = ['DAY', 'WEEK', 'MONTH']
const CUSTOMER_METRICS: CustomerMetric[] = ['REVENUE', 'ORDERS']
const PRODUCT_METRICS: ProductMetric[] = ['REVENUE', 'QUANTITY']

export interface AnalyticsUrlState {
  range: DateRange
  granularity: Granularity
  customerMetric: CustomerMetric
  productMetric: ProductMetric
  setRange: (range: DateRange) => void
  setGranularity: (granularity: Granularity) => void
  setCustomerMetric: (metric: CustomerMetric) => void
  setProductMetric: (metric: ProductMetric) => void
}

function oneOf<T extends string>(raw: string | null, allowed: T[], fallback: T): T {
  return raw !== null && (allowed as string[]).includes(raw) ? (raw as T) : fallback
}

/**
 * Every control on the page, held in the query string.
 *
 * The point is shareability: an analytics screen exists to be sent to somebody ("look at
 * March, ranked by orders"), and state trapped in `useState` makes that impossible — the
 * recipient opens the default view and has to be told which knobs to turn. It also makes
 * the browser Back button work through a comparison, which is how people actually read
 * these screens.
 *
 * A named preset is stored as the NAME, not as the dates it resolved to. A link saying
 * "This Month" should mean this month whenever it is opened, not the month it was copied
 * in. Only `custom` writes concrete dates.
 *
 * Anything unrecognised falls back silently rather than erroring: these values come off a
 * URL a human can edit and a stale bookmark can carry, and a hand-mangled `granularity`
 * must degrade to the default view, never to a broken page.
 */
export function useAnalyticsUrlState(): AnalyticsUrlState {
  const [searchParams, setSearchParams] = useSearchParams()

  const preset = oneOf<DateRangePreset>(searchParams.get('preset'), PRESETS, 'thisMonth')
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const range = useMemo<DateRange>(() => {
    if (preset !== 'custom') return { preset, ...resolvePresetRange(preset) }

    // A custom range needs both halves; half a range is not a range.
    if (!fromParam || !toParam) return defaultDateRange()
    const from = fromDateInputValue(fromParam)
    const to = fromDateInputValue(toParam, true)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return defaultDateRange()
    return { preset: 'custom', from, to }
  }, [preset, fromParam, toParam])

  // `replace` on every write: the range and the toggles are a view, not a navigation.
  // Pushing a history entry per toggle would make Back a per-click undo instead of the
  // "take me off this screen" it needs to be.
  const update = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          mutate(next)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setRange = useCallback(
    (next: DateRange) => {
      update((params) => {
        params.set('preset', next.preset)
        if (next.preset === 'custom') {
          params.set('from', toDateInputValue(next.from))
          params.set('to', toDateInputValue(next.to))
        } else {
          // Leaving stale dates behind would make the URL read as though it pinned a
          // window that the preset is actually recomputing on every open.
          params.delete('from')
          params.delete('to')
        }
      })
    },
    [update],
  )

  const setParam = useCallback(
    (key: string, value: string) => update((params) => params.set(key, value)),
    [update],
  )

  return {
    range,
    granularity: oneOf<Granularity>(searchParams.get('granularity'), GRANULARITIES, 'DAY'),
    customerMetric: oneOf<CustomerMetric>(searchParams.get('customerMetric'), CUSTOMER_METRICS, 'REVENUE'),
    productMetric: oneOf<ProductMetric>(searchParams.get('productMetric'), PRODUCT_METRICS, 'REVENUE'),
    setRange,
    setGranularity: useCallback((value: Granularity) => setParam('granularity', value), [setParam]),
    setCustomerMetric: useCallback((value: CustomerMetric) => setParam('customerMetric', value), [setParam]),
    setProductMetric: useCallback((value: ProductMetric) => setParam('productMetric', value), [setParam]),
  }
}
