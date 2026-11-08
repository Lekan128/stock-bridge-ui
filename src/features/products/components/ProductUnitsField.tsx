import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ProductMeasure, UnitOption } from '@/features/products/types'
import { formatNumber } from '@/features/products/unitCopy'

/**
 * The measures we suggest first (UNITS_PLAN.md D-U2), in the order a Nigerian kitchen or market reaches for them -
 * the API's `ProductMeasures.SUGGESTED`. None comes with a size: a derica of rice and a derica of beans differ
 * (D-U3), so the kitchen weighs one.
 */
export const SUGGESTED_MEASURES = ['Derica', 'Cup', 'Mudu', 'Congo', 'Paint', 'Custard', 'Tiya', 'Kwano', 'Plate', 'Bowl', 'Spoon', 'Ladle']

const MAX_MEASURES = 8
const MAX_NAME = 24

/** One row being edited: the size as typed, so "0." can be on its way to "0.6". */
export interface MeasureDraft {
  key: string
  name: string
  size: string
  hidden?: boolean
}

export interface UnitsDraft {
  measures: MeasureDraft[]
  /** Where stock-outs and counts start: a unit key ("Derica", "BAG:50"), or '' for the stock unit. */
  usedIn: string
}

export function unitsDraftFrom(product: { measures?: ProductMeasure[]; usedInUnit?: string | null } | null | undefined): UnitsDraft {
  return {
    measures: (product?.measures ?? []).map((measure) => ({
      key: measure.name.toLowerCase(),
      name: measure.name,
      size: String(measure.size),
      hidden: measure.hidden,
    })),
    usedIn: product?.usedInUnit ?? '',
  }
}

/** What the request carries: the whole list (hidden ones kept as they are), or a reason it can't be sent yet. */
export function unitsPayload(draft: UnitsDraft): { measures: ProductMeasure[]; usedInUnit: string } | { problem: string } {
  const seen = new Set<string>()
  const measures: ProductMeasure[] = []
  for (const row of draft.measures) {
    const problem = rowProblem(row, draft.measures)
    if (problem) return { problem }
    const name = row.name.trim()
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    measures.push({ name, size: Number(row.size), hidden: row.hidden || undefined })
  }
  return { measures, usedInUnit: draft.usedIn }
}

function rowProblem(row: MeasureDraft, all: MeasureDraft[]): string | null {
  if (row.hidden) return null
  const name = row.name.trim()
  if (!name) return 'Give this unit a name, like Derica.'
  if (name.length > MAX_NAME) return `Keep the name to ${MAX_NAME} letters.`
  if (all.filter((other) => !other.hidden && other.name.trim().toLowerCase() === name.toLowerCase()).length > 1) {
    return `${name} is on this product twice.`
  }
  if (row.size.trim() === '') return `Say how much one ${name} holds.`
  const size = Number(row.size)
  if (!Number.isFinite(size) || size <= 0) return 'Type a number above 0.'
  if (!/^\d*(\.\d{0,3})?$/.test(row.size.trim())) return 'Up to 3 decimal places, like 0.625.'
  return null
}

/**
 * A product's own units, on its form (UNITS_PLAN.md Part 1, §5): "Also used in · Derica = 0.6 kg". Opens in place,
 * no popup (owner's form rules): **Add a unit** shows our list and *Name your own*; picking one adds a row whose
 * size is asked for right there. Below it, where stock-outs and counts start (Part 2) - the cook's Derica.
 *
 * Standard units of the same kind (g, t) need nothing: they're worked out by themselves, and said so.
 */
