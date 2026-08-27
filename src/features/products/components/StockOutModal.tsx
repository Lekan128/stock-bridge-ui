import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { stockApi } from '@/features/products/api/stockApi'
import { UnitToggle, type UnitToggleOption } from '@/features/products/components/UnitToggle'
import { formatDateTime } from '@/features/products/formatters'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import { stockOutSchema, type StockOutFormValues } from '@/features/products/schemas'
import { formatCount, toBaseQuantity } from '@/features/products/stockUnitMath'
import type { Product, StockMovement, StockMutationResponse, StockOutPayload } from '@/features/products/types'
import { isAppError } from '@/types/api'

export interface StockOutModalProps {
  product: Product
  onClose: () => void
  onSuccess: (result: StockMutationResponse) => void
}

interface AllocationRow {
  key: string
  inMovementId: string
  quantity: string
}

let rowKeySeq = 0
function newRowKey(): string {
  rowKeySeq += 1
  return `row-${rowKeySeq}`
}

/**
 * Stock-out, rebuilt per the multi-vendor inventory design (§6, §7.5): quantity + the same
 * compact unit toggle IS the entire simple-path form — no vendor picker, no lot picker, ever, in
 * the default case. The server resolves lot-level FIFO on its own; this component only shows the
 * resulting vendor/delivery breakdown AFTER a successful submit (§6's receipt-style breakdown).
 *
 * Unlike `StockInModal` there is deliberately no confirmation screen — §7.3's read-only summary
 * is specified for stock-IN "any path", not stock-out, and adding one here would cost the simple
 * path a click the design doc's acceptance bar explicitly protects ("zero extra clicks/fields
 * versus today"). One "Confirm" click submits directly, same as the flow it replaces.
 *
 * <h2>Advanced disclosure — same "Choose vendor / unit manually" toggle as stock-in</h2>
 * Reveals the full unit list (works against real data, `useUnitOfMeasureOptions`) AND an editable
 * per-lot allocation table. The lot table is a real, honest gap worth calling out: the pinned API
 * contract gives no "list this product's open lots with remaining quantity" endpoint (the
 * `GET .../allocations/{inMovementId}` route is explicitly "informational, not needed by you
 * directly" per this module's brief), so there is no way to fetch a true FIFO-ordered remaining-
 * balance preview to pre-fill these rows the way Odoo's picking screen does. This builds the row
 * picker from `GET .../stock/history`'s `IN` movements instead — real lots, real vendor/date
 * context — and lets the user manually construct the `allocations` array against them, but each
 * row shows the LOT'S ORIGINAL received quantity, not a live remaining balance (that would need
 * `SUM(prior allocations)` per lot, not exposed anywhere this module can reach). The server is
 * the authority on whether a manual allocation is actually valid; a 409 here surfaces exactly like
 * a simple-path oversell would.
 */
