import { useMemo, useRef, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useProductFinder } from '@/features/catalog/useProductFinder'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { unitsFor } from '@/features/selling/sale/saleLine'
import { formatMoney } from '@/features/selling/money'
import { productsApi } from '@/features/products/api/productsApi'
import type { MadeWith, MadeWithPayload } from '@/features/products/madeWith'
import type { Product, UnitOption } from '@/features/products/types'
import type { Branch } from '@/features/branches/types'

/** One ingredient row being edited: the amount as typed, in one of its units. */
export interface IngredientDraft {
  productId: string
  name: string
  quantity: string
  unitCode: string
  options: UnitOption[]
  /** Per stock unit. */
  costPrice: number | null
}

export interface MadeWithDraft {
  madeIn: string | null
  /** For a branch the item is for that has no area named like `madeIn`: the area chosen there. */
  madeInAt: Record<string, string>
  ingredients: IngredientDraft[]
}

export const EMPTY_MADE_WITH: MadeWithDraft = { madeIn: null, madeInAt: {}, ingredients: [] }

/** The saved "Made with", as the form edits it. */
export function draftFromMadeWith(saved: MadeWith): MadeWithDraft {
  const madeInAt: Record<string, string> = {}
  for (const at of saved.branches) if (at.chosenForBranch && at.areaId) madeInAt[at.branchId] = at.areaId
  return {
    madeIn: saved.madeIn ?? null,
    madeInAt,
    ingredients: saved.ingredients.map((line) => {
      const option =
        line.unitOptions.find((candidate) => line.unit != null && candidate.code === line.unit) ??
        line.unitOptions.find((candidate) => candidate.isStockUnit) ??
        line.unitOptions[0]
      return {
        productId: line.productId,
        name: line.name,
        quantity: String(line.quantity),
        unitCode: option?.code ?? '',
        options: line.unitOptions,
        costPrice: line.costPrice ?? null,
      }
    }),
  }
}

function lineCost(line: IngredientDraft): number | null {
  const amount = Number(line.quantity)
  const option = line.options.find((candidate) => candidate.code === line.unitCode)
  if (line.costPrice == null || !option || !Number.isFinite(amount) || amount <= 0) return null
  return Math.round(line.costPrice * option.factorToStockUnit * amount * 100) / 100
}

/** What the ingredients cost at cost price; null while any has none. */
export function costToMake(draft: MadeWithDraft): number | null {
  if (draft.ingredients.length === 0) return null
  let total = 0
  for (const line of draft.ingredients) {
    const cost = lineCost(line)
    if (cost == null) return null
    total += cost
  }
  return total
}

/** The branches an item is for that this person sees, open ones only. */
function itemBranches(branches: Branch[], forBranches: { all: boolean; ids: string[] }): Branch[] {
  const open = branches.filter((branch) => branch.active)
  return forBranches.all ? open : open.filter((branch) => forBranches.ids.includes(branch.id))
}

const openAreas = (branch: Branch) => (branch.areas ?? []).filter((area) => area.active)

const hasNamed = (branch: Branch, name: string | null) =>
  name != null && openAreas(branch).some((area) => area.name.toLowerCase() === name.toLowerCase())

/**
 * Who "Made in" asks (owner, 2026-11-21): only the branches the item is for, and of those only a branch with more
 * than one area - a branch with one area makes it there, nothing to ask. The names offered are those branches' areas.
 */
function madeInAsked(branches: Branch[], forBranches: { all: boolean; ids: string[] }) {
  const mine = itemBranches(branches, forBranches)
  const asked = mine.filter((branch) => openAreas(branch).length > 1)
  const names = new Map<string, string>()
  for (const branch of asked) {
    for (const area of openAreas(branch)) if (!names.has(area.name.toLowerCase())) names.set(area.name.toLowerCase(), area.name)
  }
  return { mine, asked, names }
}

/** The "Made in" name as offered, or null when it isn't one of the names offered (the "For" branches changed). */
function offeredName(names: Map<string, string>, madeIn: string | null): string | null {
  return madeIn == null ? null : (names.get(madeIn.toLowerCase()) ?? null)
}

/**
 * Anything missing before it can be saved, in a sentence: an amount, "Made in", or a branch's own area. Null when
 * it can be. When none of the branches it is for has more than one area, "Made in" isn't asked - each branch's one
 * area is where it is made.
 */
