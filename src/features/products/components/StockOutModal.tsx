import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { stockApi, type ProductLot, type StockOutResponse } from '@/features/products/api/stockApi'
import { UnitToggle } from '@/features/products/components/UnitToggle'
import { formatDateTime } from '@/features/products/formatters'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { stockOutSchema, type StockOutFormValues } from '@/features/products/schemas'
import type { Product, StockOutPayload } from '@/features/products/types'
import {
  UNIT_COPY,
  formatEnteredAndBase,
  formatQuantity,
  formatQuantityInUnit,
  howYouCountIt,
  roundsToZeroMessage,
} from '@/features/products/unitCopy'
import {
  convertsCleanly,
  fromBaseQuantity,
  productsOwnUnits,
  stockUnitLabel,
  stockUnitOption,
  toBaseQuantity,
  unitOptionsForProduct,
} from '@/features/products/unitSet'
import { isAppError } from '@/types/api'

export interface StockOutModalProps {
  product: Product
  onClose: () => void
  onSuccess: (result: StockOutResponse) => void
}

interface AllocationRow {
  key: string
  inMovementId: string
  /** **Base units**, like everything else about a lot. See {@link StockOutModal}'s javadoc. */
  quantity: string
}

let rowKeySeq = 0
function newRowKey(): string {
  rowKeySeq += 1
  return `row-${rowKeySeq}`
}

/**
 * Stock-out, per the multi-vendor inventory design (§6, §7.5), `UNIT_UX_CONTRACT.md` §3/§4 and
 * `UNIT_UX_REMEDIATION_PLAN.md` §6.3: quantity + the compact unit toggle IS the entire
 * simple-path form — no supplier picker, no lot picker, ever, in the default case. The server
 * resolves lot-level FIFO on its own; this component only shows the resulting supplier/delivery
 * breakdown AFTER a successful submit (§6's receipt-style breakdown).
 *
 * Unlike `StockInModal` there is deliberately no confirmation screen — §7.3's read-only summary
 * is specified for stock-IN "any path", not stock-out, and adding one here would cost the simple
 * path a click the design doc's acceptance bar explicitly protects ("zero extra clicks/fields
 * versus today"). One "Confirm" click submits directly, same as the flow it replaces. Non-
 * negotiable 3 is met without it: what was typed and what the ledger records are printed together
 * under the quantity field the whole time it is being typed, and again on the receipt.
 *
 * <h2>It defaults to the stock unit, and stock-in does not — `UNIT_UX_CONTRACT.md` §9.3</h2>
 * A single rule used to drive both modals: `defaultUnitOption`, the product's own pack. §9.3
 * splits them by direction, because direction is what decides the answer — deliveries arrive in
 * bags and an invoice counts bags, but *"you buy a bag and sell 5 kg out of it"*. So stock-in keeps
 * the pack and this screen preselects `stockUnitOption`. See `selectedOption` below for the whole
 * of it; it is one line, one call site, and no change to `UnitOption` (§9.3 forbids a second flag).
 *
 * <h2>Three defects closed here</h2>
 * <ol>
 *   <li><b>P1-3 — the full unit list is deleted, not repaired.</b> The old advanced disclosure
 *       offered ~30 unit codes. `StockManagementService.stockOut` calls
 *       {@code resolveBaseQuantity(product, qty, unit, null, null)} — it accepts no packaging
 *       override at all — so every code in that list other than the product's own pack was a
 *       guaranteed 400. It was unreachable by construction, which is the strongest possible
 *       argument for non-negotiable 1: a unit with no conversion factor is not an alternative
 *       unit. {@link UnitToggle}, driven by `unitOptionsForProduct`, is now the only unit
 *       control. It is the PRODUCT-scoped set (§2.3), not a supplier-scoped one, precisely
 *       because stock-out has no supplier to scope to — the deliveries it draws from may come
 *       from several at once, which is what the allocation table below is for.</li>
 *   <li><b>P1-4 — allocations are in base units and the check now agrees.</b> A stock-out
 *       request's {@code allocations[].quantity} is, and stays, base units (contract §4); the
 *       entered quantity is in whatever the toggle says. The old client compared the two
 *       directly, so "3 bags, allocate 3" passed here and came back as <em>"allocations sum to 3
 *       but the requested quantity is 150"</em>. The comparison now converts first, and — just as
 *       importantly — every allocation input on screen is LABELLED in the stock unit and states
 *       the total it has to reach in those same terms, so the two numbers a user is asked to
 *       reconcile are quoted in one unit rather than two.</li>
 *   <li><b>P1-5 — the lot picker shows lots that can actually be picked.</b> It read the first 50
 *       rows of movement history and filtered to {@code IN}: consumed lots appeared as available,
 *       no remaining quantity was shown for any of them, and everything past page 50 was
 *       invisible. It now reads {@code GET /api/products/{id}/lots?open=true} (contract §4),
 *       which returns only lots with something left, in the same FIFO order a stock-out consumes
 *       in, each with its <b>remaining</b> balance and a server-composed {@code label}. Each
 *       row's input is capped at that remaining, so the 409 is prevented at the point of entry
 *       rather than reported after it.</li>
 * </ol>
 *
 * <h2>The disclosure is named for what it does</h2>
 * <em>"Choose which deliveries this comes from"</em> — plan §6.3. It used to say "Choose vendor /
 * unit manually", which named a unit list that could not work and a vendor picker that does not
 * exist on this screen. What it actually reveals is one thing: which lots the stock leaves.
 *
 * <h2>Prior art</h2>
 * Odoo's delivery-order screen is the model, and the design doc (§6) cites it: lots are
 * auto-reserved by quantity with no user input, and only if you open the line does a per-lot
 * breakdown appear, editable, with an "Add a line" to split across more than one. "Add a line"
 * here pre-fills the FIFO suggestion — the oldest unused open lot, and as much of the outstanding
 * need as that lot can still cover — because the design asks for the rows to be <em>"pre-filled
 * with the same FIFO suggestion"</em>, and because an empty row on a screen whose whole problem
 * was guessing is a strange thing to hand someone.
 */
