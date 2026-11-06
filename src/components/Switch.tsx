export interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  /** Read out with the switch; also what the visible label says, via `aria-labelledby` when given. */
  label: string
  /** The id of the visible text that names this switch, so the words on screen are what is announced. */
  labelledBy?: string
  disabled?: boolean
}

/**
 * An on/off switch — a real `role="switch"`, not a checkbox: pressing it changes a choice right
 * now rather than being a value submitted later, and it is announced as on or off.
 *
 * Green means "on", as it does in profile email settings. It is not a call to action.
 */
export function Switch({ checked, onChange, label, labelledBy, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:outline-none ${
        checked ? 'bg-accent-600' : 'bg-neutral-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
