import { Skeleton } from '@/components/Skeleton'
import { formatPermissionName, formatRoleName } from '@/features/users/formatters'
import { useRoles } from '@/features/users/hooks/useRoles'
import type { UserRole } from '@/features/users/types'

export interface RoleSelectFieldProps {
  value: UserRole
  onChange: (role: UserRole) => void
  disabled?: boolean
  disabledHint?: string
  error?: string
}

export function RoleSelectField({ value, onChange, disabled, disabledHint, error }: RoleSelectFieldProps) {
  const { data: roles, loading, error: loadError } = useRoles()

  return (
    <div title={disabled ? disabledHint : undefined}>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">Role</span>
      <p className="mb-2 text-xs text-neutral-500">Each role decides what this person can see and change.</p>

      {loading && (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!loading && loadError && (
        <p className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{loadError}</p>
      )}

      {!loading && !loadError && (roles?.length ?? 0) === 0 && (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          No roles are available.
        </p>
      )}

      {!loading &&
        !loadError &&
        roles &&
        roles.length > 0 && (
          <div role="radiogroup" aria-label="Role" className="flex flex-col gap-1.5">
            {roles.map((role) => {
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
                    selected
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  <span className="block text-sm font-medium text-neutral-900">{formatRoleName(role.name)}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{role.description}</span>
                  {selected && role.permissions.length > 0 && (
                    <span className="mt-1.5 block text-xs text-neutral-500">
                      Grants: {role.permissions.map(formatPermissionName).join(' · ')}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger-600">
          {error}
        </p>
      )}
      {disabled && disabledHint && <p className="mt-1.5 text-xs text-neutral-500">{disabledHint}</p>}
    </div>
  )
}