export function StockOutModal({ product, onClose, onSuccess }: StockOutModalProps) {
  const { options: unitOfMeasureOptions } = useUnitOfMeasureOptions()

  const [choosingLots, setChoosingLots] = useState(false)
  /** The selected unit's `code`, or `null` for "not chosen yet" — same self-healing resolution as
   *  `StockInModal`'s, for the same reason: an option list that arrives asynchronously must not
   *  leave a stale code sitting in state. */
  const [unitCode, setUnitCode] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'receipt'>('form')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Split out from `submitError` purely so the render can give a 409 oversell its own structured
  // banner (actual-vs-requested, per §7.5) instead of the generic one-line FormError every other
  // failure gets — the two numbers are the whole point of that error and deserve to be legible,
  // not buried in a sentence.
  const [oversellInfo, setOversellInfo] = useState<{ available: number; requested: number } | null>(null)
  const [result, setResult] = useState<StockOutResponse | null>(null)
  const [allocationRows, setAllocationRows] = useState<AllocationRow[]>([])
  const [openLots, setOpenLots] = useState<ProductLot[]>([])
  const [loadingLots, setLoadingLots] = useState(false)
  const [lotsError, setLotsError] = useState<string | null>(null)

  useEffect(() => {
    if (!choosingLots || openLots.length > 0) return
    let cancelled = false
    setLoadingLots(true)
    setLotsError(null)
    stockApi
      .lots(product.id, true)
      .then((lots) => {
        if (!cancelled) setOpenLots(lots)
      })
      .catch(() => {
        if (!cancelled) {
          setOpenLots([])
          setLotsError('Could not load this product’s open deliveries. Leave this empty and the oldest are used first.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLots(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choosingLots])

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<StockOutFormValues>({
    resolver: zodResolver(stockOutSchema),
    defaultValues: { quantity: '', note: '' },
  })

  const quantityStr = watch('quantity')
  const quantityNumber = Number(quantityStr) || 0

  const unitOptions = unitOptionsForProduct(product, unitOfMeasureOptions)
  /**
   * §9.3's issuing default: **the stock unit**, not the pack.
   *
   * This is the one line where stock-out now differs from stock-in, and it is deliberate. The
   * fallback used to be `defaultUnitOption`, which returns `isDefault` — the product's own pack —
   * so this modal opened on "Bag of 50 kg" for a product that comes in bags. That is right for a
   * delivery and wrong for an issue. In the user's own words: *"when stocking out, they will stock
   * out kg by default and we will remove the kg from the total, or they can stock out bags which
   * we will remove the total kg for a bag."* You buy a bag and sell 5 kg out of it.
   *
   * `UNIT_UX_CONTRACT.md` §9.3 makes that a rule rather than a preference, and makes it the
   * CALLER's rule: `isDefault` keeps meaning "the product's natural trade unit", and direction
   * decides which default applies. It is NetSuite's purchase-unit / sale-unit split and Odoo's
   * Purchase-UoM-vs-UoM split, whose delivery-order lines likewise default to the product's own
   * unit rather than a packaging. No wire change and no second flag on `UnitOption` (§9.3 forbids
   * one) — both options are already in the set.
   *
   * It is a default, not a restriction: the pack is still in `offeredUnits` below and is one click
   * away in the toggle, and a code the user has picked (`unitCode`) always wins over this.
   */
  const selectedOption =
    (unitCode == null ? undefined : unitOptions.find((option) => option.code === unitCode)) ?? stockUnitOption(unitOptions)
  const stockUnitText = stockUnitLabel(unitOptions)

  /**
   * The pack to restate the on-hand figure in — the product's own, or `null` when it has none.
   *
   * With the issuing default now on the stock unit (§9.3), the whole screen speaks kg while the
   * person reading it counts bags on a shelf. So the balance says both, exactly as the product
   * page's breakdown panel and the supplier tab already do: "1,010 kg (20.2 bags)". That figure is
   * `fromBaseQuantity`, which is honestly non-integral by design — 1,010 kg IS 20.2 bags, and
   * rounding it to 20 would quietly lose 10 kg.
   */
  const packOption = unitOptions.find((option) => option.isPack) ?? null
  const onHandInPacks =
    packOption == null ? null : formatQuantityInUnit(fromBaseQuantity(product.quantityOnHand, packOption), packOption)

  /**
   * What the unit control actually offers: the product's own ways of counting (its stock unit and
   * its packs), not the whole set.
   *
   * A user reported the four-entry control on a millimetre product — "mm · or Dozen of 12 mm · or
   * cm · or m" — as confusing, and they were right: two of those are how the product is bought and
   * sold, the other two are arithmetic. Their instinct was to remove the control entirely and hide
   * unit choice behind the disclosure, which would go too far the other way. Odoo puts the UoM
   * selector directly beside the quantity on a receipt line, NetSuite gives every adjustment line a
   * Units column, and Zoho pairs the unit with the quantity field — none of them hide it, because
   * a bare number whose unit is implied is the defect this whole remediation set out to remove.
   *
   * So the control stays and gets shorter. Step 4's same-category base units remain in
   * `unitOptions` — every conversion, every preview and the submitted value all still resolve
   * against the full set — they are simply not offered as the everyday answer. `UnitToggle`
   * already renders nothing at one option, so a product with no pack shows no control at all,
   * which is the "just say the default" case the user asked for.
   */
  const offeredUnits = productsOwnUnits(unitOptions)

  const baseQuantity = toBaseQuantity(quantityNumber, selectedOption)
  /**
   * §3.1 rounds `quantity × factor` HALF_UP at scale 0, so a fractional entry made in the STOCK
   * UNIT is stored as a different number from the one typed — "0.5 kg" leaves as 1 kg.
   *
   * Newly reachable on this screen twice over: §9.1 made the quantity field accept decimals, and
   * §9.3 made the stock unit the DEFAULT here, so it is the ordinary path rather than an unusual
   * one. Non-negotiable 3 has no exemption for rounding that happens to be small.
   */
  const quantityRoundsWhenStored = quantityNumber > 0 && baseQuantity !== quantityNumber
  const showConversion = quantityNumber > 0 && (!selectedOption.isStockUnit || quantityRoundsWhenStored)
  const roundsToZero = quantityNumber > 0 && !convertsCleanly(quantityNumber, selectedOption)

  const lotById = new Map(openLots.map((lot) => [lot.inMovementId, lot]))

  function removeAllocationRow(key: string) {
    setAllocationRows((rows) => rows.filter((r) => r.key !== key))
  }
  function updateAllocationRow(key: string, patch: Partial<AllocationRow>) {
    setAllocationRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  /**
   * Odoo's "Add a line", pre-filled with the FIFO suggestion: the oldest open lot not already on
   * a row (the server returns them in `(occurredAt, createdAt)` order, which is the order it
   * would have consumed them in), carrying as much of the outstanding need as it still has left.
   * Blank when there is nothing sensible to suggest — no lots loaded, or every one already used.
   */
  function addAllocationRow() {
    setAllocationRows((rows) => {
      const used = new Set(rows.map((r) => r.inMovementId).filter(Boolean))
      const suggestion = openLots.find((lot) => !used.has(lot.inMovementId))
      const alreadyAllocated = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
      const outstanding = Math.max(0, baseQuantity - alreadyAllocated)
      const suggestedQuantity = suggestion ? Math.min(suggestion.remaining, outstanding) : 0
      return [
        ...rows,
        {
          key: newRowKey(),
          inMovementId: suggestion?.inMovementId ?? '',
          quantity: suggestedQuantity > 0 ? String(suggestedQuantity) : '',
        },
      ]
    })
  }

  /**
   * The manual override, or `undefined` for "let the server compute FIFO".
   *
   * Every `quantity` here is **base units** — contract §4 fixes that, and the row inputs are
   * labelled in the stock unit so what the user typed and what is sent are the same number. This
   * is the half of P1-4 the client got wrong twice over: it built the array from entered-unit
   * numbers AND compared the total against an entered-unit quantity.
   */
  function buildAllocations(): { inMovementId: string; quantity: number }[] | undefined {
    if (!choosingLots) return undefined
    const valid = allocationRows.filter((r) => r.inMovementId && Number(r.quantity) > 0)
    if (valid.length === 0) return undefined
    return valid.map((r) => ({ inMovementId: r.inMovementId, quantity: Number(r.quantity) }))
  }

  const builtAllocations = buildAllocations()
  const allocationTotal = builtAllocations?.reduce((sum, a) => sum + a.quantity, 0) ?? null
  /** Base against base (P1-4). `baseQuantity` is what the server will need; `allocationTotal` is
   *  what the rows offer. Both in stock units, both stated in stock units on screen. */
  const allocationMismatch = builtAllocations != null && baseQuantity > 0 && allocationTotal !== baseQuantity
  /** A row asking a lot for more than it has left is a 409 waiting to happen, and the lot list
   *  already knows the answer — so it is refused here, per row, naming the lot. */
  const overdrawnRows = allocationRows.filter((row) => {
    const lot = lotById.get(row.inMovementId)
    return lot != null && Number(row.quantity) > lot.remaining
  })
  const allocationRequirement = `Allocated amounts must add up to ${formatQuantity(baseQuantity, stockUnitText)}.`

  async function submit() {
    setSubmitError(null)
    setOversellInfo(null)
    if (roundsToZero) {
      setSubmitError(roundsToZeroMessage(quantityNumber, selectedOption, stockUnitText))
      return
    }
    if (allocationMismatch || overdrawnRows.length > 0) {
      setSubmitError(
        overdrawnRows.length > 0 ? 'One of the deliveries below does not have that much left in it.' : allocationRequirement,
      )
      return
    }
    setSubmitting(true)
    try {
      const payload: StockOutPayload = {
        quantity: quantityNumber,
        unit: selectedOption.code || undefined,
        allocations: builtAllocations,
        note: getValues('note') || undefined,
      }
      const res = await stockApi.stockOut(product.id, payload)
      setResult(res)
      setStep('receipt')
    } catch (err) {
      if (isAppError(err) && err.availableQuantity != null && err.requestedQuantity != null) {
        setOversellInfo({ available: err.availableQuantity, requested: err.requestedQuantity })
      } else {
        setSubmitError(isAppError(err) ? err.message : 'Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * "3 bags (150 kg)" — non-negotiable 3, on the form and on the receipt alike, from one string so
   * the two cannot disagree.
   *
   * `formatEnteredAndBase` collapses to a single figure when the entry unit IS the stock unit,
   * where the parenthetical would repeat rather than add. `quantityRoundsWhenStored` is the one
   * case where it would still add — see its note — so the pair is composed here, in the same shape
   * and from the same `formatQuantity` helper, with the parenthetical naming the figure the ledger
   * keeps. With no confirm step on this screen, this line is where §7.3 is met.
   */
  const quantityBothWays =
    formatEnteredAndBase(quantityNumber, selectedOption, baseQuantity, stockUnitText)

  return (
    <Modal
      open
      onClose={onClose}
      size={choosingLots ? 'xl' : 'md'}
      title={step === 'form' ? 'Stock out' : 'Stock out recorded'}
      footer={
        step === 'form' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(() => void submit())} loading={submitting} disabled={roundsToZero}>
              Confirm
            </Button>
          </>
        ) : (
          <Button onClick={() => result && onSuccess(result)}>Done</Button>
        )
      }
    >
      {step === 'form' && (
        <form onSubmit={handleSubmit(() => void submit())} noValidate className="flex flex-col gap-4">
          {/* Base units, and said so (plan §3's P2 — this figure used to be rendered bare), with
              the pack equivalent beside it so the balance is legible to someone counting bags on a
              shelf as well as to the ledger. See `onHandInPacks`. */}
          <p className="text-sm text-neutral-500">
            Current {UNIT_COPY.ON_HAND.toLowerCase()}: {formatQuantity(product.quantityOnHand, stockUnitText)}
            {onHandInPacks && ` (${onHandInPacks})`}
          </p>

          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
              <div className="flex-1">
                <TextField
                  label="Quantity"
                  // `decimal`, not `numeric`: §9.1 accepts decimals and a phone keypad without a
                  // decimal point makes "half a bag" untypeable on the device most of these
                  // entries are made on.
                  inputMode="decimal"
                  hint={
                    // Only when there is no control to read the unit off. With the toggle on
                    // screen the hint just restates it, and restating a control next to the
                    // control is the noise a user reported as confusing.
                    //
                    // Built from `offeredUnits`, not the whole set: the set also carries §2.1
                    // step 4's same-category base units, and naming "mm · or cm · or m" beside a
                    // field whose control is not on screen offers answers nothing here accepts —
                    // the mirror image of non-negotiable 4's "no question whose valid answers it
                    // does not show".
                    offeredUnits.length > 1 ? undefined : `${UNIT_COPY.COUNTED_IN} ${howYouCountIt(offeredUnits)}`
                  }
                  error={errors.quantity?.message}
                  {...register('quantity')}
                />
              </div>
              <div className="sm:pb-0.5">
                <UnitToggle
                  value={selectedOption.code}
                  onChange={setUnitCode}
                  options={offeredUnits}
                  label={UNIT_COPY.COUNTED_IN}
                />
              </div>
            </div>
            {showConversion && !roundsToZero && <p className="mt-1.5 text-xs text-neutral-500">{quantityBothWays}</p>}
            {roundsToZero && (
              <p role="alert" className="mt-1.5 text-xs text-danger-600">
                {roundsToZeroMessage(quantityNumber, selectedOption, stockUnitText)}
              </p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setChoosingLots((open) => !open)}
              aria-expanded={choosingLots}
              aria-controls="stock-out-lots"
              className="flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {choosingLots ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              Choose which deliveries this comes from
            </button>
          </div>

          {choosingLots && (
            <div id="stock-out-lots" className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span id="stock-out-lots-heading" className="text-sm font-medium text-neutral-700">
                  Where this comes from
                </span>
                <Button type="button" variant="secondary" onClick={addAllocationRow} disabled={loadingLots}>
                  Add a line
                </Button>
              </div>
              <p className="text-xs text-neutral-500">
                Left empty, the oldest deliveries are used first. Add a line to say otherwise — amounts are in {stockUnitText}, and
                each delivery shows how much of it is still left.
              </p>

              {lotsError && <p className="text-xs text-danger-600">{lotsError}</p>}

              {loadingLots ? (
                <p className="text-sm text-neutral-500">Loading deliveries…</p>
              ) : allocationRows.length === 0 ? (
                <p className="text-sm text-neutral-400">
                  {openLots.length === 0 && !lotsError
                    ? 'No open deliveries on file — the server will work out where this comes from.'
                    : 'No lines yet — the oldest deliveries will be used first.'}
                </p>
              ) : (
                /* Cards, not a table. A three-column grid with a select in it cannot be read at
                   360px without horizontal scrolling, and a table that scrolls sideways hides the
                   remove button and the "12 kg left" hint — the two things a row exists to show.
                   So each allocation is its own card that stacks its fields on a phone and lays
                   them out in a row from `sm` up. `<ul>`/`<li>` rather than `<div>`s so the group
                   is announced with its size, which a table would otherwise have provided. */
                /* Named as a group, not just visually headed: the rows are cards, so nothing else
                   tells a screen reader what this list of "Delivery 1 / Delivery 2" controls is
                   for. `<ul>` also announces the count, which a table would have provided. */
                <ul aria-labelledby="stock-out-lots-heading" className="flex flex-col gap-3">
                  {allocationRows.map((row, index) => {
                    const lot = lotById.get(row.inMovementId)
                    const overdrawn = lot != null && Number(row.quantity) > lot.remaining
                    const lotSelectId = `stock-out-lot-${row.key}`
                    const qtyInputId = `stock-out-lot-qty-${row.key}`
                    return (
                      <li key={row.key} className="rounded-lg border border-neutral-200 bg-white p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="min-w-0 flex-1">
                            <label htmlFor={lotSelectId} className="mb-1 block text-xs font-medium text-neutral-600">
                              Delivery {index + 1}
                            </label>
                            <select
                              id={lotSelectId}
                              value={row.inMovementId}
                              onChange={(e) => updateAllocationRow(row.key, { inMovementId: e.target.value })}
                              className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                            >
                              <option value="">Choose a delivery</option>
                              {openLots.map((option) => (
                                /* `label` is the server's own phrase (contract §4) — never
                                   string-built here, so the picker, the receipt and any error
                                   about this lot all name it identically, and no UUID can leak
                                   into a user-visible string (non-negotiable 6). */
                                <option key={option.inMovementId} value={option.inMovementId}>
                                  {option.label} · {formatQuantity(option.remaining, stockUnitText)} left
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:w-40">
                            <label htmlFor={qtyInputId} className="mb-1 block text-xs font-medium text-neutral-600">
                              Amount ({stockUnitText})
                            </label>
                            <input
                              id={qtyInputId}
                              type="number"
                              min={0}
                              max={lot?.remaining}
                              step="any"
                              inputMode="numeric"
                              aria-invalid={overdrawn || undefined}
                              aria-describedby={lot ? `${qtyInputId}-hint` : undefined}
                              value={row.quantity}
                              onChange={(e) => updateAllocationRow(row.key, { quantity: e.target.value })}
                              className={`w-full rounded-md border px-2 py-1.5 text-sm text-neutral-900 focus:ring-2 focus:outline-none ${
                                overdrawn
                                  ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-100'
                                  : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
                              }`}
                            />
                          </div>
                          <div className="sm:pb-1">
                            <button
                              type="button"
                              onClick={() => removeAllocationRow(row.key)}
                              aria-label={`Remove delivery ${index + 1}`}
                              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        {/* The cap, stated rather than only enforced — and the failure stated in
                            words, not only in a red border. */}
                        {lot && (
                          <p id={`${qtyInputId}-hint`} className={`mt-1.5 text-xs ${overdrawn ? 'text-danger-600' : 'text-neutral-500'}`}>
                            {overdrawn
                              ? `Only ${formatQuantity(lot.remaining, stockUnitText)} left from this delivery.`
                              : `${formatQuantity(lot.remaining, stockUnitText)} left from this delivery.`}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {allocationMismatch && (
                <p role="alert" className="text-xs text-danger-600">
                  Allocated {formatQuantity(allocationTotal ?? 0, stockUnitText)} so far. {allocationRequirement}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="stock-out-note" className="mb-1.5 block text-sm font-medium text-neutral-700">
              Note
            </label>
            <textarea
              id="stock-out-note"
              rows={2}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
              {...register('note')}
            />
            {errors.note?.message && <p className="mt-1.5 text-xs text-danger-600">{errors.note.message}</p>}
          </div>

          {/* A 409 oversell gets its own card — the two numbers (available vs. requested) are
              the actionable content of this error, and burying them in FormError's one-line
              generic red banner (used for every other failure below) would read the same as an
              unrelated validation message instead of the "here's exactly what's possible right
              now" answer it actually is. Both numbers are base units, and now say so. */}
          {oversellInfo ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-4">
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-danger-800">Not enough in stock</p>
                <p className="mt-0.5 text-sm text-danger-700">
                  Only {formatQuantity(oversellInfo.available, stockUnitText)} available — you requested{' '}
                  {formatQuantity(oversellInfo.requested, stockUnitText)}.
                </p>
              </div>
            </div>
          ) : (
            <FormError message={submitError} />
          )}
        </form>
      )}

      {step === 'receipt' && result && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-accent-200 bg-accent-50 p-4">
            <p className="text-sm font-semibold text-accent-800">Recorded</p>
            <p className="mt-1 text-sm text-accent-700">
              {quantityBothWays} of {product.name} removed.
            </p>
          </div>

          {result.breakdown && result.breakdown.length > 0 ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-700">Where it came from</p>
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                {result.breakdown.map((line) => (
                  <li key={line.inMovementId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    {/* The server's own label when it sent one, so this names the delivery with
                        the same phrase the picker did. The fallback is what this composed before
                        the label existed — kept because the API omits null fields and an older
                        response must still render. */}
                    <span className="text-neutral-700">
                      {line.label ?? `${line.companyVendorName}’s ${formatDateTime(line.inMovementCreatedAt)} delivery`}
                    </span>
                    <span className="font-medium text-neutral-900">{formatQuantity(line.quantity, stockUnitText)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              New {UNIT_COPY.ON_HAND.toLowerCase()}: {formatQuantity(result.product.quantityOnHand, stockUnitText)}.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
