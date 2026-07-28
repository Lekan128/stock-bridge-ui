/**
 * The single money formatter for the whole app. Currency is NGN everywhere — the
 * marketplace, the inventory catalog and analytics all price in naira — so nothing else
 * should ever construct an Intl.NumberFormat for money. Keeping it here means a precision
 * or locale change is a one-file change instead of a grep across every component.
 *
 * `en-NG` is pinned deliberately rather than using the visitor's locale: the ₦ symbol and
 * the `1,234,567.89` grouping are part of the product's identity, and a browser set to
 * e.g. de-DE would otherwise render `1.234.567,89 NGN`.
 */
const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Compact form for chart axes and stat tiles, where `₦1,234,567.89` is far too wide.
// minimumFractionDigits: 0 keeps small values clean (`₦950`, not `₦950.0`).
const compactNairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

// Whole-naira form for thresholds and marketing copy ("free delivery over ₦150,000"), where a
// trailing `.00` on a round number is just noise. Never use it for an amount someone pays.
const wholeNairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

const PLACEHOLDER = '—'

/** `1234567.891` → `₦1,234,567.89`. Null/undefined/NaN render as an em dash, never `₦NaN`. */
export function formatNaira(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return PLACEHOLDER
  return nairaFormatter.format(value)
}

/** `150000` → `₦150,000`. Thresholds and copy only — never a payable amount. */
export function formatNairaWhole(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return PLACEHOLDER
  return wholeNairaFormatter.format(value)
}

/** `1234567.891` → `₦1.2M`. For chart axes, tooltips and compact stat tiles only. */
export function formatNairaCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return PLACEHOLDER
  return compactNairaFormatter.format(value)
}