export function madeWithProblem(
  draft: MadeWithDraft,
  branches: Branch[],
  forBranches: { all: boolean; ids: string[] },
): string | null {
  if (draft.ingredients.length === 0) return null
  const empty = draft.ingredients.find((line) => !(Number(line.quantity) > 0))
  if (empty) return `Say how much ${empty.name} goes into one.`
  const { asked, names } = madeInAsked(branches, forBranches)
  if (asked.length === 0) return null
  const madeIn = offeredName(names, draft.madeIn)
  if (!madeIn) return 'Choose where it is made.'
  const missing = asked.find((branch) => !hasNamed(branch, madeIn) && !draft.madeInAt[branch.id])
  return missing ? `Choose where it is made at ${missing.name}.` : null
}

/** The request for `PUT /made-with`. */
export function madeWithPayload(
  draft: MadeWithDraft,
  branches: Branch[],
  forBranches: { all: boolean; ids: string[] },
): MadeWithPayload {
  const ingredients = draft.ingredients.map((line) => {
    const option = line.options.find((candidate) => candidate.code === line.unitCode)
    return {
      productId: line.productId,
      quantity: Number(line.quantity),
      ...(option && !option.isStockUnit ? { unit: option.code } : {}),
    }
  })
  const { mine, asked, names } = madeInAsked(branches, forBranches)
  if (asked.length === 0 && ingredients.length > 0) {
    // Nothing asked: each branch's one area. Named after the main branch's; any branch whose one area is named
    // differently is given it.
    const home = mine.find((branch) => branch.main) ?? mine[0]
    const madeIn = (home ? openAreas(home)[0]?.name : null) ?? null
    const madeInAt = mine
      .filter((branch) => !hasNamed(branch, madeIn))
      .flatMap((branch) => {
        const only = openAreas(branch)[0]
        return only ? [{ branchId: branch.id, areaId: only.id }] : []
      })
    return { madeIn, madeInAt, ingredients }
  }
  const madeIn = offeredName(names, draft.madeIn)
  // A branch without an area of that name: its one area, or the one chosen there.
  const madeInAt = mine
    .filter((branch) => !hasNamed(branch, madeIn))
    .flatMap((branch) => {
      const areas = openAreas(branch)
      const areaId = areas.length === 1 ? areas[0].id : draft.madeInAt[branch.id]
      return areaId ? [{ branchId: branch.id, areaId }] : []
    })
  return { madeIn, madeInAt, ingredients }
}

interface MadeWithEditorProps {
  value: MadeWithDraft
  onChange: (value: MadeWithDraft) => void
  forBranches: { all: boolean; ids: string[] }
  /** Its selling price, for the profit. */
  price: number | null
  /** The item itself, never its own ingredient. */
  itemId?: string
}

/**
 * "Made with" on a made-here item (selling till Step 5): where it is made, and what goes into one, each in any unit
 * the ingredient has (1 Derica of rice). Adding an ingredient opens a search right under the list - no popup. Any
 * kept-in-stock product can be one, with or without stock. On a laptop the cost sits beside the list.
 */
