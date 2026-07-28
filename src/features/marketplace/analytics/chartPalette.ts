/**
 * Colours for this module's charts.
 *
 * `@/components/analytics/chartTokens` carries the five the tenant dashboard needs — two
 * series, gridline, axis, ticks — and those are re-exported below unchanged so the two
 * analytics screens never drift apart. What it does not carry is a CATEGORICAL ramp, and
 * the category-mix chart needs one slice colour per category.
 *
 * Rather than inventing hexes (the contract forbids raw hex outright), the ramp is written
 * as `var(--color-*)` references to the design tokens declared in `src/index.css`. SVG
 * `fill`/`stroke` resolve CSS custom properties, so recharts renders them directly and a
 * palette change in the theme reaches these charts for free.
 *
 * The ramp alternates hue families rather than walking one ramp light-to-dark, so adjacent
 * slices stay distinguishable when a mix is dominated by two or three categories — and it
 * degrades to shades, not to nothing, for anyone who cannot separate the hues.
 */
export { AXIS_LINE, GRIDLINE, TICK_TEXT } from '@/components/analytics/chartTokens'

/** Money. primary-500 rather than primary-600 — see chartTokens for why 600 is too dark for a mark. */
export const REVENUE_COLOR = 'var(--color-primary-500)'

/** Volume/secondary series, and anything that means "completed". */
export const VOLUME_COLOR = 'var(--color-accent-600)'

/** Awaiting / in flight. Matches the warning-amber the rest of the app uses for incoming stock. */
export const PENDING_COLOR = 'var(--color-warning-500)'

/** Cancelled / lost. */
export const NEGATIVE_COLOR = 'var(--color-danger-500)'

export const CATEGORY_COLORS = [
  'var(--color-primary-500)',
  'var(--color-accent-600)',
  'var(--color-primary-300)',
  'var(--color-warning-500)',
  'var(--color-accent-400)',
  'var(--color-primary-700)',
  'var(--color-accent-800)',
  'var(--color-warning-300)',
  'var(--color-primary-400)',
  'var(--color-neutral-400)',
]

/** Wraps rather than running out — an operator with twelve categories still gets twelve slices. */
export function categoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
}
