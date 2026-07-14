import { ROLE_OPTIONS, type UserRole } from '@/features/users/types'

export interface RoleSelectFieldProps {
  value: UserRole
  onChange: (role: UserRole) => void
  disabled?: boolean
  disabledHint?: string
}

export function RoleSelectField({ value, onChange, disabled, disabledHint }: RoleSelectFieldProps) {
  const selected = ROLE_OPTIONS.find((option) => option.value === value)

  return (
    <div title={disabled ? disabledHint : undefined}>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">Role</span>
      <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-1" role="radiogroup" aria-label="Role">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              value === option.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {selected && <p className="mt-1.5 text-xs text-neutral-500">{selected.label} — {selected.description}</p>}
    </div>
  )
}
