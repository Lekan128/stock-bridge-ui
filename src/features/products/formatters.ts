import { formatNaira } from '@/utils/money'

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/**
 * Delegates to the shared NGN formatter. Kept as a named re-export rather than deleted so the
 * dozen existing call sites in the products feature don't all have to change — but there is now
 * exactly one place that decides what money looks like, and it is `utils/money.ts`.
 */
export function formatCurrency(value: number | null | undefined): string {
  return formatNaira(value)
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value))
}

/**
 * Renders the full "what this product is measured in, and how it's packaged" description for a
 * product row or detail page. Takes already-resolved LABELS, not wire codes — `product.
 * unitOfMeasure`/`packagingUnit` are codes like `"KG"`/`"BAG"`, meaningless to a reader, so
 * callers look each label up via `useUnitOfMeasureOptions` first. Never throws on a code with no
 * matching option (a request that hasn't landed in the static list yet); a missing label is just
 * dropped from the output rather than surfacing as a crash.
 *
 * Three shapes, depending on what is present:
 * - Packaging present (`packagingLabel` and `packagingSize` both given): `"Bag of 50 kg"` —
 *   `"<packagingLabel> of <packagingSize> <baseLabel>"`. If `baseLabel` is missing (should not
 *   happen given the server's pairing rule, but the formatter does not assume it), falls back to
 *   `"Bag of 50"`.
 * - Base unit alone, no packaging: just the base label, e.g. `"Kilogram (kg)"`. A bare count with
 *   no base label (e.g. `packagingSize` set but nothing else resolved) renders as the number alone.
 * - Neither present: `''`.
 *
 * Examples: `("Kilogram (kg)", "Bag", 50)` → `"Bag of 50 kg"`; `("Kilogram (kg)", undefined,
 * undefined)` → `"Kilogram (kg)"`; `(undefined, undefined, undefined)` → `''`.
 */
export function formatUnitOfMeasure(
  baseLabel: string | undefined,
  packagingLabel: string | undefined,
  packagingSize: number | null | undefined,
): string {
  const hasSize = packagingSize != null && !Number.isNaN(packagingSize)

  if (packagingLabel && hasSize) {
    return baseLabel ? `${packagingLabel} of ${packagingSize} ${baseLabel}` : `${packagingLabel} of ${packagingSize}`
  }
  if (packagingLabel) return baseLabel ? `${packagingLabel} (${baseLabel})` : packagingLabel
  if (baseLabel) return hasSize ? `${packagingSize} ${baseLabel}` : baseLabel
  return hasSize ? String(packagingSize) : ''
}
