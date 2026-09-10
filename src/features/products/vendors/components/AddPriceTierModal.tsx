import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/Button'
import { FormError } from '@/components/FormError'
import { Modal } from '@/components/Modal'
import { TextField } from '@/components/TextField'
import { productVendorsApi } from '@/features/products/api/productVendorsApi'
import { UnitToggle } from '@/features/products/components/UnitToggle'
import type { UnitOption } from '@/features/products/types'
import {
  UNIT_COPY,
  formatPackCostEcho,
  formatPriceEcho,
  formatQuantity,
  formatQuantityEcho,
  priceBasisNote,
  roundsToZeroMessage,
  unitNoun,
} from '@/features/products/unitCopy'
import { convertsCleanly, defaultUnitOption, toBasePrice, toBaseQuantity } from '@/features/products/unitSet'
import { priceTierFormSchema, type PriceTierFormValues } from '@/features/products/vendors/schemas'
import type { ProductVendor, ProductVendorPack, ProductVendorPriceTier } from '@/features/products/vendors/types'
import { isAppError } from '@/types/api'

export interface AddPriceTierModalProps {
  productId: string
  vendor: ProductVendor
  /** The specific pack this price break belongs to (MULTI_PACK_PER_VENDOR_DESIGN.md section 4.3)
   *  — a tier is a property of one priced offering, not of the vendor line as a whole, since a
   *  vendor's 50 kg bags and 25 kg bags may earn independent quantity breaks. */
  pack: ProductVendorPack
  /** This supplier's unit set (`UNIT_UX_CONTRACT.md` §2.3) — the closed list of units both fields
   *  may be entered in. Never a free list of unit codes; §7.1. */
  unitOptions: UnitOption[]
  /** The product's stock unit symbol ("kg") — what BOTH numbers are stored in, and what every
   *  conversion preview below resolves to. */
  stockUnit: string
  onClose: () => void
  onSuccess: (tier: ProductVendorPriceTier) => void
}

/**
 * "+ Add price break" — a small form (three controls), not a page, because most suppliers will
 * only ever get zero or one of these.
 *
 * <h2>This modal was P0-2</h2>
 * `UNIT_UX_REMEDIATION_PLAN.md` §3 traced the worst kind of defect to it: one that produces wrong
 * data silently, with no error anywhere. It converted `minQuantity` into stock units — correctly,
 * per multi-vendor §5.1a — and sent `unitPrice` **unconverted** from a field labelled "₦ per
 * {packaging label}". A tier entered as *10 bags at ₦44,000* against a 50 kg bag was stored as
 * `minQuantity: 500, unitPrice: 44000`, which reads as *"at 500 kg, ₦44,000 per kg"*: a 50×
 * overstatement of the price, in a row whose two numbers were in different units. That row then
 * fed `cheaperVendorHint`, which compared it against a stock-in price of a third, unknown basis.
 * Three numbers, three possible bases, one comparison.
 *
 * The fix is symmetry, and it is `UNIT_UX_CONTRACT.md` §3.1 and §3.2 side by side: a quantity is
 * **multiplied** by the entry unit's factor to reach stock units, and a price is **divided** by
 * the same factor. Both happen at submit, and both are previewed live while the form is being
 * filled, because a conversion nobody can see is a conversion nobody can check — which is exactly
 * how the broken one survived.
 *
 * <h2>The unit is attached to the fields, not inferred from the supplier</h2>
 * It used to be inferred: whatever `defaultPackagingUnit` the supplier happened to have decided
 * both labels, and the user had no say and no signal. Now there is one explicit "Counted in"
 * control at the top of the form governing both fields, defaulted to the supplier's own pack.
 * That is Odoo's vendor-pricelist model (price is per an explicitly chosen Purchase UoM, and Odoo
 * converts into stock-unit terms itself) and NetSuite's (Purchase Price is stated per purchase
 * unit and converted to base for costing). Plan §4's second conclusion, in one control.
 *
 * <h2>The stored basis is stated, not implied</h2>
 * A line under the price field says what actually gets saved. §7.2 requires every displayed price
 * to state its basis; this form's whole hazard is that the number leaving the screen is not the
 * number typed into it, so it says so.
 */
