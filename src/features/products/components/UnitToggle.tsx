export interface UnitToggleOption {
  /** Empty string means "the product's base unit" — mirrors the wire contract's `unit` field,
   *  where omitting it means the same thing. Never `undefined` here so it's a stable RHF/state value. */
  value: string
  label: string
}

export interface UnitToggleProps {
  value: string
  onChange: (value: string) => void
  options: UnitToggleOption[]
  /** Accessible name for the group — the buttons alone ("kg", "bag") say nothing about what they switch. */
  label: string
}

/**
 * The compact "kg ⟷ bag" toggle next to a quantity field — design spec §6's Zoho Unit Group
 * model: a base unit plus the product's configured packaging unit, entering "3" against "bag"
 * transparently resolving toward the base-unit equivalent elsewhere on the form (see
 * `StockInModal`/`StockOutModal`'s conversion preview text, not this component's job).
 *
 * Visually and behaviourally modelled on `marketplace/analytics/components/SegmentedControl.tsx`
 * — same `aria-pressed` buttons in a `role="group"`, shrunk slightly (`px-2.5 py-1 text-xs`
 * instead of `px-3 py-1.5 text-sm`) to sit inline next to a text input rather than stand alone.
 *
 * Renders nothing when there's only one option (a product with no configured packaging unit has
 * nothing to toggle between) — the caller doesn't need to guard this itself.
 */
export function UnitToggle({ value, onChange, options, label }: UnitToggleProps) {
  if (options.length < 2) return null

  return (
    <div
      className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-sm px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
            value === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
