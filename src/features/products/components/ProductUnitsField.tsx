import { useId, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
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
  /** Where stock-outs start: a unit key ("Derica", "BAG:50"), or '' for the stock unit. */
  usedIn: string
  /** The units a count opens in (V84), as unit keys; empty is the pack and the usual unit. */
  countIn: string[]
}

export function unitsDraftFrom(
  product: { measures?: ProductMeasure[]; usedInUnit?: string | null; countIn?: string[] } | null | undefined,
): UnitsDraft {
  return {
    measures: (product?.measures ?? []).map((measure) => ({
      key: measure.name.toLowerCase(),
      name: measure.name,
      size: String(measure.size),
      hidden: measure.hidden,
    })),
    usedIn: product?.usedInUnit ?? '',
    countIn: product?.countIn ?? [],
  }
}

/** What the request carries: the whole list (hidden ones kept as they are), or a reason it can't be sent yet. */
export function unitsPayload(
  draft: UnitsDraft,
  live: { stockUnitCode: string; packOption: UnitOption | null },
): { measures: ProductMeasure[]; usedInUnit: string; countIn: string[] } | { problem: string } {
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
  // The pack resized or the stock unit changed since a count unit was chosen: one that isn't a unit now goes.
  const packKey = live.packOption ? `${live.packOption.code}:${live.packOption.factorToStockUnit}`.toLowerCase() : null
  const countIn = draft.countIn.filter((key) => {
    const lower = key.toLowerCase()
    return lower === packKey || lower === live.stockUnitCode.toLowerCase() || measures.some((measure) => !measure.hidden && measure.name.toLowerCase() === lower)
  })
  return { measures, usedInUnit: draft.usedIn, countIn }
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
  otherKinds,
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
  /** Standard units of another kind it can also be used in, each with its conversion: "L" for oil kept in kg. */
  otherKinds: string[]
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
    // Nor is a count unit: the pack and the stock unit stay, an own unit stays while it's on the list.
    const countIn = draft.countIn.filter(
      (key) => key.includes(':') || key === stockUnitCode || rows.some((row) => !row.hidden && row.name.trim().toLowerCase() === key.toLowerCase()),
    )
    onChange({ ...draft, measures: rows, usedIn: stillThere ? usedIn : '', countIn })
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

  // Every unit it has, for "Count in": the pack, the stock unit, its own units - biggest first, as a shelf is counted.
  const packKey = packOption ? `${packOption.code}:${packOption.factorToStockUnit}` : null
  const readyMeasures = shown.filter((row) => row.name.trim() && !rowProblem(row, draft.measures))
  const countChoices: { key: string; label: string; size: number }[] = [
    ...(packOption && packKey ? [{ key: packKey, label: packOption.label, size: packOption.factorToStockUnit }] : []),
    { key: stockUnitCode, label: stockWord, size: 1 },
    ...readyMeasures.map((row) => ({ key: row.name.trim(), label: row.name.trim(), size: Number(row.size) })),
  ].sort((a, b) => b.size - a.size)
  const sameKey = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
  const chosenCount = draft.countIn.filter((key) => countChoices.some((choice) => sameKey(choice.key, key)))
  // Nothing chosen yet: what a count opens in by itself - the pack and the usual unit (else the stock unit).
  const usualKey =
    draft.usedIn && !draft.usedIn.includes(':') && readyMeasures.some((row) => sameKey(row.name.trim(), draft.usedIn))
      ? draft.usedIn
      : stockUnitCode
  const countOn = chosenCount.length > 0 ? chosenCount : [...(packKey ? [packKey] : []), usualKey]
  function toggleCount(key: string) {
    const on = countOn.some((other) => sameKey(other, key))
    if (on && countOn.length === 1) return
    const next = on ? countOn.filter((other) => !sameKey(other, key)) : [...countOn, key]
    onChange({ ...draft, countIn: countChoices.filter((choice) => next.some((other) => sameKey(other, choice.key))).map((choice) => choice.key) })
  }

  const startChoices: { key: string; label: string }[] = [
    { key: '', label: `${stockWord}, the stock unit` },
    ...(packOption ? [{ key: `${packOption.code}:${packOption.factorToStockUnit}`, label: packOption.label }] : []),
    ...shown.filter((row) => row.name.trim() && !rowProblem(row, draft.measures)).map((row) => ({ key: row.name.trim(), label: row.name.trim() })),
  ]

  return (
    <div id="units" className="flex scroll-mt-24 flex-col gap-3" data-product-units>
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
          {/* Standard units of another kind (owner, 2026-11-09): litres of oil kept in kg, pieces of yam kept in kg.
              Same-kind ones (g for kg) need nothing, so they aren't offered. */}
          {otherKinds.some((name) => !taken.has(name.toLowerCase())) && (
            <>
              <p className="mt-3 mb-1.5 text-xs font-medium text-neutral-600">Standard units, with what one holds</p>
              <div className="flex flex-wrap gap-2">
                {otherKinds.filter((name) => !taken.has(name.toLowerCase())).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => add(name)}
                    className="h-9 rounded-full border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:border-primary-400 hover:text-primary-800"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}
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
        <p className="text-xs text-neutral-500">
          {standardUnits.length > 1 ? `${standardUnits.slice(0, -1).join(', ')} and ${standardUnits.at(-1)}` : standardUnits[0]} work out by
          themselves.
        </p>
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
            Stock out opens in
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
          <p className="mt-1.5 text-xs text-neutral-500">
            Stock out, moves and quick mode open in this. Stock is still kept in {stockSymbol}, and deliveries open in
            the pack. Anyone can switch while recording.
          </p>
        </div>
      )}

      {/* The units a count opens in (owner, 2026-11-10), set once here so nobody picks them on every count. */}
      {countChoices.length > 1 && (
        <div>
          <p id={`${startId}-count`} className="mb-1.5 text-sm font-medium text-neutral-700">
            Count in
          </p>
          <div role="group" aria-labelledby={`${startId}-count`} className="flex flex-wrap gap-1.5" data-count-in>
            {countChoices.map((choice) => {
              const on = countOn.some((other) => sameKey(other, choice.key))
              return (
                <button
                  key={choice.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCount(choice.key)}
                  className={`inline-flex h-9 items-center gap-1 rounded-full border px-3 text-sm font-medium ${
                    on ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  {choice.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            A count opens with a box for each. Anyone counting can tap another on for that count.
          </p>
        </div>
      )}
    </div>
  )
}
