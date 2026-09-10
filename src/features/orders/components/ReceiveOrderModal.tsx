import { useEffect, useState } from 'react'
import { PackageCheck, Pencil } from 'lucide-react'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { QuantityStepper } from '@/components/QuantityStepper'
import { ordersApi } from '@/features/orders/api/ordersApi'
import type { DuplicateResolution } from '@/features/orders/components/DuplicateProductNudge'
import { DuplicateProductNudge } from '@/features/orders/components/DuplicateProductNudge'
import type { NewProductFields } from '@/features/orders/components/NewProductFieldsPanel'
import { NewProductFieldsPanel } from '@/features/orders/components/NewProductFieldsPanel'
import type {
  Order,
  ProductMatchCandidate,
  ReceiveOrderLine,
} from '@/features/orders/types'
import { productsApi } from '@/features/products/api/productsApi'
import { ProductImage } from '@/features/products/components/ProductImage'
import { useUnitOfMeasureOptions } from '@/features/products/hooks/useUnitOfMeasureOptions'
import type { ProductUpdatePayload } from '@/features/products/types'
import { isAppError } from '@/types/api'
import { formatQuantity } from '@/utils/units'

export interface ReceiveOrderModalProps {
  order: Order
  onClose: () => void
  /** Receives the updated order so the caller can re-render without a second round trip. */
  onSuccess: (order: Order, receivedUnits: number, fullyReceived: boolean) => void
}

/**
 * Confirming a delivery — the single most consequential button a buyer presses.
 *
 * Everything else in the marketplace moves an order between states. This moves *stock*: each unit
 * confirmed here stops being incoming and becomes real, usable, sellable inventory, with a stock
 * movement written against it at the price actually paid. The copy says so in those words,
 * because a buyer who thinks this is a receipt acknowledgement will not understand why their
 * inventory changed.
 *
 * **Partial receipt is the normal case in wholesale**, not an edge case: 8 of 10 bags arrive
 * today and 2 follow tomorrow. Each line therefore gets its own quantity, defaulted to what is
 * still outstanding, and the remainder stays incoming with the order still DELIVERED.
 */
