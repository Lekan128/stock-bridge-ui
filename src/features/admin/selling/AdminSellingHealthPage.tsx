import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/Badge'
import { ErrorState } from '@/components/ErrorState'
import { sellingHealthApi, type SellingHealth } from '@/features/admin/selling/sellingHealthApi'
import { formatDateTime } from '@/features/marketplace/formatters'
import { isAppError } from '@/types/api'

const WINDOWS = [14, 30, 60]

const VIA: Record<string, string> = {
  FIRST_WEEK: 'First-week question',
  IN_CONTEXT: 'Offered where needed (Sold, a sheet)',
  OWNER: 'Company settings',
  SUPPORT: 'Turned on by us',
  UNKNOWN: 'Not recorded',
}

const pct = (share?: number) => (share == null ? '–' : `${Math.round(share * 1000) / 10}%`)

/**
 * Selling health - route `/admin/selling` (`SELLING_PRICE_PLAN.md` §9, Phase 7). What the field test
 * and the rollout are judged on, against the plan's targets, two weeks at a time: are sales priced,
 * are their costs known, are prices fixed after the fact, which products' usual prices are wrong,
 * and how companies came to sell. The counter-speed target is measured in the field, not here.
 */
export function AdminSellingHealthPage() {
  const [days, setDays] = useState(14)
  const [health, setHealth] = useState<SellingHealth | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    sellingHealthApi
      .get(days)
      .then((next) => !cancelled && setHealth(next))
      .catch((err: unknown) => !cancelled && setError(isAppError(err) ? err.message : "Couldn't load selling health."))
    return () => {
      cancelled = true
    }
  }, [days])

  if (error) return <ErrorState message={error} onRetry={() => setDays((d) => d)} />

  const targets = health
    ? [
        { label: 'Sales with a price when recorded', value: pct(health.pricedShare), ok: health.pricedShare == null ? null : health.pricedShare > 0.95, target: 'above 95%' },
        { label: 'Priced sales with a known cost', value: pct(health.knownCostShare), ok: health.knownCostShare == null ? null : health.knownCostShare > 0.9, target: 'above 90%' },
        { label: 'Prices added later, per 100 lines', value: health.pricesAddedPer100 == null ? '–' : String(health.pricesAddedPer100), ok: health.pricesAddedPer100 == null ? null : health.pricesAddedPer100 <= 1, target: 'near 0' },
        { label: 'Lines sold at a changed price', value: pct(health.priceEditShare), ok: null, target: 'watch: high for one product means its price is wrong' },
        { label: 'Lines cancelled, per 100', value: health.cancelledPer100 == null ? '–' : String(health.cancelledPer100), ok: null, target: 'watch' },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Selling health</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            The figures the selling rollout is judged on (plan §9). Counter speed - a three-item sale in under 10 seconds - is timed
            in the field test, not here.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          Last
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {WINDOWS.map((window) => (
              <option key={window} value={window}>
                {window} days
              </option>
            ))}
          </select>
        </label>
      </div>

      {!health && <p className="text-sm text-neutral-500">Loading…</p>}
      {health && (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
            <Badge variant={health.rollout === 'open' ? 'success' : 'warning'}>{health.rollout === 'open' ? 'Open' : 'Pilot'}</Badge>
            {health.rollout === 'open'
              ? 'Every company is offered selling.'
              : 'Only ProcurePal and companies we have turned selling on for are offered it. Turn it on from a tenant to enrol them.'}
          </p>

          <section aria-labelledby="targets-heading" className="rounded-lg border border-neutral-200 bg-white">
            <h2 id="targets-heading" className="border-b border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-900">
              {health.companiesSelling} companies selling · {health.saleCount.toLocaleString()} sales · {health.lineCount.toLocaleString()} lines
            </h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-neutral-100">
                {targets.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="px-4 py-2.5 text-left font-normal text-neutral-700">{row.label}</th>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-neutral-900">{row.value}</td>
                    <td className="px-4 py-2.5 text-neutral-500">
                      {row.ok == null ? row.target : row.ok ? `On target (${row.target})` : `Below target (${row.target})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="via-heading" className="flex flex-col gap-2">
            <h2 id="via-heading" className="text-sm font-semibold text-neutral-900">How companies turned selling on</h2>
            {Object.keys(health.turnedOnVia).length === 0 ? (
              <p className="text-sm text-neutral-600">No company sells yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {Object.entries(health.turnedOnVia).map(([via, count]) => (
                  <li key={via} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700">
                    {VIA[via] ?? via} <span className="tabular-nums text-neutral-500">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {health.productsToCheck.length > 0 && (
            <section aria-labelledby="check-heading" className="flex flex-col gap-2">
              <h2 id="check-heading" className="text-sm font-semibold text-neutral-900">Usual prices that are probably wrong</h2>
              <p className="text-sm text-neutral-600">Changed at the till on at least half their sales. Worth a word with the shop.</p>
              <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                {health.productsToCheck.map((product) => (
                  <li key={product.productId} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                    <span>
                      <span className="font-medium text-neutral-900">{product.productName}</span>
                      <span className="text-neutral-500"> · {product.clientName}</span>
                    </span>
                    <span className="tabular-nums text-neutral-700">
                      {pct(product.editShare)} of {product.lines} lines
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="companies-heading" className="flex flex-col gap-2">
            <h2 id="companies-heading" className="text-sm font-semibold text-neutral-900">Companies</h2>
            <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium text-neutral-600">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">Company</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Sales</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Priced</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Cost known</th>
                    <th scope="col" className="px-4 py-2.5 text-right">Price changed</th>
                    <th scope="col" className="px-4 py-2.5">Last sale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {health.companies.map((company) => (
                    <tr key={company.clientId}>
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">
                        <Link to={`/admin/tenants/${company.clientId}`} className="text-primary-700 hover:underline">
                          {company.clientName}
                        </Link>
                      </th>
                      <td className="px-4 py-2.5 text-right tabular-nums">{company.saleCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{pct(company.pricedShare)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{pct(company.knownCostShare)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{pct(company.priceEditShare)}</td>
                      <td className="px-4 py-2.5 text-neutral-600">{company.lastSaleAt ? formatDateTime(company.lastSaleAt) : 'No sales yet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