export function MadeWithEditor({ value, onChange, forBranches, price, itemId }: MadeWithEditorProps) {
  const { branches } = useWorkingBranch()
  const { options: catalogue } = useUnitOfMeasureOptions()
  const [adding, setAdding] = useState(false)
  // A phone: the search moves to the top of the screen when opened, so what's typed and what it finds sit above
  // the keyboard - nothing to scroll to see them (owner, 2026-11-17).
  const searchBox = useRef<HTMLLabelElement>(null)
  const toTop = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) return
    window.setTimeout(() => searchBox.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250)
  }
  const [term, setTerm] = useState('')

  const { asked, names } = useMemo(() => madeInAsked(branches, forBranches), [branches, forBranches])
  const areaNames = [...names.values()]
  const showMadeIn = asked.length > 0
  const madeIn = offeredName(names, value.madeIn)
  const needChoice = madeIn ? asked.filter((branch) => !hasNamed(branch, madeIn)) : []

  // The newest value, for an answer that arrives after more edits.
  const latest = useRef(value)
  latest.current = value
  const set = (patch: Partial<MadeWithDraft>) => onChange({ ...value, ...patch })
  const setLine = (index: number, patch: Partial<IngredientDraft>) =>
    set({ ingredients: value.ingredients.map((line, at) => (at === index ? { ...line, ...patch } : line)) })

  const pick = (product: Product) => {
    if (product.id === itemId || value.ingredients.some((line) => line.productId === product.id)) return
    const options = unitsFor(product, catalogue)
    const stock = options.find((option) => option.isStockUnit) ?? options[0]
    set({
      ingredients: [
        ...value.ingredients,
        { productId: product.id, name: product.name, quantity: '', unitCode: stock?.code ?? '', options, costPrice: product.costPrice ?? null },
      ],
    })
    setTerm('')
    setAdding(false)
    // The phone's copy carries no cost price: the server's product has it, and its exact units.
    void productsApi
      .get(product.id)
      .then((full) => {
        latest.current = {
          ...latest.current,
          ingredients: latest.current.ingredients.map((line) =>
            line.productId === full.id
              ? { ...line, costPrice: full.costPrice ?? null, options: full.unitOptions?.length ? unitsFor(full, catalogue) : line.options }
              : line,
          ),
        }
        onChange(latest.current)
      })
      .catch(() => {})
    // The new row's amount box takes the focus, ready to type.
    window.setTimeout(() => document.getElementById(`ingredient-amount-${product.id}`)?.focus(), 0)
  }
  const finder = useProductFinder(term, pick, 6)
  const results = finder.results.filter((product) => product.id !== itemId && !value.ingredients.some((line) => line.productId === product.id))

  const total = costToMake(value)
  const profit = total != null && price != null ? price - total : null

  const summary = (
    <div className="grid grid-cols-3 gap-2 rounded-lg bg-primary-50 px-3 py-2.5 text-center tabular-nums lg:px-5 lg:text-left">
      <div>
        <p className="text-xs text-neutral-600">Costs to make</p>
        <p className="text-base font-semibold text-neutral-900">{total != null ? formatMoney(total) : '—'}</p>
      </div>
      <div>
        <p className="text-xs text-neutral-600">Sells for</p>
        <p className="text-base font-semibold text-neutral-900">{price != null ? formatMoney(price) : '—'}</p>
      </div>
      <div>
        <p className="text-xs text-neutral-600">Profit</p>
        <p className={`text-base font-semibold ${profit != null && profit < 0 ? 'text-danger-700' : 'text-accent-700'}`}>
          {profit != null ? `${formatMoney(profit)}${price ? ` (${Math.round((profit / price) * 100)}%)` : ''}` : '—'}
        </p>
      </div>
      {value.ingredients.length > 0 && total == null && (
        <p className="col-span-3 text-xs text-neutral-600">An ingredient has no cost price yet, so the cost can't be worked out.</p>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      {showMadeIn && (
        <div className="flex flex-col gap-3 sm:max-w-md">
          <div>
            <label htmlFor="made-in" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Made in
            </label>
            <select
              id="made-in"
              value={madeIn ?? ''}
              onChange={(event) => set({ madeIn: event.target.value || null })}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose an area</option>
              {areaNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-neutral-500">The ingredients come out of this area at the branch where it's sold.</p>
          </div>
          {needChoice.map((branch) => (
            <div key={branch.id}>
              <label htmlFor={`made-in-${branch.id}`} className="mb-1.5 block text-sm font-medium text-neutral-700">
                At {branch.name} (no {madeIn} there), made in
              </label>
              <select
                id={`made-in-${branch.id}`}
                value={value.madeInAt[branch.id] ?? ''}
                onChange={(event) => set({ madeInAt: { ...value.madeInAt, [branch.id]: event.target.value } })}
                className={`w-full rounded-md border bg-white px-3 py-2 text-sm ${value.madeInAt[branch.id] ? 'border-neutral-300' : 'border-primary-500 ring-1 ring-primary-500'}`}
              >
                <option value="">Choose an area</option>
                {openAreas(branch).map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-sm font-medium text-neutral-700">Made with, for one</p>
          {value.ingredients.length > 0 && (
            <div className="rounded-lg border border-neutral-200" data-ingredients>
              <div className="hidden grid-cols-[minmax(0,1fr)_6rem_8rem_6rem_2.25rem] gap-3 border-b border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-500 lg:grid">
                <span>Ingredient</span>
                <span className="text-right">Amount</span>
                <span>Unit</span>
                <span className="text-right">Cost</span>
                <span />
              </div>
              {value.ingredients.map((line, index) => {
                const cost = lineCost(line)
                const option = line.options.find((candidate) => candidate.code === line.unitCode)
                const stock = line.options.find((candidate) => candidate.isStockUnit)
                return (
                  <div
                    key={line.productId}
                    className="grid grid-cols-[minmax(0,1fr)_4rem_6rem_2.25rem] items-center gap-2 border-b border-neutral-100 px-3 py-2 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_5.5rem_8rem_7rem_2.25rem] lg:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{line.name}</p>
                      <p className="truncate text-xs text-neutral-500 tabular-nums lg:hidden">
                        {cost != null ? formatMoney(cost) : line.costPrice == null ? 'No cost price yet' : ''}
                      </p>
                      {line.costPrice != null && stock && (
                        <p className="hidden text-xs text-neutral-500 lg:block">
                          {formatMoney(line.costPrice)} a {stock.label}
                        </p>
                      )}
                    </div>
                    <input
                      id={`ingredient-amount-${line.productId}`}
                      aria-label={`How much ${line.name} for one`}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) => setLine(index, { quantity: event.target.value.replace(/[^0-9.]/g, '') })}
                      className={`w-full rounded-md border px-2 py-1.5 text-right text-sm tabular-nums ${
                        line.quantity && Number(line.quantity) > 0 ? 'border-neutral-300' : 'border-primary-500 ring-1 ring-primary-500'
                      }`}
                    />
                    <select
                      aria-label={`Unit for ${line.name}`}
                      value={line.unitCode}
                      onChange={(event) => setLine(index, { unitCode: event.target.value })}
                      className="w-full min-w-0 rounded-md border border-neutral-300 bg-white px-1.5 py-1.5 text-sm"
                    >
                      {line.options.map((candidate) => (
                        <option key={candidate.code} value={candidate.code}>
                          {candidate.label}
                        </option>
                      ))}
                    </select>
                    <span className="hidden text-right text-sm tabular-nums text-neutral-700 lg:block">
                      {cost != null ? formatMoney(cost) : '—'}
                      {option && !option.isStockUnit && stock && Number(line.quantity) > 0 && (
                        <span className="block text-xs text-neutral-500">
                          {+(Number(line.quantity) * option.factorToStockUnit).toFixed(3)} {stock.label}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => set({ ingredients: value.ingredients.filter((_, at) => at !== index) })}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {adding ? (
            <div className="flex flex-col gap-2">
              <label ref={searchBox} className="relative block scroll-mt-3">
                <span className="sr-only">Search for an ingredient</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  autoFocus
                  onFocus={toTop}
                  type="search"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      finder.onEnter()
                    }
                    if (event.key === 'Escape') setAdding(false)
                  }}
                  placeholder="Search for an ingredient…"
                  className="w-full rounded-md border-2 border-primary-500 py-2 pl-9 pr-3 text-sm focus:outline-none"
                />
              </label>
              {term.trim() !== '' && (
                <ul className="rounded-lg border border-neutral-200" aria-label="Ingredients found">
                  {results.length === 0 && finder.answered && (
                    <li className="px-3 py-3 text-sm text-neutral-500">Nothing kept in stock matches “{term.trim()}”.</li>
                  )}
                  {results.map((product) => (
                    <li key={product.id} className="border-b border-neutral-100 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => pick(product)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-neutral-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-neutral-900">{product.name}</span>
                          <span className="block text-xs text-neutral-500">
                            {product.quantityOnHand > 0 ? 'In stock' : 'None in stock yet'}
                            {product.categoryName ? ` · ${product.categoryName}` : ''}
                          </span>
                        </span>
                        <Plus className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => setAdding(false)} className="self-start text-sm font-medium text-neutral-600 hover:underline">
                Done adding
              </button>
              {/* Room under the search on a phone, so it can move to the top of the screen above the keyboard. */}
              <div aria-hidden="true" className="h-[55vh] lg:hidden" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-neutral-300 text-sm font-semibold text-primary-700 hover:border-primary-300 hover:bg-primary-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add an ingredient
            </button>
          )}
          {value.ingredients.length === 0 && !adding && (
            <p className="text-xs text-neutral-500">Optional. With none, selling it takes nothing from stock, and counting the area records what was used.</p>
          )}
        </div>
        {value.ingredients.length > 0 && summary}
      </div>
    </div>
  )
}
