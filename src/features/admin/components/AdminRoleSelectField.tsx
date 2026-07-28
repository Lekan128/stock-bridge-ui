import { ADMIN_ROLE_OPTIONS } from '@/features/admin/roles'
import { formatRoleName } from '@/features/users/formatters'

export interface AdminRoleSelectFieldProps {
  value: string
  onChange: (role: string) => void
  disabled?: boolean
  disabledHint?: string
  error?: string
}

/**
 * The super-admin twin of features/users' RoleSelectField.
 *
 * Same markup and same interaction, but reads the static ADMIN_ROLE_OPTIONS instead of calling
 * GET /api/roles — see roles.ts for why that endpoint is unreachable with a super-admin token.
 * That also means there is no loading or error branch to render here.
 */
export function AdminRoleSelectField({ value, onChange, disabled, disabledHint, error }: AdminRoleSelectFieldProps) {
  return (
    <div title={disabled ? disabledHint : undefined}>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">Role</span>
      <p className="mb-2 text-xs text-neutral-500">Each role decides what this person can see and change.</p>

      <div role="radiogroup" aria-label="Role" className="flex flex-col gap-1.5">
        {ADMIN_ROLE_OPTIONS.map((role) => {
          const selected = value === role.name
          return (
            <button
              key={role.name}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(role.name)}
              className={`rounded-md border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                selected ? 'border-primary-300 bg-primary-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'
              }`}
            >
              <span className="block text-sm font-medium text-neutral-900">{formatRoleName(role.name)}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">{role.description}</span>
            </button>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger-600">
          {error}
        </p>
      )}
      {disabled && disabledHint && <p className="mt-1.5 text-xs text-neutral-500">{disabledHint}</p>}
    </div>
  )
}