export function StockOutModal({ product, onClose, onSuccess }: StockOutModalProps) {
  const { options: unitOfMeasureOptions, baseOptions, packagingOptions } = useUnitOfMeasureOptions()

  const [advanced, setAdvanced] = useState(false)
  const [unit, setUnit] = useState('')
  const [step, setStep] = useState<'form' | 'receipt'>('form')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Split out from `submitError` purely so the render can give a 409 oversell its own structured
  // banner (actual-vs-requested, per §7.5) instead of the generic one-line FormError every other
  // failure gets — the two numbers are the whole point of that error and deserve to be legible,
  // not buried in a sentence.
  const [oversellInfo, setOversellInfo] = useState<{ available: number; requested: number } | null>(null)
  const [result, setResult] = useState<StockMutationResponse | null>(null)
  const [allocationRows, setAllocationRows] = useState<AllocationRow[]>([])
  const [openLots, setOpenLots] = useState<StockMovement[]>([])
  const [loadingLots, setLoadingLots] = useState(false)

  useEffect(() => {
    if (!advanced || openLots.length > 0) return
    let cancelled = false
    setLoadingLots(true)
    stockApi
      .history(product.id, 0, 50)
      .then((page) => {
        if (!cancelled) setOpenLots(page.content.filter((m) => m.movementType === 'IN'))
      })
      .catch(() => {
        if (!cancelled) setOpenLots([])
      })
      .finally(() => {
        if (!cancelled) setLoadingLots(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanced])

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

  const baseLabel = unitOfMeasureOptions.find((o) => o.code === product.unitOfMeasure)?.label ?? product.unitOfMeasure ?? 'unit'
  const packagingLabel = product.packagingUnit
    ? (unitOfMeasureOptions.find((o) => o.code === product.packagingUnit)?.label ?? product.packagingUnit)
    : undefined
  const simpleUnitOptions: UnitToggleOption[] = [{ value: '', label: baseLabel }]
  if (product.packagingUnit && packagingLabel) simpleUnitOptions.push({ value: product.packagingUnit, label: packagingLabel })

  const isKnownConversion = unit !== '' && unit === product.packagingUnit
  const baseQuantity = toBaseQuantity(quantityNumber, unit, product.packagingUnit, product.packagingSize)
  const showBaseConversion = isKnownConversion && quantityNumber > 0
  const perUnitLabel = unit ? (unit === product.packagingUnit ? (packagingLabel ?? unit) : unit) : baseLabel

  function addAllocationRow() {
    setAllocationRows((rows) => [...rows, { key: newRowKey(), inMovementId: '', quantity: '' }])
  }
  function removeAllocationRow(key: string) {
    setAllocationRows((rows) => rows.filter((r) => r.key !== key))
  }
  function updateAllocationRow(key: string, patch: Partial<AllocationRow>) {
    setAllocationRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function buildAllocations(): { inMovementId: string; quantity: number }[] | undefined {
    if (!advanced) return undefined
    const valid = allocationRows.filter((r) => r.inMovementId && Number(r.quantity) > 0)
    if (valid.length === 0) return undefined
    return valid.map((r) => ({ inMovementId: r.inMovementId, quantity: Number(r.quantity) }))
  }

  const builtAllocations = buildAllocations()
  const allocationTotal = builtAllocations?.reduce((sum, a) => sum + a.quantity, 0) ?? null
  const allocationMismatch = builtAllocations != null && quantityNumber > 0 && allocationTotal !== quantityNumber

  async function submit() {
    setSubmitError(null)
    setOversellInfo(null)
    if (allocationMismatch) {
      setSubmitError(`Allocated quantity must add up to ${formatCount(quantityNumber, perUnitLabel)}.`)
      return
    }
    setSubmitting(true)
    try {
      const payload: StockOutPayload = {
        quantity: quantityNumber,
        unit: unit || undefined,
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

  const quantityLabel = formatCount(quantityNumber, perUnitLabel)

  return (
    <Modal
      open
      onClose={onClose}
      size={advanced ? 'xl' : 'md'}
      title={step === 'form' ? 'Stock out' : 'Stock out recorded'}
      footer={
        step === 'form' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(() => void submit())} loading={submitting}>
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
          <p className="text-sm text-neutral-500">Current quantity on hand: {formatCount(product.quantityOnHand, baseLabel)}</p>

          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField label="Quantity" inputMode="numeric" error={errors.quantity?.message} {...register('quantity')} />
              </div>
              <div className="pb-0.5">
                <UnitToggle value={unit} onChange={setUnit} options={simpleUnitOptions} label="Unit" />
              </div>
            </div>
            {showBaseConversion && <p className="mt-1.5 text-xs text-neutral-500">= {formatCount(baseQuantity, baseLabel)}</p>}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setAdvanced((a) => !a)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
            >
              {advanced ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              Choose vendor / unit manually
            </button>
          </div>

          {advanced && (
            <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div>
                <label htmlFor="stock-out-unit-advanced" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Unit <span className="font-normal text-neutral-400">(full list, for a one-off)</span>
                </label>
                <select
                  id="stock-out-unit-advanced"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                >
                  <option value="">{baseLabel} (base unit)</option>
                  {[...baseOptions, ...packagingOptions]
                    .filter((o) => o.code !== product.unitOfMeasure)
                    .map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-700">Vendor / lot allocation</span>
                  <Button type="button" variant="secondary" onClick={addAllocationRow} disabled={loadingLots}>
                    Add a line
                  </Button>
                </div>
                <p className="mb-2 text-xs text-neutral-500">
                  Left empty, the server picks lots automatically (oldest first). Add lines to override which delivery each unit comes
                  from — the amount shown per lot is what it originally received, not what remains; the server is the final word on
                  what is actually available.
                </p>
                {loadingLots ? (
                  <p className="text-sm text-neutral-500">Loading deliveries…</p>
                ) : allocationRows.length === 0 ? (
                  <p className="text-sm text-neutral-400">No manual lines — using automatic FIFO allocation.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                    <table className="w-full text-sm">
                      <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
                        <tr>
                          <th className="px-3 py-2 font-medium">Delivery</th>
                          <th className="px-3 py-2 font-medium">Quantity</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {allocationRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-3 py-2">
                              <select
                                value={row.inMovementId}
                                onChange={(e) => updateAllocationRow(row.key, { inMovementId: e.target.value })}
                                className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                              >
                                <option value="">Choose a delivery</option>
                                {openLots.map((lot) => (
                                  <option key={lot.id} value={lot.id}>
                                    {lot.companyVendorName ?? 'Unknown vendor'} · {formatDateTime(lot.createdAt)} · received{' '}
                                    {formatCount(lot.quantity, baseLabel)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={row.quantity}
                                onChange={(e) => updateAllocationRow(row.key, { quantity: e.target.value })}
                                className="w-24 rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeAllocationRow(row.key)}
                                aria-label="Remove line"
                                className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-danger-600"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {allocationMismatch && (
                  <p className="mt-1.5 text-xs text-danger-600">
                    Allocated quantity ({allocationTotal}) must add up to {quantityLabel}.
                  </p>
                )}
              </div>
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
              now" answer it actually is. */}
          {oversellInfo ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-4">
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-danger-800">Not enough in stock</p>
                <p className="mt-0.5 text-sm text-danger-700">
                  Only {formatCount(oversellInfo.available, baseLabel)} available — you requested{' '}
                  {formatCount(oversellInfo.requested, baseLabel)}.
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
              {quantityLabel}
              {showBaseConversion && ` (${formatCount(baseQuantity, baseLabel)})`} of {product.name} removed.
            </p>
          </div>

          {result.breakdown && result.breakdown.length > 0 ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-700">Where it came from</p>
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
                {result.breakdown.map((line) => (
                  <li key={line.inMovementId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-neutral-700">
                      {line.companyVendorName}&apos;s {formatDateTime(line.inMovementCreatedAt)} delivery
                    </span>
                    <span className="font-medium text-neutral-900">{formatCount(line.quantity, baseLabel)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              New quantity on hand: {formatCount(result.product.quantityOnHand, baseLabel)}.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
