export interface ListingToggleProps {
  listed: boolean
  onChange: (listed: boolean) => void
  /** Product name — the switch is the only control in its row, so it needs its own accessible name. */
  label: string
  disabled?: boolean
  /** Why the control is unavailable. Shown as a tooltip; a disabled control must always say why. */
  disabledReason?: string
}

/**
 * The listed/unlisted switch. A real `role="switch"` rather than a styled checkbox, because
 * "listed" is an immediate state change on the public storefront, not a form value someone submits
 * later — and screen readers should announce it as on/off, not checked/unchecked.
 */
export function ListingToggle({ listed, onChange, label, disabled = false, disabledReason }: ListingToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={listed}
      aria-label={`${listed ? 'Listed' : 'Not listed'} on the storefront — ${label}`}
      title={disabled ? disabledReason : listed ? 'Listed on the public storefront' : 'Hidden from the storefront'}
      disabled={disabled}
      onClick={() => onChange(!listed)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none ${
        listed ? 'bg-accent-600' : 'bg-neutral-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          listed ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