export function ReceiveOrderModal({ order, onClose, onSuccess }: ReceiveOrderModalProps) {
  const outstandingItems = order.items.filter((item) => item.outstandingQuantity > 0)
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(outstandingItems.map((item) => [item.id, item.outstandingQuantity])),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // §7.2 duplicate nudge: candidates per order item, and what the buyer answered for each. A
  // non-blocking suggestion by design — an item with no entry here, or one still unresolved,
  // simply receives into whatever materialize() already matched or created, exactly as before.
  const [suggestions, setSuggestions] = useState<Record<string, ProductMatchCandidate[]>>({})
  const [resolutions, setResolutions] = useState<Record<string, DuplicateResolution>>({})
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // "Set your own SKU/unit/pack" panel state, per item — see NewProductFieldsPanel. `originals`
  // is the diff baseline (what the panel loaded before any edit); `fields` tracks live edits.
  const [newProductFields, setNewProductFields] = useState<Record<string, NewProductFields>>({})
  const [newProductOriginals, setNewProductOriginals] = useState<Record<string, NewProductFields>>({})
  const { options: unitOptions } = useUnitOfMeasureOptions()

  useEffect(() => {
    let cancelled = false
    ordersApi
      .receiveSuggestions(order.id)
      .then((list) => {
        if (cancelled) return
        const byItem: Record<string, ProductMatchCandidate[]> = {}
        for (const suggestion of list) {
          byItem[suggestion.orderItemId] = suggestion.candidates
        }
        setSuggestions(byItem)
      })
      .catch(() => {
        // A failed lookup just means no nudge renders — receiving still works unchanged.
      })
    return () => {
      cancelled = true
    }
  }, [order.id])

  const totalOutstanding = outstandingItems.reduce((sum, item) => sum + item.outstandingQuantity, 0)
  const totalSelected = Object.values(quantities).reduce((sum, value) => sum + value, 0)
  const isPartial = totalSelected > 0 && totalSelected < totalOutstanding

  /**
   * "What's going into your inventory" — one line per item actually being confirmed, naming
   * where it lands: an existing product picked via the duplicate nudge, a new product (with
   * whatever SKU/unit was set), or the item's own already-matched product. The same read-only
   * "here's what will happen before you commit" the manual Stock In screen and bulk import both
   * already give (MULTI_VENDOR_INVENTORY_DESIGN.md §7.3) — this order's version of it, useful
   * exactly when there are enough lines that the per-line editors above stop being a clear
   * picture on their own.
   */
  const summaryLines = outstandingItems
    .map((item) => {
      const quantity = quantities[item.id] ?? 0
      if (quantity <= 0) return null
      const resolution = resolutions[item.id]
      let destination: string
      if (resolution?.status === 'linked') {
        destination = `existing product "${resolution.productName}"`
      } else if (item.buyerProductNewlyCreated) {
        const custom = newProductFields[item.id]
        const bits: string[] = []
        if (custom?.sku) bits.push(`SKU ${custom.sku}`)
        if (custom?.unitOfMeasure) {
          const label = unitOptions.find((option) => option.code === custom.unitOfMeasure)?.label
          bits.push(`counted in ${label ?? custom.unitOfMeasure}`)
        }
        destination = bits.length > 0 ? `a new product (${bits.join(', ')})` : 'a new product'
      } else {
        destination = `"${item.productName}"`
      }
      return { id: item.id, text: `${formatQuantity(quantity, item.unitOfMeasure)} of ${item.productName} → ${destination}` }
    })
    .filter((line): line is { id: string; text: string } => line !== null)

  /**
   * Saves any "set your own SKU/unit/pack" edits through the existing product-update endpoint —
   * the same authority, the same validation, as editing the product from its own detail page.
   * Runs before `receive()` so a rejected edit (an unavailable SKU, an unrecognised unit) stops
   * the whole submit rather than landing stock into a product whose identity fix half-failed.
   * Returns false and sets `error` on the first failure.
   */
  async function applyNewProductCustomizations(): Promise<boolean> {
    for (const item of outstandingItems) {
      if (resolutions[item.id]?.status === 'linked' || !item.buyerProductId) continue
      const edited = newProductFields[item.id]
      const original = newProductOriginals[item.id]
      if (!edited || !original) continue

      const payload: ProductUpdatePayload = {}
      if (edited.sku.trim() && edited.sku !== original.sku) {
        payload.sku = edited.sku.trim()
      }
      if (edited.unitOfMeasure !== original.unitOfMeasure) {
        payload.unitOfMeasure = edited.unitOfMeasure || undefined
      }
      // Packaging is add-only here (a freshly materialized row never has one to clear) — sent
      // only as a complete pair, matching the server's own "both or neither" rule.
      if (
        edited.packagingUnit &&
        edited.packagingSize &&
        (edited.packagingUnit !== original.packagingUnit || edited.packagingSize !== original.packagingSize)
      ) {
        payload.packagingUnit = edited.packagingUnit
        payload.packagingSize = Number(edited.packagingSize)
      }
      if (Object.keys(payload).length === 0) continue

      try {
        await productsApi.update(item.buyerProductId, payload)
      } catch (err: unknown) {
        setError(
          isAppError(err)
            ? err.message
            : `Could not save your changes to ${item.productName}. Please try again.`,
        )
        return false
      }
    }
    return true
  }

  async function handleSubmit() {
    // @Positive on the backend rejects a zero-quantity line, so "nothing arrived for this line"
    // is expressed by omitting it rather than by sending a 0.
    const lines: ReceiveOrderLine[] = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => {
        const resolution = resolutions[orderItemId]
        const linked = resolution?.status === 'linked'
        return {
          orderItemId,
          quantity,
          linkToExistingProductId: linked ? resolution.productId : undefined,
          // The buyer's own "1 of mine = N of theirs" answer from the conversion step — see
          // DuplicateProductNudge. Absent whenever the picked product's unit already matched.
          packagingUnit: linked ? resolution.packagingUnit : undefined,
          packagingSize: linked ? resolution.packagingSize : undefined,
          saveAsSupplierDefault: linked ? resolution.saveAsSupplierDefault : undefined,
        }
      })

    if (lines.length === 0) {
      setError('Enter how much of at least one line arrived.')
      return
    }

    setSubmitting(true)
    setError(null)

    if (!(await applyNewProductCustomizations())) {
      setSubmitting(false)
      return
    }

    try {
      const updated = await ordersApi.receive(order.id, { lines })
      onSuccess(updated, totalSelected, updated.fullyReceived)
    } catch (err: unknown) {
      setError(isAppError(err) ? err.message : 'Could not confirm the delivery. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Confirm what you received"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} loading={submitting} disabled={totalSelected === 0}>
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            Add {totalSelected} to my stock
          </Button>
        </>
      }
    >
      <div className="rounded-md border border-accent-200 bg-accent-50 px-3 py-2.5">
        <p className="text-sm text-accent-900">
          <strong className="font-semibold">This adds the items to your usable inventory.</strong> Until you confirm,
          they are held as incoming stock and cannot be used or sold.
        </p>
      </div>

      <p className="mt-4 text-sm text-neutral-600">
        Check each line against what physically arrived. The quantities below are pre-filled with everything still
        outstanding — change any that came up short.
      </p>

      <ul className="mt-3 divide-y divide-neutral-100">
        {outstandingItems.map((item) => {
          const candidates = suggestions[item.id] ?? []
          const resolution = resolutions[item.id]
          // Gated on buyerProductNewlyCreated, not on whether a candidate was actually found —
          // an item with zero automatic matches still needs to be ASKED "new, or something you
          // already stock?", which DuplicateProductNudge does directly in that case.
          const showNudge = item.buyerProductNewlyCreated && (!resolution || editingItemId === item.id)
          return (
            <li key={item.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <ProductImage
                  src={item.imageUrl}
                  alt={item.productName}
                  className="h-10 w-10 shrink-0 rounded-md"
                  iconClassName="h-4 w-4"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{item.productName}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Ordered {formatQuantity(item.quantity, item.unitOfMeasure)}
                    {item.receivedQuantity > 0 ? ` · ${item.receivedQuantity} already received` : ''} ·{' '}
                    <span className="font-medium text-warning-800">{item.outstandingQuantity} outstanding</span>
                  </p>
                </div>
                <QuantityStepper
                  value={quantities[item.id] ?? 0}
                  min={0}
                  max={item.outstandingQuantity}
                  size="sm"
                  unitOfMeasure={item.unitOfMeasure}
                  onChange={(value) => setQuantities((prev) => ({ ...prev, [item.id]: value }))}
                  label={`Quantity of ${item.productName} received`}
                />
              </div>

              {showNudge && (
                <DuplicateProductNudge
                  itemName={item.productName}
                  itemUnitOfMeasure={item.unitOfMeasure}
                  candidates={candidates}
                  onResolve={(next) => {
                    setResolutions((prev) => ({ ...prev, [item.id]: next }))
                    setEditingItemId(null)
                  }}
                />
              )}

              {!showNudge && resolution && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                  {resolution.status === 'linked'
                    ? `Adding to existing product: ${resolution.productName}`
                    : 'Adding as a new product'}
                  <button
                    type="button"
                    onClick={() => setEditingItemId(item.id)}
                    className="inline-flex items-center gap-0.5 font-medium text-primary-600 hover:text-primary-700"
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                    change
                  </button>
                </p>
              )}

              {/* Sequential, not simultaneous: this only ever appears once "it's new" has been
                  chosen above, and disappears again while that choice is being reconsidered
                  (editingItemId reopens the nudge) — never alongside an in-progress "link to an
                  existing product" decision, which used to be two unrelated-looking toggles a
                  buyer could have open at once with no indication they were mutually exclusive. */}
              {resolution?.status === 'new' && editingItemId !== item.id && item.buyerProductId && (
                <NewProductFieldsPanel
                  buyerProductId={item.buyerProductId}
                  onLoaded={(fields) => {
                    setNewProductOriginals((prev) => ({ ...prev, [item.id]: fields }))
                    setNewProductFields((prev) => ({ ...prev, [item.id]: fields }))
                  }}
                  onChange={(fields) => setNewProductFields((prev) => ({ ...prev, [item.id]: fields }))}
                />
              )}
            </li>
          )
        })}
      </ul>

      {summaryLines.length > 0 && (
        <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            What&apos;s going into your inventory
          </p>
          <ul className="flex flex-col gap-1">
            {summaryLines.map((line) => (
              <li key={line.id} className="text-sm text-neutral-700">
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isPartial && (
        <p className="mt-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-900">
          You are confirming {totalSelected} of {totalOutstanding} outstanding units. The remaining{' '}
          {totalOutstanding - totalSelected} stay as incoming stock and this order stays open, so you can confirm the
          rest when it arrives.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}
    </Modal>
  )
}
