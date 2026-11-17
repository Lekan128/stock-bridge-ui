import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { api } from '@/api/client'
import { useApiQuery } from '@/data/useApiQuery'
import { toApiDateTime, type DateRange } from '@/components/analytics/dateRange'
import { formatMoney } from '@/features/selling/money'
import { formatNumber } from '@/features/products/unitCopy'

interface AreaUseIngredient {
  productId: string
  name: string
  stockUnit?: string
  cameIn: number
  platesTook: number
  platesTookCost?: number
  counted: boolean
  usedOnTop?: number
  usedOnTopCost?: number
  left: number
}

interface AreaUse {
  areaId: string
  areaName?: string
  ingredients: AreaUseIngredient[]
  platesTookCost?: number
  counted: boolean
  usedOnTopCost?: number
  lastCountedAt?: string
}

const PERIOD_WORDS: Partial<Record<DateRange['preset'], string>> = {
  today: 'today',
  thisWeek: 'this week',
  thisMonth: 'this month',
  lastMonth: 'last month',
  thisQuarter: 'this quarter',
}

const UNIT_WORDS: Record<string, string> = { KG: 'kg', G: 'g', LITER: 'L', LITRE: 'L', ML: 'ml', PIECE: '' }
const amount = (value: number, unit?: string) => {
  const word = unit ? (UNIT_WORDS[unit] ?? unit.toLowerCase()) : ''
  return `${formatNumber(value)}${word ? ` ${word}` : ''}`
}

/**
 * "Kitchen this month" on Stock movements (selling till Step 6; owner, 2026-11-17): one line, closed until tapped,
 * for an area that makes what is sold - what the plates took of its ingredients and, once counted, what was used on
 * top. Follows the page's period. Nothing at all where the plates took nothing (the page is as before).
 */
export function AreaUseLine({ branchId, areaId, range, rangeLabel }: { branchId: string; areaId: string; range: DateRange; rangeLabel: string }) {
  const [open, setOpen] = useState(false)
  const from = toApiDateTime(range.from)
  const to = toApiDateTime(range.to)
  const query = useApiQuery<AreaUse>({
    queryKey: ['area-use', branchId, areaId, from, to],
    queryFn: () =>
      api.get<AreaUse>('/api/stock/movements/area-use', { params: { branchId, areaId, from, to } }).then((r) => r.data),
    fallbackError: "Couldn't load what the area used.",
  })
  const use = query.data
  if (!use || use.ingredients.length === 0) return null
  const period = PERIOD_WORDS[range.preset] ?? rangeLabel
  const title = `${use.areaName ?? 'This area'} ${period}`
  const summary = use.counted
    ? use.usedOnTopCost != null
      ? use.usedOnTopCost > 0
        ? `${formatMoney(use.usedOnTopCost)} used on top of the plates`
        : 'Matched the plates'
      : 'Counted · some ingredients have no cost'
    : `Plates took ${use.platesTookCost != null ? `${formatMoney(use.platesTookCost)} of ingredients` : 'their ingredients'} · not counted yet`

  return (
    <section aria-label={title} className="overflow-hidden rounded-lg border border-neutral-200 bg-white" data-area-use>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50"
      >
        <span className="min-w-0 text-sm">
          <span className="font-semibold text-neutral-900">{title}</span>
          <span className="text-neutral-500"> · </span>
          <span className={use.counted && (use.usedOnTopCost ?? 0) > 0 ? 'font-medium text-warning-700' : 'text-neutral-600'}>{summary}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold text-primary-700">
          {open ? 'Hide' : 'See'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="border-t border-neutral-200">
          {/* A phone: each ingredient's figures under its name. */}
          <ul className="divide-y divide-neutral-100 md:hidden">
            {use.ingredients.map((line) => (
              <li key={line.productId} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm tabular-nums">
                <div className="flex items-baseline justify-between gap-3 font-medium text-neutral-900">
                  <span className="min-w-0 truncate">{line.name}</span>
                  <OnTop line={line} />
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-neutral-500">
                  <span>In {amount(line.cameIn, line.stockUnit)}</span>
                  <span>Plates took {amount(line.platesTook, line.stockUnit)}</span>
                  <span>
                    {line.counted ? 'Left' : 'Should be left'} {amount(line.left, line.stockUnit)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {/* A laptop: one table. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Ingredient</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Came in</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Plates sold took</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Counts found used on top</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Left now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {use.ingredients.map((line) => (
                  <tr key={line.productId}>
                    <td className="px-4 py-2.5 font-medium text-neutral-900">{line.name}</td>
                    <td className="px-4 py-2.5 text-right">{amount(line.cameIn, line.stockUnit)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {amount(line.platesTook, line.stockUnit)}
                      {line.platesTookCost != null && <span className="block text-xs text-neutral-500">{formatMoney(line.platesTookCost)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <OnTop line={line} withCost />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {amount(line.left, line.stockUnit)}
                      {!line.counted && <span className="block text-xs text-neutral-500">should be</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-xs text-neutral-600">
            {use.counted
              ? 'Used on top is what a count found gone beyond what the plates took, at cost.'
              : `Count the ${use.areaName ?? 'area'} to see what was used on top of the plates.`}
          </p>
        </div>
      )}
    </section>
  )
}

function OnTop({ line, withCost = false }: { line: AreaUseIngredient; withCost?: boolean }) {
  if (!line.counted || line.usedOnTop == null) return <span className="text-xs font-normal text-neutral-500">Not counted yet</span>
  if (line.usedOnTop <= 0) return <span className="font-medium text-accent-700">Matched</span>
  return (
    <span className="font-semibold text-warning-700">
      {amount(line.usedOnTop, line.stockUnit)} on top
      {line.usedOnTopCost != null && (withCost ? <span className="block text-xs font-normal">{formatMoney(line.usedOnTopCost)}</span> : ` · ${formatMoney(line.usedOnTopCost)}`)}
    </span>
  )
}
