import { PERMISSIONS } from '@/auth/permissions'
import { useRoles } from '@/features/users/hooks/useRoles'
import { useWorkingBranch } from '@/features/branches/useWorkingBranch'

interface WorksAtFieldProps {
  roleId: string | undefined
  value: string[]
  onChange: (branchIds: string[]) => void
}

/**
 * "Works at" on a person (MULTI_BRANCH_UX_PLAN.md §5.10): the branches they record at. When their role
 * works at every branch the ticks give way to a sentence saying so, so "all" has one source - the role.
 * "Select all" ticks today's branches; a branch added later is not ticked for them. Nothing at a
 * one-branch company.
 */
export function WorksAtField({ roleId, value, onChange }: WorksAtFieldProps) {
  const { isMultiBranch, branches } = useWorkingBranch()
  const { data: roles } = useRoles()
  if (!isMultiBranch) return null

  const role = roles?.find((candidate) => candidate.id === roleId)
  const everywhere = role?.permissions.includes(PERMISSIONS.WORK_AT_ALL_BRANCHES) ?? false
  const open = branches.filter((branch) => branch.active)

  if (everywhere) {
    return (
      <div>
        <p className="text-sm font-medium text-neutral-800">Works at</p>
        <p className="mt-1 text-sm text-neutral-600">Every branch, from their role: {role?.name}.</p>
      </div>
    )
  }

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id])

  return (
    <fieldset>
      <legend className="text-sm font-medium text-neutral-800">Works at</legend>
      <p className="mt-0.5 text-xs text-neutral-600">They record stock only at these branches.</p>
      <div className="mt-2 flex flex-col gap-1.5">
        {open.map((branch) => (
          <label key={branch.id} className="flex items-center gap-2 text-sm text-neutral-800">
            <input type="checkbox" checked={value.includes(branch.id)} onChange={() => toggle(branch.id)} />
            {branch.name}
            {branch.main && <span className="text-xs text-neutral-500">Main</span>}
          </label>
        ))}
      </div>
      {open.length > 2 && (
        <button
          type="button"
          onClick={() => onChange(open.map((branch) => branch.id))}
          className="mt-2 text-sm font-medium text-primary-700 hover:underline"
        >
          Select all
        </button>
      )}
      {value.length === 0 && <p className="mt-1 text-xs text-danger-700">Choose at least one branch.</p>}
    </fieldset>
  )
}
