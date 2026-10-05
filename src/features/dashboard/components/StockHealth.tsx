import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/Skeleton'
import { formatNumber } from '@/features/products/unitCopy'

export interface StockHealthCounts {
  /** Active products, all of them. */
  all: number
  OK: number
  LOW: number
  OUT: number
}

const SEGMENTS = [
  { key: 'OK', label: 'Well stocked', bar: 'bg-neutral-400', dot: 'bg-neutral-400', href: '/app/products?stockStatus=OK' },
  { key: 'LOW', label: 'Low', bar: 'bg-warning-500', dot: 'bg-warning-500', href: '/app/products?stockStatus=LOW' },
  { key: 'OUT', label: 'Out', bar: 'bg-danger-600', dot: 'bg-danger-600', href: '/app/products?stockStatus=OUT' },
] as const

/**
 * Stock health in one line (C5, finding U7): every active product, as one bar split well / low /
 * out, with each count a link to that chip on the Inventory list. It replaces three cards that
 * each held one number, and — Pattern B — the "well stocked" share is what makes the alarms
 * legible: three out of 24 is a different morning from three out of three.
 *
 * Healthy is grey and the alarms carry the colour, as everywhere else (plan §2: calm by default).
 */
export function StockHealth({ counts }: { counts: StockHealthCounts | null }) {
  if (!counts) {
    return <Skeleton className="h-24 w-full rounded-lg" />
  }
  const total = counts.OK + counts.LOW + counts.OUT
  return (
    <section aria-labelledby="stock-health-heading" className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="stock-health-heading" className="text-sm font-semibold text-neutral-900">
          Stock health
        </h2>
        <p className="text-sm text-neutral-500 tabular-nums">{formatNumber(counts.all)} active products</p>
      </div>
      {total > 0 && (
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
          {SEGMENTS.map((segment) =>
            counts[segment.key] > 0 ? (
              <div key={segment.key} className={segment.bar} style={{ width: `${(counts[segment.key] / total) * 100}%` }} />
            ) : null,
          )}
        </div>
      )}
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {SEGMENTS.map((segment) => (
          <li key={segment.key}>
            <Link
              to={segment.href}
              className="flex items-baseline gap-2 rounded-sm text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              data-health={segment.key}
            >
              <span className={`h-2.5 w-2.5 shrink-0 self-center rounded-full ${segment.dot}`} aria-hidden="true" />
              <span className="text-lg font-semibold text-neutral-900 tabular-nums">{formatNumber(counts[segment.key])}</span>
              <span className="text-neutral-600">{segment.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
