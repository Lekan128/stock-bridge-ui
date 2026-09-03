import { useId } from 'react'
import type { UnitOption } from '@/features/products/types'
import { UNIT_COPY } from '@/features/products/unitCopy'

export interface UnitToggleProps {
  /** The selected unit's `code`. */
  value: string
  /** Receives the chosen option's `code` — the value to put on the wire's `unit` field. */
  onChange: (code: string) => void
  /** The product's unit set, from `unitSet.unitOptionsForProduct`/`unitOptionsForSupplier`. */
  options: readonly UnitOption[]
  /** Accessible name for the control. Defaults to §1's locked name for the wire's `unit`. */
  label?: string
  /** Disables the whole control — e.g. while the supplier that determines the set is loading. */
  disabled?: boolean
}

/**
 * Segmented at two, dropdown at three — the same threshold Odoo, Zoho and NetSuite land on for
 * the same reason.
 *
 * A segmented control's cost is horizontal: every option is on screen at once, so its width is
 * the sum of all of them. That is a bargain at two ("kg | Bag of 50 kg") because the alternative
 * costs a click to discover a choice you can see for free — Zoho Inventory shows the unit group's
 * two common units this way beside a quantity field. It stops being a bargain the moment a
 * product's set grows past two, which it now routinely does: `UNIT_UX_CONTRACT.md` §2.1 step 4
 * adds every same-category base unit, so an ordinary KG product with a pack has FOUR options
 * (kg, Bag of 50 kg, t, g) and a four-segment control with a phrase in one segment does not fit
 * beside a numeric input on a 360px screen, let alone read well.
 *
 * Odoo 18's product form and Odoo's receipt lines both use a plain UoM dropdown glued to the
 * right of the quantity input for exactly that reason. So this component renders whichever the
 * option count justifies, and callers do not choose — a control that changes shape with its
 * content is one decision made once here rather than a judgement call at every call site.
 */
const SEGMENTED_MAX_OPTIONS = 2
/** Roughly the width, in characters, at which two segments plus their padding stop fitting
 *  beside a quantity input at 360px. "kg" + "Bag of 50 kg" is 14 and fits; two pack phrases do
 *  not, and fall through to the dropdown. */
const SEGMENTED_MAX_LABEL_CHARS = 22

/**
 * The unit control that sits inline beside a quantity input — "which unit is the number I just
 * typed in?", `UNIT_UX_CONTRACT.md` §1's **Counted in**.
 *
 * <h2>It renders a closed set, and that is the fix</h2>
 * Its options are a product's unit set (§2), never a list of unit codes. Every entry carries a
 * real `factorToStockUnit`, so §7.1 — *no quantity field anywhere offers a unit with no
 * conversion factor* — holds structurally rather than by review. The "full list, for a one-off
 * delivery unit" pickers this used to sit next to were the defect (plan §3's P1-1/P1-3: every
 * code in them other than the product's own packaging unit was a guaranteed 400), and they are
 * deleted rather than repaired. The escape hatch for a genuinely new pack is an explicit,
 * persistent act — "this delivery came in a different pack" — which ADDS an option to this set
 * rather than bypassing it.
 *
 * <h2>Shape</h2>
 * Two options render as a segmented control (modelled on
 * `marketplace/analytics/components/SegmentedControl.tsx`, shrunk to sit beside an input); three
 * or more render as a compact native select. See {@link SEGMENTED_MAX_OPTIONS}.
 *
 * Renders nothing at all when there is only one option — a product with no pack and no
 * same-category base units has nothing to choose between, and a one-segment control is a button
 * that does nothing. Callers do not need to guard this.
 *
 * <h2>Accessibility</h2>
 * The buttons say "kg" and "Bag of 50 kg", which say nothing about what they switch, so the group
 * carries the name and each button carries `aria-pressed`. Selection is never signalled by colour
 * alone: the pressed segment gets a white surface, a border, a shadow and a heavier weight, and
 * `aria-pressed` states it outright for anyone not looking at the pixels.
 */
export function UnitToggle({ value, onChange, options, label = UNIT_COPY.COUNTED_IN, disabled }: UnitToggleProps) {
  const selectId = useId()
  const normalised = options

  if (normalised.length < 2) return null

  const totalLabelChars = normalised.reduce((sum, option) => sum + option.label.length, 0)
  const segmented = normalised.length <= SEGMENTED_MAX_OPTIONS && totalLabelChars <= SEGMENTED_MAX_LABEL_CHARS

  if (!segmented) {
    return (
      <select
        id={selectId}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 sm:w-auto"
      >
        {normalised.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
      role="group"
      aria-label={label}
    >
      {normalised.map((option) => {
        const selected = value === option.code
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.code)}
            className={`rounded-sm px-2.5 py-1 text-xs whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? 'border border-neutral-200 bg-white font-semibold text-neutral-900 shadow-sm'
                : 'border border-transparent font-medium text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