export function AddPriceTierModal({
  productId,
  vendor,
  pack,
  unitOptions,
  stockUnit,
  onClose,
  onSuccess,
}: AddPriceTierModalProps) {
  const [formError, setFormError] = useState<string | null>(null)

  /**
   * Defaults to THIS pack when it names a real container, since that is the unit its own quote
   * will be written in — falling back to the set's own default (the product's pack, else the
   * stock unit) per §2.1 for the bare-stock-unit pack. `defaultUnitOption` never returns
   * undefined, so there is no state where this form has no unit to convert against.
   *
   * Matched by LABEL, not `code` — a code can repeat within the set now that a vendor may have
   * more than one pack sharing a container code (MULTI_PACK_PER_VENDOR_DESIGN.md sections 4–7);
   * see `UnitToggle`'s own doc comment.
   */
  const [unitCode, setUnitCode] = useState<string>(
    () =>
      (pack.packagingUnit != null
        ? unitOptions.find(
            (option) => option.isPack && option.code === pack.packagingUnit && option.factorToStockUnit === pack.packagingSize,
          )
        : undefined
      )?.label ?? defaultUnitOption(unitOptions).label,
  )
  const entryOption = unitOptions.find((option) => option.label === unitCode) ?? defaultUnitOption(unitOptions)
  const entryNoun = unitNoun(entryOption)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PriceTierFormValues>({
    resolver: zodResolver(priceTierFormSchema),
    defaultValues: { minQuantity: '', unitPrice: '' },
  })

  const minQuantityNumber = Number(watch('minQuantity')) || 0
  const unitPriceNumber = Number(watch('unitPrice')) || 0

  // What will actually be stored, computed with the same helpers and the same rounding scales the
  // server uses (§3.1 scale 0 HALF_UP for quantity, §3.2 scale 6 for price) — so the preview is
  // the stored value, not an approximation of it (§7.3).
  const baseQuantity = toBaseQuantity(minQuantityNumber, entryOption)
  const basePrice = toBasePrice(unitPriceNumber, entryOption)

  // §3.1's round-to-zero refusal, checked here rather than left to a 400: "0.5 bags" against a
  // stock unit of tonnes is a real number that survives validation and then disappears.
  const quantityRoundsToZero = minQuantityNumber > 0 && !convertsCleanly(minQuantityNumber, entryOption)
  // A conversion worth previewing only exists when the entry unit is not already the stock unit —
  // otherwise "= 500 kg" under a field reading "500 kg" is noise, not reassurance.
  const converts = !entryOption.isStockUnit

  /**
   * The pack to state a stock-unit price in — `UNIT_UX_CONTRACT.md` §9.2.
   *
   * The stored line below covers the common direction: a price typed per bag, divided into ₦/kg
   * on the way to the ledger (§3.2). But a user can also switch "Counted in" to kg and type
   * ₦1,000 against a product that still comes in 80 kg bags, and in THAT direction the number
   * needing a check is the pack one — §9.2's "an invoice reading ₦80,000 a bag has to be divided
   * by 80 before it is typed", the exact case the contract says must never be left to mental
   * arithmetic. So the echo runs whichever way the toggle is set, and the two are mutually
   * exclusive by construction: `converts` is true for one and false for the other.
   *
   * The first pack in the set, which §2.1's build order makes the product's own before the
   * supplier's — the one this modal's own default entry unit would have been.
   */
  const packOption = unitOptions.find((option) => option.isPack) ?? null
  const stockUnitPriceEcho = converts ? null : formatPackCostEcho(unitPriceNumber, packOption)

  async function onSubmit(values: PriceTierFormValues) {
    setFormError(null)
    const quantity = Number(values.minQuantity)
    const price = Number(values.unitPrice)
    if (!convertsCleanly(quantity, entryOption)) {
      setFormError(roundsToZeroMessage(quantity, entryOption, stockUnit))
      return
    }
    try {
      const tier = await productVendorsApi.addPriceTier(productId, vendor.id, pack.id, {
        // Both, together, always. Splitting these two lines apart is the defect.
        minQuantity: toBaseQuantity(quantity, entryOption),
        unitPrice: toBasePrice(price, entryOption),
      })
      onSuccess(tier)
    } catch (err) {
      setFormError(isAppError(err) ? err.message : 'Could not add that price break. Please try again.')
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add price break — ${vendor.companyVendorName} (${pack.label})`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={quantityRoundsToZero}>
            Add
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-neutral-500">
          What this {UNIT_COPY.SUPPLIER.toLowerCase()} charges once an order reaches a given size. Breaks are
          inclusive — one entered as 10 applies at {formatQuantity(10, entryNoun)} and above.
        </p>

        {/* One unit control for the whole form. Rendered only when there is a real choice —
            UnitToggle returns null at a single option, so a product with no pack and no
            same-category base units simply shows two fields already labelled in its stock unit. */}
        {unitOptions.length > 1 && (
          <div>
            <span id="tier-counted-in-label" className="mb-1.5 block text-sm font-medium text-neutral-700">
              {UNIT_COPY.COUNTED_IN}
            </span>
            <UnitToggle
              value={unitCode}
              onChange={(option) => setUnitCode(option.label)}
              options={unitOptions}
              label={`${UNIT_COPY.COUNTED_IN} — the unit both numbers below are entered in`}
            />
            <p className="mt-1.5 text-xs text-neutral-500">
              Both fields below are read in this unit. They are stored in {stockUnit} either way.
            </p>
          </div>
        )}

        <div>
          <TextField
            label={`Minimum quantity (${entryNoun})`}
            inputMode="decimal"
            error={errors.minQuantity?.message}
            {...register('minQuantity')}
          />
          {/* × factor. The half that was always right. */}
          {converts && minQuantityNumber > 0 && !quantityRoundsToZero && (
            <p className="mt-1.5 text-xs text-neutral-500">{formatQuantityEcho(baseQuantity, stockUnit)} stored</p>
          )}
          {quantityRoundsToZero && (
            <p role="alert" className="mt-1.5 text-xs text-danger-600">
              {roundsToZeroMessage(minQuantityNumber, entryOption, stockUnit)}
            </p>
          )}
        </div>

        <div>
          <TextField
            label={`Price (₦ per ${entryNoun})`}
            inputMode="decimal"
            error={errors.unitPrice?.message}
            {...register('unitPrice')}
          />
          {/* ÷ factor. The half that did not exist — see this component's notes on P0-2. */}
          {converts && unitPriceNumber > 0 && (
            <p className="mt-1.5 text-xs text-neutral-500">{formatPriceEcho(basePrice, stockUnit)} stored</p>
          )}
          {/* × factor, the other direction — §9.2's per-pack echo, for a price typed in the stock
              unit beside a product that has a pack. See `stockUnitPriceEcho`. */}
          {stockUnitPriceEcho && (
            <p className="mt-1.5 text-xs text-neutral-500">{stockUnitPriceEcho}</p>
          )}
        </div>

        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          {priceBasisNote(stockUnit)}
        </p>

        <FormError message={formError} />
      </form>
    </Modal>
  )
}
