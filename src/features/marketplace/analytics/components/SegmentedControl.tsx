export interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  /** Accessible name for the group — never omit it, the buttons alone say nothing about what they switch. */
  label: string
}

/**
 * The metric/granularity toggle.
 *
 * Visually identical to the one inside `TopProductsChart`, deliberately: that one is a
 * private component of a chart this page does not use, so the choice was to duplicate
 * twenty lines or to edit a shared file another module owns. `aria-pressed` plus a
 * `role="group"` label keeps it announceable, which the design also depends on — the
 * selected segment is signalled by weight and a subtle shadow, not by colour alone.
 */
export function SegmentedControl<T extends string>({ value, onChange, options, label }: SegmentedControlProps<T>) {
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
          className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
            value === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