export function ProductUnitsField({
  draft,
  onChange,
  stockUnitCode,
  stockSymbol,
  standardUnits,
  packOption,
  stockWord,
}: {
  draft: UnitsDraft
  onChange: (draft: UnitsDraft) => void
  /** Nothing to be a number of until the stock unit is chosen. */
  stockUnitCode: string
  /** "kg", for "= 0.6 kg". */
  stockSymbol: string
  /** "g and t": the same-kind units that need no setting up. */
  standardUnits: string[]
  /** The product's own pack, for the "start in" choice. */
  packOption: UnitOption | null
  /** "kg", "pieces": the stock unit as the choice lists it. */
  stockWord: string
}) {
  const [adding, setAdding] = useState(false)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const startId = useId()
  const shown = draft.measures.filter((row) => !row.hidden)
  const hidden = draft.measures.filter((row) => row.hidden)
  const taken = new Set(draft.measures.map((row) => row.name.trim().toLowerCase()))

  function update(rows: MeasureDraft[], usedIn = draft.usedIn) {
    // A start unit that was taken off isn't one any more.
    const stillThere =
      !usedIn || usedIn.includes(':') || rows.some((row) => !row.hidden && row.name.trim().toLowerCase() === usedIn.toLowerCase())
    onChange({ measures: rows, usedIn: stillThere ? usedIn : '' })
  }

  function add(name: string) {
    setAdding(false)
    const key = `${name.toLowerCase() || 'new'}-${Date.now()}`
    update([...draft.measures, { key, name, size: '' }])
    window.requestAnimationFrame(() => document.getElementById(name ? `measure-size-${key}` : `measure-name-${key}`)?.focus())
  }

  if (!stockUnitCode) {
    return (
      <div data-product-units>
        <h3 className="text-sm font-medium text-neutral-700">Also used in</h3>
        <p className="mt-1 text-xs text-neutral-500">Choose what it's counted in first. Each unit is a number of it.</p>
      </div>
    )
  }

  const startChoices: { key: string; label: string }[] = [
    { key: '', label: `${stockWord} (what it's counted in)` },
    ...(packOption ? [{ key: `${packOption.code}:${packOption.factorToStockUnit}`, label: packOption.label }] : []),
    ...shown.filter((row) => row.name.trim() && !rowProblem(row, draft.measures)).map((row) => ({ key: row.name.trim(), label: row.name.trim() })),
  ]

  return (
    <div className="flex flex-col gap-3" data-product-units>
      <div>
        <h3 className="text-sm font-medium text-neutral-700">Also used in</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Bought in bags but used in dericas or cups? Add them here. Weigh or count one, level, and type what it holds.
        </p>
      </div>

      {shown.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="This product's own units">
          {shown.map((row) => {
            const problem = touched.has(row.key) ? rowProblem(row, draft.measures) : null
            const name = row.name.trim() || 'this unit'
            return (
              <li key={row.key} data-measure={row.name.trim()}>
                <div className="flex items-center gap-2">
                  <label htmlFor={`measure-name-${row.key}`} className="sr-only">
                    Unit name
                  </label>
                  <input
                    id={`measure-name-${row.key}`}
                    value={row.name}
                    maxLength={MAX_NAME}
                    placeholder="Name"
                    onChange={(event) =>
                      update(draft.measures.map((other) => (other.key === row.key ? { ...other, name: event.target.value } : other)))
                    }
                    onBlur={() => setTouched((current) => new Set(current).add(row.key))}
                    className="w-32 min-w-0 rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:w-40"
                  />
                  <span aria-hidden="true" className="text-sm text-neutral-500">
                    =
                  </span>
                  <label htmlFor={`measure-size-${row.key}`} className="sr-only">
                    How much one {name} holds, in {stockSymbol}
                  </label>
                  <div className="relative w-28 sm:w-32">
                    <input
                      id={`measure-size-${row.key}`}
                      value={row.size}
                      inputMode="decimal"
                      placeholder="0.6"
                      aria-invalid={problem ? true : undefined}
                      aria-describedby={problem ? `measure-problem-${row.key}` : undefined}
                      onChange={(event) =>
                        update(draft.measures.map((other) => (other.key === row.key ? { ...other, size: event.target.value } : other)))
                      }
                      onBlur={() => setTouched((current) => new Set(current).add(row.key))}
                      className={`w-full rounded-md border py-2 pr-10 pl-3 text-sm text-neutral-900 tabular-nums focus:ring-2 focus:outline-none ${
                        problem ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-100' : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
                      }`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-neutral-500">{stockSymbol}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => update(draft.measures.filter((other) => other.key !== row.key))}
                    aria-label={`Take ${name} off`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {problem && (
                  <p id={`measure-problem-${row.key}`} role="alert" className="mt-1 text-xs text-danger-600">
                    {problem}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {adding ? (
        // Our list, then the kitchen's own word: one tap adds the row, its size asked for right there.
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3" role="group" aria-label="Add a unit">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_MEASURES.filter((name) => !taken.has(name.toLowerCase())).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => add(name)}
                className="h-9 rounded-full border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:border-primary-400 hover:text-primary-800"
              >
                {name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => add('')}
              className="h-9 rounded-full border border-dashed border-neutral-400 bg-white px-3 text-sm font-medium text-primary-700 hover:border-primary-400"
            >
              Name your own
            </button>
          </div>
          <button type="button" onClick={() => setAdding(false)} className="mt-2 text-xs font-medium text-neutral-600 hover:underline">
            Close
          </button>
        </div>
      ) : (
        shown.length < MAX_MEASURES && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-10 items-center gap-1.5 self-start rounded-md px-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a unit
          </button>
        )
      )}

      {standardUnits.length > 0 && (
        <p className="text-xs text-neutral-500">{standardUnits.join(' and ')} work out by themselves.</p>
      )}

      {hidden.length > 0 && (
        <div className="text-xs text-neutral-600" data-hidden-measures>
          <span>Not offered any more, kept for past entries: </span>
          {hidden.map((row, index) => (
            <span key={row.key}>
              {index > 0 && ' · '}
              {row.name} ({formatNumber(Number(row.size))} {stockSymbol}){' '}
              <button
                type="button"
                onClick={() => update(draft.measures.map((other) => (other.key === row.key ? { ...other, hidden: false } : other)))}
                className="font-medium text-primary-700 hover:underline"
              >
                Offer again
              </button>
            </span>
          ))}
        </div>
      )}

      {startChoices.length > 1 && (
        <div>
          <label htmlFor={startId} className="mb-1.5 block text-sm font-medium text-neutral-700">
            Start stock out and counts in
          </label>
          <select
            id={startId}
            value={startChoices.some((choice) => choice.key.toLowerCase() === draft.usedIn.toLowerCase()) ? draft.usedIn : ''}
            onChange={(event) => onChange({ ...draft, usedIn: event.target.value })}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none sm:max-w-xs"
          >
            {startChoices.map((choice) => (
              <option key={choice.key || 'stock'} value={choice.key}>
                {choice.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-neutral-500">Also moves and quick mode. Deliveries start in the pack. Anyone can switch while recording.</p>
        </div>
      )}
    </div>
  )
}
