import { useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { FALLBACK_BASE_UNITS, VISIBLE_UNRESOLVED_VALUES } from '@/features/imports/constants'
import { copy } from '@/features/imports/copy'
import type {
  ImportFieldOption,
  ImportSession,
  UnresolvedValue,
  UnresolvedValueKind,
  ValueMappingRequest,
  ValueResolution,
} from '@/features/imports/types'

export interface ValueResolutionPanelProps {
  session: ImportSession
  isValueBusy: (column: string, from: string) => boolean
  onResolve: (body: ValueMappingRequest, affectedRows: number) => Promise<boolean>
}

const HEADING: Record<UnresolvedValueKind, (rows: number) => string> = {
  VENDOR: copy.resolve.vendorHeading,
  UNIT: copy.resolve.unitHeading,
  PRODUCT: copy.resolve.productHeading,
}

const CREATE_LABEL: Record<UnresolvedValueKind, string> = {
  VENDOR: copy.resolve.createNewVendor,
  UNIT: copy.resolve.createNew,
  PRODUCT: copy.resolve.createNewProduct,
}

function keyOf(value: UnresolvedValue): string {
  return `${value.column}|${value.value}`
}

/** The best match the server found, which is what the dropdown opens on. */
function bestSuggestionId(value: UnresolvedValue): string | null {
  if (value.suggestions.length === 0) return null
  return [...value.suggestions].sort((a, b) => b.score - a.score)[0].id
}

function initialSelection(value: UnresolvedValue): ValueResolution | null {
  const best = bestSuggestionId(value)
  return best ? { kind: 'EXISTING', id: best } : null
}

/**
 * Creating a product inline needs its stock unit as well as its name (spec §6.7 asks for "the
 * minimum" — the name and the unit everything about the product is counted in; §1 of
 * `UNIT_UX_CONTRACT.md` renamed the concept, and the spec's older spelling is not repeated here).
 * Without it the product exists but cannot be stocked into, so the very row that triggered the
 * creation would fail on the next validation pass. Creating a *supplier* stays name-only, which
 * is all a supplier record needs.
 */
function needsBaseUnit(value: UnresolvedValue, selection: ValueResolution | null): boolean {
  return value.kind === 'PRODUCT' && selection?.kind === 'CREATE_NEW'
}

function isSelectionComplete(value: UnresolvedValue, selection: ValueResolution | null): boolean {
  if (!selection) return false
  if (selection.kind === 'CREATE_NEW' && value.kind === 'PRODUCT') {
    const unit = selection.payload.unitOfMeasure
    return typeof unit === 'string' && unit !== ''
  }
  return true
}

/**
 * The stock units to offer. Descriptor first; the constant only when it cannot answer.
 *
 * `stock_unit` is the key since `UNIT_UX_CONTRACT.md` §9.4 (it was `unit_of_measure`, which stays
 * a header read alias but is not a field key any descriptor sends any more). In practice the
 * lookup misses either way and `FALLBACK_BASE_UNITS` answers: a PRODUCT question is only ever
 * asked by a STOCK_IN session, and the stock-in sheet has no stock-unit column to describe. It is
 * still asked for rather than skipped, because the day that changes the descriptor is the better
 * answer — it is the tenant's own list rather than a constant that has to be kept in step.
 */
function baseUnitOptions(session: ImportSession): readonly ImportFieldOption[] {
  return session.fields.find((field) => field.key === 'stock_unit')?.options ?? FALLBACK_BASE_UNITS
}

function describe(
  value: UnresolvedValue,
  resolution: ValueResolution,
  unitOptions: readonly ImportFieldOption[],
): string {
  switch (resolution.kind) {
    case 'EXISTING':
      return copy.resolve.resolvedAs(
        value.suggestions.find((s) => s.id === resolution.id)?.label ?? value.value,
      )
    case 'CREATE_NEW': {
      const unit = resolution.payload.unitOfMeasure
      if (!unit) return copy.resolve.resolvedAs(`${value.value} (new)`)
      // `LITER` is a wire code; the reader gets "Litre (L)".
      const label = unitOptions.find((option) => option.value === String(unit))?.label ?? String(unit)
      return copy.resolve.resolvedAs(`${value.value} (new, ${label})`)
    }
    case 'LITERAL':
      return copy.resolve.resolvedAs(resolution.value)
    case 'BLANK':
      return copy.resolve.leaveBlank
    case 'SKIP_ROWS':
      return copy.resolve.skipRows(value.rowCount)
  }
}

/**
 * One decision fixes forty-seven rows.
 *
 * This sits above the grid, not inside it, because a supplier name the file spells differently
 * is not a row-level mistake — it is one question about the whole file, and asking it forty-seven
 * times is the difference between a smart importer and a chore. It is also the only part of this
 * screen that is genuinely useful on a phone, which is why the mobile layout leads with it.
 *
 * Selections are held here rather than in each card so "Apply all 2 choices" can exist: someone
 * who has answered three dropdowns should not have to press Apply three times.
 */
export function ValueResolutionPanel({ session, isValueBusy, onResolve }: ValueResolutionPanelProps) {
  const pending = session.unresolvedValues
  const [selections, setSelections] = useState<Record<string, ValueResolution | null>>(() => {
    const initial: Record<string, ValueResolution | null> = {}
    for (const value of pending) initial[keyOf(value)] = initialSelection(value)
    return initial
  })
  const [applyingAll, setApplyingAll] = useState(false)
  const [applied, setApplied] = useState(0)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (pending.length === 0) return null

  const groups = new Map<UnresolvedValueKind, UnresolvedValue[]>()
  for (const value of pending) {
    groups.set(value.kind, [...(groups.get(value.kind) ?? []), value])
  }

  /**
   * Only what is on screen. `initialSelection` preselects the server's best match, so a card the
   * reader has never scrolled to still counts as "answered" — and "Apply all 400 choices" would
   * commit 380 fuzzy guesses nobody looked at. Capping the list caps the button with it.
   */
  const shown: UnresolvedValue[] = []
  for (const [kind, values] of groups) {
    shown.push(...(expanded[kind] ? values : values.slice(0, VISIBLE_UNRESOLVED_VALUES)))
  }

  // `== null` — an unanswered question omits `resolution` rather than sending null, so `=== null`
  // made this list empty against the real server and "Apply all N choices" never appeared.
  const unanswered = shown.filter(
    (value) => value.resolution == null && isSelectionComplete(value, selections[keyOf(value)]),
  )

  async function applyOne(value: UnresolvedValue): Promise<boolean> {
    const selection = selections[keyOf(value)]
    if (!isSelectionComplete(value, selection) || !selection) return false
    return onResolve({ column: value.column, from: value.value, to: selection }, value.rowCount)
  }

  async function applyAll() {
    setApplyingAll(true)
    setApplied(0)
    try {
      for (const value of unanswered) {
        // Sequential on purpose: each call returns the whole refreshed record, and firing them
        // together would have the last response overwrite the others' counters. Sequential over
        // twenty round trips is long enough that a button with no count on it reads as frozen.
        await applyOne(value)
        setApplied((done) => done + 1)
      }
    } finally {
      setApplyingAll(false)
      setApplied(0)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([kind, values]) => {
        const rowTotal = values.reduce((sum, value) => sum + value.rowCount, 0)
        const isExpanded = expanded[kind] ?? false
        const visible = isExpanded ? values : values.slice(0, VISIBLE_UNRESOLVED_VALUES)
        const hidden = values.length - visible.length
        return (
          <section
            key={kind}
            aria-label={HEADING[kind](rowTotal)}
            className="rounded-lg border border-warning-200 bg-warning-50 p-4"
          >
            <h2 className="flex items-start gap-2 text-sm font-semibold text-warning-800">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {HEADING[kind](rowTotal)}
            </h2>
            <p className="mt-1 pl-6 text-xs text-warning-700">{copy.resolve.onceForAll}</p>

            {hidden > 0 && (
              <p className="mt-1 pl-6 text-xs text-warning-700">{copy.resolve.hiddenNote(hidden)}</p>
            )}

            <ul className="mt-3 flex flex-col gap-2">
              {visible.map((value) => {
                const key = keyOf(value)
                const selection = selections[key]
                const busy = isValueBusy(value.column, value.value)
                const resolved = value.resolution

                return (
                  <li key={key} className="rounded-md border border-neutral-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900">&ldquo;{value.value}&rdquo;</p>
                        <p className="text-xs text-neutral-500">
                          {value.columnLabel} · {copy.resolve.usedOn(value.rowCount)}
                        </p>
                      </div>
                      {resolved && <Badge variant="success">{copy.resolve.resolved}</Badge>}
                    </div>

                    {resolved ? (
                      <p className="mt-2 text-sm text-neutral-700">
                        {describe(value, resolved, baseUnitOptions(session))}
                      </p>
                    ) : (
                      <>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <label className="sr-only" htmlFor={`resolve-${key}`}>
                          {copy.resolve.chooseLabel(value.value)}
                        </label>
                        <select
                          id={`resolve-${key}`}
                          disabled={busy || applyingAll}
                          value={
                            selection?.kind === 'EXISTING'
                              ? `existing:${selection.id}`
                              : selection?.kind === 'BLANK'
                                ? 'blank'
                                : selection?.kind === 'SKIP_ROWS'
                                  ? 'skip'
                                  : ''
                          }
                          onChange={(event) => {
                            const raw = event.target.value
                            const next: ValueResolution | null = raw.startsWith('existing:')
                              ? { kind: 'EXISTING', id: raw.slice('existing:'.length) }
                              : raw === 'blank'
                                ? { kind: 'BLANK' }
                                : raw === 'skip'
                                  ? { kind: 'SKIP_ROWS' }
                                  : null
                            setSelections((current) => ({ ...current, [key]: next }))
                          }}
                          className="min-h-11 min-w-52 flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:opacity-60 sm:min-h-0"
                        >
                          <option value="">{copy.resolve.choose}</option>
                          {value.suggestions.map((suggestion) => (
                            <option key={suggestion.id} value={`existing:${suggestion.id}`}>
                              {suggestion.label}
                              {suggestion.hint ? ` — ${suggestion.hint}` : ''}
                            </option>
                          ))}
                          {value.allowBlank && <option value="blank">{copy.resolve.leaveBlank}</option>}
                          {value.allowSkipRows && (
                            <option value="skip">{copy.resolve.skipRows(value.rowCount)}</option>
                          )}
                        </select>

                        {value.allowCreateNew && (
                          <button
                            type="button"
                            disabled={busy || applyingAll}
                            aria-pressed={selection?.kind === 'CREATE_NEW'}
                            onClick={() =>
                              setSelections((current) => ({
                                ...current,
                                [key]:
                                  current[key]?.kind === 'CREATE_NEW'
                                    ? initialSelection(value)
                                    : {
                                        kind: 'CREATE_NEW',
                                        payload:
                                          value.kind === 'PRODUCT'
                                            ? { name: value.value, unitOfMeasure: '' }
                                            : { name: value.value },
                                      },
                              }))
                            }
                            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60 sm:min-h-0 ${
                              selection?.kind === 'CREATE_NEW'
                                ? 'border-primary-600 bg-primary-50 text-primary-700'
                                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            {CREATE_LABEL[kind]}
                          </button>
                        )}

                        <Button
                          variant="secondary"
                          loading={busy}
                          disabled={!isSelectionComplete(value, selection) || applyingAll}
                          title={
                            needsBaseUnit(value, selection) && !isSelectionComplete(value, selection)
                              ? copy.resolve.baseUnitMissing
                              : undefined
                          }
                          onClick={() => void applyOne(value)}
                          className="shrink-0"
                        >
                          {copy.resolve.apply(value.rowCount)}
                        </Button>
                        </div>

                        {/* Spec §6.7: creating a product inline collects the minimum — its name
                            (which we already have, it is the code they typed) and its base unit.
                            A product with no base unit cannot be stocked into, so skipping this
                            would fail the very row that asked for the product. */}
                        {needsBaseUnit(value, selection) && (
                          <div className="mt-2 rounded-md border border-primary-200 bg-primary-50 p-3">
                            <label
                              htmlFor={`create-unit-${key}`}
                              className="block text-sm font-medium text-neutral-800"
                            >
                              {copy.resolve.baseUnitLabel(value.value)}
                            </label>
                            <p className="mt-0.5 text-xs text-neutral-600">{copy.resolve.baseUnitHint}</p>
                            <select
                              id={`create-unit-${key}`}
                              disabled={busy || applyingAll}
                              value={
                                selection?.kind === 'CREATE_NEW'
                                  ? String(selection.payload.unitOfMeasure ?? '')
                                  : ''
                              }
                              onChange={(event) =>
                                setSelections((current) => ({
                                  ...current,
                                  [key]: {
                                    kind: 'CREATE_NEW',
                                    payload: { name: value.value, unitOfMeasure: event.target.value },
                                  },
                                }))
                              }
                              className="mt-2 min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:opacity-60 sm:min-h-0 sm:max-w-xs"
                            >
                              <option value="">{copy.resolve.choose}</option>
                              {baseUnitOptions(session).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>

            {(hidden > 0 || isExpanded) && (
              <button
                type="button"
                onClick={() => setExpanded((current) => ({ ...current, [kind]: !isExpanded }))}
                className="mt-3 inline-flex min-h-11 items-center rounded-md px-2 py-1.5 text-sm font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:min-h-0"
              >
                {isExpanded ? copy.resolve.showFewer : copy.resolve.showMore(hidden)}
              </button>
            )}
          </section>
        )
      })}

      {unanswered.length > 1 && (
        <div className="flex justify-end">
          <Button loading={applyingAll} onClick={() => void applyAll()}>
            {applyingAll
              ? copy.resolve.applyingProgress(applied, unanswered.length)
              : copy.resolve.applyAll(unanswered.length)}
          </Button>
        </div>
      )}
    </div>
  )
}
